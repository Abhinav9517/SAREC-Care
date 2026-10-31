const express = require('express')
const { authenticate, authorize } = require('../middleware/authMiddleware')
const Announcement = require('../models/Announcement')
const asyncHandler = require('../utils/asyncHandler')
const path = require('node:path')
const { uploadRoot } = require('../middleware/uploadMiddleware')
const router = express.Router()
router.use(authenticate, authorize('student', 'resolver', 'admin'))
router.get('/', asyncHandler(async (req, res) => {
  const now = new Date()
  const data = await Announcement.find({ published: true, startsAt: { $lte: now }, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }).select('title text image imageAttachment popup mandatory startsAt expiresAt acknowledgements.user').sort({ startsAt: -1 }).lean()
  res.json({ success: true, data: data.map(({ acknowledgements, ...item }) => ({ ...item, acknowledged: acknowledgements.some((ack) => String(ack.user) === req.user.id) })) })
}))
router.get('/:id/image', asyncHandler(async (req, res, next) => {
  const query = Announcement.findById(req.params.id).select('published startsAt expiresAt imageAttachment')
  const announcement = await query
  const now = new Date()
  if (!announcement || !announcement.imageAttachment?.storageName || !/^[a-f0-9-]{36}[.]bin$/i.test(announcement.imageAttachment.storageName) || (req.user.role !== 'admin' && (!announcement.published || announcement.startsAt > now || (announcement.expiresAt && announcement.expiresAt <= now)))) return res.status(404).json({ success: false, message: 'Announcement image not found' })
  res.set('Cache-Control', 'private, no-store').set('X-Content-Type-Options', 'nosniff').type(announcement.imageAttachment.mimeType)
  return res.sendFile(announcement.imageAttachment.storageName, { root: uploadRoot, dotfiles: 'deny' }, (error) => {
    if (!error || res.headersSent) return
    if (error.statusCode === 404) return res.status(404).json({ success: false, message: 'Announcement image not found' })
    return next(error)
  })
}))
router.post('/:id/acknowledge', asyncHandler(async (req, res) => {
  const now = new Date()
  const doc = await Announcement.findOneAndUpdate({ _id: req.params.id, published: true, startsAt: { $lte: now }, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }], 'acknowledgements.user': { $ne: req.user.id } }, { $push: { acknowledgements: { user: req.user.id, at: now } } }, { returnDocument: 'after' })
  if (!doc) return res.status(404).json({ success: false, message: 'Announcement not found' })
  res.json({ success: true })
}))
module.exports = router
