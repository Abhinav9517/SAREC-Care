const nodemailer = require('nodemailer')

let testTransport = null
let cachedTransport = null
let cachedConfiguration = ''

const sanitizeDiagnostic = (value) => {
  let safe = String(value ?? '')
  const configuration = mailConfiguration()
  for (const secret of [configuration.password, configuration.user, process.env.JWT_SECRET]) {
    if (secret) safe = safe.split(secret).join('[REDACTED]')
  }
  return safe
    .replace(/https?:\/\/[^\s<>'"]+/gi, (url) => {
      try {
        const parsed = new URL(url)
        if (parsed.searchParams.has('token')) parsed.searchParams.set('token', '[REDACTED]')
        return parsed.toString()
      } catch { return '[REDACTED_URL]' }
    })
    .replace(/[A-Za-z0-9_-]{43}/g, '[REDACTED_TOKEN]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]')
}

const logMailFailure = (error) => {
  const fields = ['name', 'code', 'command', 'responseCode', 'response', 'message']
  const diagnostic = Object.fromEntries(fields
    .filter((field) => error?.[field] !== undefined)
    .map((field) => [field, sanitizeDiagnostic(error[field])]))
  console.error(`Password recovery email delivery failed. ${JSON.stringify(diagnostic)}`)
}

const mailConfiguration = () => ({
  host: process.env.SMTP_HOST?.trim(),
  port: Number.parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  user: process.env.SMTP_USER,
  password: process.env.SMTP_PASS,
  from: process.env.MAIL_FROM?.trim(),
  resetOrigin: process.env.PASSWORD_RESET_ORIGIN?.trim() || process.env.CLIENT_ORIGIN?.split(',')[0]?.trim(),
})

const trustedResetOrigin = (configuration) => {
  if (!configuration.resetOrigin) return null
  try {
    const url = new URL(configuration.resetOrigin)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') return null
    return url.origin
  } catch {
    return null
  }
}

const isMailConfigured = () => {
  const configuration = mailConfiguration()
  return Boolean(configuration.host && Number.isInteger(configuration.port) && configuration.port > 0 && configuration.from && trustedResetOrigin(configuration) && ((configuration.user && configuration.password) || (!configuration.user && !configuration.password)))
}

const getTransport = () => {
  if (testTransport) return testTransport
  const configuration = mailConfiguration()
  const key = JSON.stringify(configuration)
  if (!cachedTransport || cachedConfiguration !== key) {
    cachedTransport = nodemailer.createTransport({
      host: configuration.host,
      port: configuration.port,
      secure: configuration.secure,
      ...(configuration.user ? { auth: { user: configuration.user, pass: configuration.password } } : {}),
    })
    cachedConfiguration = key
  }
  return cachedTransport
}

const sendPasswordResetEmail = async ({ to, token }) => {
  if (!isMailConfigured()) throw new Error('Mail delivery is not configured')
  const configuration = mailConfiguration()
  const resetUrl = new URL('/reset-password', trustedResetOrigin(configuration))
  resetUrl.searchParams.set('token', token)
  await getTransport().sendMail({
    from: configuration.from,
    to,
    subject: 'Reset your SAREC Care password',
    text: `A password reset was requested for your SAREC Care account.\n\nUse this secure link within 15 minutes:\n${resetUrl.toString()}\n\nIf you did not request this reset, ignore this email. Your current password will remain unchanged.`,
    html: `<div style="font-family:Arial,sans-serif;color:#15253d"><h2>SAREC Care</h2><p>A password reset was requested for your account.</p><p><a href="${resetUrl.toString()}" style="background:#2161e8;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Reset your password</a></p><p>This link expires in 15 minutes. If you did not request this reset, ignore this email. Your current password will remain unchanged.</p><p style="color:#64748b;font-size:12px">Student Grievance &amp; Campus Support Platform</p></div>`,
  })
}

const verifyMailTransport = async () => {
  const configuration = mailConfiguration()
  const presence = {
    SMTP_HOST: Boolean(configuration.host),
    SMTP_PORT: Number.isInteger(configuration.port) && configuration.port > 0,
    SMTP_SECURE: typeof process.env.SMTP_SECURE === 'string',
    SMTP_USER: Boolean(configuration.user),
    SMTP_PASS: Boolean(configuration.password),
    MAIL_FROM: Boolean(configuration.from),
  }
  console.log('SMTP configuration presence:', Object.fromEntries(Object.entries(presence).map(([key, present]) => [key, present ? 'present' : 'missing'])))
  if (!isMailConfigured()) return { ok: false, reason: 'required_configuration_missing' }
  try {
    await getTransport().verify()
    console.log('SMTP transport verification succeeded.')
    return { ok: true }
  } catch (error) {
    logMailFailure(error)
    return { ok: false, reason: 'smtp_verification_failed' }
  }
}

const setTestTransport = (transport) => {
  if (process.env.NODE_ENV !== 'test') throw new Error('Test mail transport is available only in test mode')
  testTransport = transport
}

module.exports = { isMailConfigured, sendPasswordResetEmail, verifyMailTransport, logMailFailure, setTestTransport }
