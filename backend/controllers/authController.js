const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('node:crypto')
const User = require('../models/User')
const { isMailConfigured, sendPasswordResetEmail, logMailFailure } = require('../services/emailService')

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/

const safeUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  username: user.username,
  role: user.role,
  mustChangePassword: Boolean(user.mustChangePassword),
})

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()
const normalizeUsername = (username) => String(username || '').trim().toLowerCase()
const genericRecoveryMessage = 'If an eligible account exists for this email address, recovery instructions will be processed. If no email arrives, contact campus support.'
const recoveryUnavailableMessage = 'Password recovery is temporarily unavailable. Please contact campus support.'
const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

const validateRegistration = ({ name, email, username, password }) => {
  const errors = []
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
    errors.push({ field: 'name', message: 'Name must be between 2 and 80 characters' })
  }
  if (!emailPattern.test(normalizeEmail(email))) {
    errors.push({ field: 'email', message: 'Please provide a valid email address' })
  }
  if (!/^[a-z0-9._-]{3,30}$/i.test(String(username || ''))) errors.push({ field: 'username', message: 'Username must be 3–30 letters, numbers, dots, underscores, or hyphens' })
  if (typeof password !== 'string' || !passwordPattern.test(password)) {
    errors.push({ field: 'password', message: 'Password must be 8–72 characters with upper, lower, and numeric characters' })
  }
  return errors
}

const register = async (req, res, next) => {
  const { name, email, password } = req.body || {}
  const username = normalizeUsername(req.body?.username)
  const errors = validateRegistration({ name, email, username, password })
  if (errors.length) {
    return res.status(400).json({ success: false, message: 'Please correct the highlighted fields', details: errors })
  }

  try {
    const normalizedEmail = normalizeEmail(email)
    const existingUser = await User.findOne({ $or: [{ email: normalizedEmail }, { username }] }).select('_id')
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'An account with that email already exists' })
    }

    const user = await User.create({ name: name.trim(), email: normalizedEmail, username, password, role: 'student' })
    return res.status(201).json({ success: true, message: 'Student account created successfully', data: { user: safeUser(user) } })
  } catch (error) {
    return next(error)
  }
}

const login = async (req, res, next) => {
  const username = normalizeUsername(req.body?.username || req.body?.email)
  const password = req.body?.password

  if (!username || typeof password !== 'string' || password.length === 0) {
    return res.status(400).json({ success: false, message: 'Username and password are required' })
  }

  try {
    let user = await User.findOne({ username }).collation({ locale: 'en', strength: 2 }).select('+password +tokenVersion')
    if (!user && emailPattern.test(username)) {
      user = await User.findOne({ email: username }).select('+password +tokenVersion')
      if (user && !user.username) {
        const base = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 24) || 'user'
        let candidate = base
        let suffix = 1
        while (await User.exists({ username: candidate })) candidate = `${base.slice(0, 24)}${suffix++}`
        user.username = candidate
        await user.save()
      }
    }
    const validPassword = user ? await bcrypt.compare(password, user.password) : false
    if (!user || !validPassword || !user.active) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' })
    }

    if (!process.env.JWT_SECRET) {
      return next(new Error('JWT secret is not configured'))
    }

    const token = jwt.sign({ sub: user._id.toString(), role: user.role, ver: user.tokenVersion || 0 }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    })

    return res.json({ success: true, token, user: safeUser(user) })
  } catch (error) {
    return next(error)
  }
}

const changePassword = async (req, res, next) => {
  const currentPassword = req.body?.currentPassword
  const newPassword = req.body?.newPassword
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !passwordPattern.test(newPassword)) return res.status(400).json({ success: false, message: 'Provide the current password and a strong new password' })
  try {
    const user = await User.findById(req.user.id).select('+password +tokenVersion')
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) return res.status(401).json({ success: false, message: 'Current password is incorrect' })
    const passwordHash = await bcrypt.hash(newPassword, 10)
    const updated = await User.findOneAndUpdate({ _id: user._id, password: user.password, $or: [{ tokenVersion: user.tokenVersion || 0 }, { tokenVersion: { $exists: false } }] }, { $set: { password: passwordHash, mustChangePassword: false, passwordReset: null }, $inc: { tokenVersion: 1 } }, { returnDocument: 'after' }).select('_id name email username role mustChangePassword +tokenVersion')
    if (!updated) return res.status(409).json({ success: false, message: 'Account credentials changed. Sign in and try again.' })
    const token = jwt.sign({ sub: updated._id.toString(), role: updated.role, ver: updated.tokenVersion }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1d' })
    return res.json({ success: true, message: 'Password updated successfully', token, user: safeUser(updated) })
  } catch (error) { return next(error) }
}

const forgotPassword = async (req, res, next) => {
  const startedAt = Date.now()
  const email = normalizeEmail(req.body?.email)
  if (email.length > 160 || !emailPattern.test(email)) return res.status(400).json({ success: false, message: 'Enter a valid email address.' })
  if (!isMailConfigured()) return res.status(503).json({ success: false, message: recoveryUnavailableMessage })

  try {
    // Legacy account documents may predate the `active` field; only an explicit
    // false value represents deactivation, matching authentication behavior.
    const user = await User.findOne({ email, active: { $ne: false } }).select('_id email')
    if (user) {
      const token = crypto.randomBytes(32).toString('base64url')
      const now = new Date()
      const tokenHash = hashResetToken(token)
      const updated = await User.findOneAndUpdate({ _id: user._id, active: { $ne: false } }, { $set: { passwordReset: { tokenHash, createdAt: now, expiresAt: new Date(now.getTime() + 15 * 60 * 1000) } } }, { returnDocument: 'after' }).select('_id email')
      if (updated) {
        // Delivery runs independently so SMTP latency cannot create an account-existence timing signal.
        sendPasswordResetEmail({ to: updated.email, token }).catch(logMailFailure)
      }
    }
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, 200 - (Date.now() - startedAt))))
    return res.status(202).json({ success: true, message: genericRecoveryMessage })
  } catch (error) { return next(error) }
}

const resetPassword = async (req, res, next) => {
  const body = req.body || {}
  if (Object.keys(body).some((key) => !['token', 'newPassword'].includes(key))) return res.status(400).json({ success: false, message: 'Invalid password reset request.' })
  if (typeof body.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.token) || typeof body.newPassword !== 'string' || !passwordPattern.test(body.newPassword)) {
    return res.status(400).json({ success: false, message: 'The reset link is invalid or expired. Request a new password reset link.' })
  }
  try {
    const now = new Date()
    const tokenHash = hashResetToken(body.token)
    const passwordHash = await bcrypt.hash(body.newPassword, 10)
    const user = await User.findOneAndUpdate({ 'passwordReset.tokenHash': tokenHash, 'passwordReset.expiresAt': { $gt: now }, active: { $ne: false } }, { $set: { password: passwordHash, passwordReset: null, mustChangePassword: false }, $inc: { tokenVersion: 1 } }, { returnDocument: 'after' }).select('_id')
    if (!user) return res.status(400).json({ success: false, message: 'The reset link is invalid or expired. Request a new password reset link.' })
    return res.json({ success: true, message: 'Password reset successfully. Sign in using your new password.' })
  } catch (error) { return next(error) }
}

module.exports = { register, login, changePassword, forgotPassword, resetPassword, safeUser, validateRegistration, passwordPattern, hashResetToken, genericRecoveryMessage }
