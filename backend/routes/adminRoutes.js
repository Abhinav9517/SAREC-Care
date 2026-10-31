const express = require('express')
const path = require('node:path')
const fs = require('node:fs')
const { authenticate, authorize } = require('../middleware/authMiddleware')
const { uploadFiles, uploadRoot, verifyUploadedFiles, cleanupFiles } = require('../middleware/uploadMiddleware')
const User = require('../models/User')
const Grievance = require('../models/Grievance')
const Announcement = require('../models/Announcement')
const Category = require('../models/Category')
const CampusLocation = require('../models/CampusLocation')
const AuditLog = require('../models/AuditLog')
const asyncHandler = require('../utils/asyncHandler')

const router = express.Router()
router.use(authenticate, authorize('admin'))
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const log = async (req, action, targetType, targetId) => {
  const actor = await User.findById(req.user.id).select('name')
  return AuditLog.create({ actor: req.user.id, actorName: actor?.name || 'Administrator', actorRole: 'admin', action, targetType, targetId: String(targetId || '') })
}
const validateAnnouncementUpload = (req, res, next) => {
  const start = req.body?.startsAt ? new Date(req.body.startsAt) : new Date()
  const end = req.body?.expiresAt ? new Date(req.body.expiresAt) : null
  if (Number.isNaN(start.getTime()) || (end && (Number.isNaN(end.getTime()) || end <= start))) {
    cleanupFiles(req.file ? [req.file] : [])
    return res.status(400).json({ success: false, message: 'Provide valid announcement dates; expiration must be after publication starts' })
  }
  if (req.file && !req.file.mimetype.startsWith('image/')) {
    cleanupFiles([req.file])
    return res.status(400).json({ success: false, message: 'Announcement attachments must be images' })
  }
  return next()
}

const createResourceRoutes = (routePath, Model, action, foreignField) => {
  router.get(routePath, asyncHandler(async (_req, res) => res.json({ success: true, data: await Model.find().sort({ name: 1 }).lean() })))
  router.post(routePath, asyncHandler(async (req, res) => {
    const name = String(req.body?.name || '').trim()
    const description = String(req.body?.description || '').trim()
    if (name.length < 2 || name.length > 120 || description.length > 500) return res.status(400).json({ success: false, message: 'Provide a valid name and a description under 500 characters' })
    const duplicate = await Model.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, 'i') }).select('_id')
    if (duplicate) return res.status(409).json({ success: false, message: 'A record with that name already exists' })
    const record = await Model.create({ name, description })
    await log(req, `${action}.create`, action, record._id)
    res.status(201).json({ success: true, data: record })
  }))
  router.patch(`${routePath}/:id`, asyncHandler(async (req, res) => {
    const allowed = {}
    for (const key of ['name', 'description', 'active']) if (req.body?.[key] !== undefined) allowed[key] = req.body[key]
    if (!Object.keys(allowed).length) return res.status(400).json({ success: false, message: 'Provide a field to update' })
    if (allowed.name !== undefined) {
      allowed.name = String(allowed.name).trim()
      if (allowed.name.length < 2 || allowed.name.length > 120) return res.status(400).json({ success: false, message: 'Name must be 2 to 120 characters' })
      const duplicate = await Model.findOne({ _id: { $ne: req.params.id }, name: new RegExp(`^${escapeRegex(allowed.name)}$`, 'i') }).select('_id')
      if (duplicate) return res.status(409).json({ success: false, message: 'A record with that name already exists' })
    }
    if (allowed.description !== undefined && (typeof allowed.description !== 'string' || allowed.description.length > 500)) return res.status(400).json({ success: false, message: 'Description cannot exceed 500 characters' })
    if (allowed.active !== undefined && typeof allowed.active !== 'boolean') return res.status(400).json({ success: false, message: 'active must be boolean' })
    const record = await Model.findByIdAndUpdate(req.params.id, { $set: allowed }, { returnDocument: 'after', runValidators: true })
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' })
    await log(req, `${action}.update`, action, record._id)
    res.json({ success: true, data: record })
  }))
  router.delete(`${routePath}/:id`, asyncHandler(async (req, res) => {
    const record = await Model.findById(req.params.id)
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' })
    if (await Grievance.exists({ [foreignField]: record._id })) return res.status(409).json({ success: false, message: 'This value is referenced by grievances; deactivate it instead.' })
    await record.deleteOne()
    await log(req, `${action}.delete`, action, req.params.id)
    res.json({ success: true })
  }))
}

createResourceRoutes('/categories', Category, 'Category', 'categoryId')
createResourceRoutes('/locations', CampusLocation, 'Location', 'locationId')

router.get('/users/stats', asyncHandler(async (_req, res) => {
  const result = await User.aggregate([{ $group: { _id: { role: '$role', active: '$active' }, count: { $sum: 1 } } }])
  const counts = { student: { active: 0, inactive: 0 }, resolver: { active: 0, inactive: 0 }, admin: { active: 0, inactive: 0 } }
  result.forEach(({ _id, count }) => { if (counts[_id.role]) counts[_id.role][_id.active ? 'active' : 'inactive'] = count })
  res.json({ success: true, data: counts })
}))

router.get('/users', asyncHandler(async (req, res) => {
  const page = Number.parseInt(req.query.page || '1', 10)
  const limit = Number.parseInt(req.query.limit || '20', 10)
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) return res.status(400).json({ success: false, message: 'Page must be positive and limit must be 1 to 100' })
  const filter = {}
  if (req.query.role) {
    if (!['student', 'admin', 'resolver'].includes(req.query.role)) return res.status(400).json({ success: false, message: 'Invalid user role filter' })
    filter.role = req.query.role
  }
  if (req.query.active !== undefined) {
    if (!['true', 'false'].includes(req.query.active)) return res.status(400).json({ success: false, message: 'active must be true or false' })
    filter.active = req.query.active === 'true'
  }
  if (req.query.search) {
    const search = String(req.query.search).trim()
    if (search.length > 80) return res.status(400).json({ success: false, message: 'Search cannot exceed 80 characters' })
    const expression = new RegExp(escapeRegex(search), 'i')
    filter.$or = [{ username: expression }, { name: expression }]
  }
  const [users, total] = await Promise.all([
    User.find(filter).select('_id username name email role active createdAt').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ])
  const userIds = users.map((user) => user._id)
  const grouped = userIds.length ? await Grievance.aggregate([{ $match: { reportedBy: { $in: userIds } } }, { $group: { _id: '$reportedBy', total: { $sum: 1 } } }]) : []
  const countMap = new Map(grouped.map((row) => [String(row._id), row.total]))
  res.json({ success: true, data: users.map((user) => ({ ...user, grievanceCount: countMap.get(String(user._id)) || 0 })), pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
}))
router.get('/users/:id/grievances', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('_id')
  if (!user) return res.status(404).json({ success: false, message: 'User not found' })
  const page = Number.parseInt(req.query.page || '1', 10)
  const limit = Number.parseInt(req.query.limit || '20', 10)
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) return res.status(400).json({ success: false, message: 'Page must be positive and limit must be 1 to 100' })
  const filter = user.role === 'resolver'
    ? { $or: [{ 'statusHistory.actor': user._id }, { 'comments.author': user._id }, { 'resolution.resolvedBy': user._id }, { 'resolutionHistory.resolvedBy': user._id }] }
    : { reportedBy: user._id }
  const [records, total] = await Promise.all([
    Grievance.find(filter).select('_id trackingId title category location status createdAt updatedAt statusHistory').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Grievance.countDocuments(filter),
  ])
  res.json({ success: true, data: records, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
}))

router.post('/resolvers', asyncHandler(async (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase()
  const name = String(req.body?.name || '').trim()
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = req.body?.password
  if (!/^[a-z0-9._-]{3,30}$/.test(username) || name.length < 2 || name.length > 80 || !/^\S+@\S+\.\S+$/.test(email) || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/.test(password || '')) return res.status(400).json({ success: false, message: 'Provide a valid username, name, email, and strong initial password' })
  const user = await User.create({ username, name, email, password, role: 'resolver', mustChangePassword: true })
  await log(req, 'resolver.create', 'User', user._id)
  res.status(201).json({ success: true, data: { id: user.id, username: user.username, name: user.name, email: user.email, role: user.role, active: user.active } })
}))

router.patch('/resolvers/:id', asyncHandler(async (req, res) => {
  const allowed = {}
  if (req.body?.name !== undefined) allowed.name = String(req.body.name).trim()
  if (req.body?.email !== undefined) allowed.email = String(req.body.email).trim().toLowerCase()
  if (Object.keys(allowed).length === 0 || (allowed.name !== undefined && (allowed.name.length < 2 || allowed.name.length > 80)) || (allowed.email !== undefined && !/^\S+@\S+\.\S+$/.test(allowed.email))) return res.status(400).json({ success: false, message: 'Provide a valid name or email update' })
  const update = { $set: allowed }
  if (allowed.email !== undefined) { update.$set.passwordReset = null; update.$inc = { tokenVersion: 1 } }
  const user = await User.findOneAndUpdate({ _id: req.params.id, role: 'resolver' }, update, { returnDocument: 'after', runValidators: true }).select('_id username name email role active createdAt')
  if (!user) return res.status(404).json({ success: false, message: 'Resolver not found' })
  await log(req, 'resolver.profile.update', 'User', user._id)
  res.json({ success: true, data: user })
}))

router.patch('/users/:id/active', asyncHandler(async (req, res) => {
  if (typeof req.body?.active !== 'boolean') return res.status(400).json({ success: false, message: 'active must be boolean' })
  const target = await User.findById(req.params.id).select('_id role active')
  if (!target) return res.status(404).json({ success: false, message: 'User not found' })
  if (target.role === 'admin' && (!req.body.active || String(target._id) === req.user.id)) return res.status(400).json({ success: false, message: 'Administrator accounts cannot be deactivated through this interface' })
  const changes = { $set: { active: req.body.active }, $inc: { tokenVersion: 1 } }
  if (!req.body.active) changes.$set.passwordReset = null
  const user = await User.findByIdAndUpdate(target._id, changes, { returnDocument: 'after' }).select('_id username name role active')
  await log(req, 'user.active.update', 'User', user._id)
  res.json({ success: true, data: user })
}))

router.get('/announcements', asyncHandler(async (_req, res) => res.json({ success: true, data: await Announcement.find().sort({ createdAt: -1 }).lean() })))
router.post('/announcements', uploadFiles('image', true), verifyUploadedFiles, validateAnnouncementUpload, asyncHandler(async (req, res) => {
  const { title, text, published, popup, mandatory, startsAt, expiresAt } = req.body
  const file = req.file
  const imageAttachment = file ? { storageName: file.filename, originalName: file.originalname.slice(0, 180), mimeType: file.mimetype, size: file.size, uploadedAt: new Date(), uploader: req.user.id } : undefined
  try {
    const doc = await Announcement.create({ title, text, published: published === 'true' || published === true, popup: popup !== 'false' && popup !== false, mandatory: mandatory === 'true' || mandatory === true, startsAt: startsAt || new Date(), expiresAt: expiresAt || null, imageAttachment, author: req.user.id })
    await log(req, 'announcement.create', 'Announcement', doc._id)
    res.status(201).json({ success: true, data: doc })
  } catch (error) { if (file) cleanupFiles([file]); throw error }
}))
router.get('/announcements/:id/image', asyncHandler(async (req, res, next) => {
  const doc = await Announcement.findById(req.params.id).select('imageAttachment')
  if (!doc?.imageAttachment?.storageName || !/^[a-f0-9-]{36}[.]bin$/i.test(doc.imageAttachment.storageName)) return res.status(404).json({ success: false, message: 'Announcement image not found' })
  res.set('Cache-Control', 'private, no-store').set('X-Content-Type-Options', 'nosniff').type(doc.imageAttachment.mimeType)
  return res.sendFile(doc.imageAttachment.storageName, { root: uploadRoot, dotfiles: 'deny' }, (error) => {
    if (!error || res.headersSent) return
    if (error.statusCode === 404) return res.status(404).json({ success: false, message: 'Announcement image not found' })
    return next(error)
  })
}))
router.patch('/announcements/:id', uploadFiles('image', true), verifyUploadedFiles, validateAnnouncementUpload, asyncHandler(async (req, res) => {
  const fields = {}
  for (const key of ['title', 'text', 'published', 'popup', 'mandatory', 'startsAt', 'expiresAt']) if (req.body[key] !== undefined) fields[key] = req.body[key]
  for (const key of ['published', 'popup', 'mandatory']) if (fields[key] !== undefined) fields[key] = fields[key] === 'true' || fields[key] === true
  const file = req.file
  if (file) fields.imageAttachment = { storageName: file.filename, originalName: file.originalname.slice(0, 180), mimeType: file.mimetype, size: file.size, uploadedAt: new Date(), uploader: req.user.id }
  const previous = await Announcement.findById(req.params.id).select('imageAttachment')
  if (!previous) { if (file) cleanupFiles([file]); return res.status(404).json({ success: false, message: 'Announcement not found' }) }
  try {
    const doc = await Announcement.findByIdAndUpdate(req.params.id, { $set: fields }, { returnDocument: 'after', runValidators: true })
    await log(req, 'announcement.update', 'Announcement', doc._id)
    if (file && previous.imageAttachment?.storageName) fs.unlink(path.join(uploadRoot, previous.imageAttachment.storageName), () => {})
    res.json({ success: true, data: doc })
  } catch (error) { if (file) cleanupFiles([file]); throw error }
}))
router.delete('/announcements/:id', asyncHandler(async (req, res) => {
  const doc = await Announcement.findByIdAndDelete(req.params.id)
  if (!doc) return res.status(404).json({ success: false, message: 'Announcement not found' })
  if (doc.imageAttachment?.storageName) fs.unlink(path.join(uploadRoot, doc.imageAttachment.storageName), () => {})
  await log(req, 'announcement.delete', 'Announcement', req.params.id)
  res.json({ success: true })
}))

router.get('/audit-logs', asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page || '1', 10))
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit || '25', 10)))
  const [records, total] = await Promise.all([AuditLog.find().select('_id actorName actorRole action targetType targetId createdAt').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), AuditLog.countDocuments()])
  res.json({ success: true, data: records, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
}))

module.exports = router
