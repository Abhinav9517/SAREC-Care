const express = require('express')
const { createGrievance, listGrievances, updateGrievanceStatus, addComment, getSummary } = require('../controllers/grievanceController')
const { authenticate, authorize } = require('../middleware/authMiddleware')
const asyncHandler = require('../utils/asyncHandler')
const { uploadFiles, uploadRoot, maxFiles, verifyUploadedFiles, cleanupFiles } = require('../middleware/uploadMiddleware')

const router = express.Router()

router.use(authenticate)
router.post('/', authorize('student'), uploadFiles('attachments'), verifyUploadedFiles, asyncHandler(createGrievance))
router.get('/', authorize('student', 'admin', 'resolver'), asyncHandler(listGrievances))
router.get('/summary', authorize('student', 'admin', 'resolver'), asyncHandler(getSummary))
router.get('/:id', authorize('student', 'admin', 'resolver'), asyncHandler(async (req, res) => {
  const grievance = await require('../models/Grievance').findById(req.params.id).populate('reportedBy', 'name email username').populate('statusHistory.actor', 'name role').populate('comments.author', 'name role').lean()
  if (!grievance || (req.user.role === 'student' && grievance.reportedBy?._id.toString() !== req.user.id)) return res.status(404).json({ success: false, message: 'Grievance not found' })
  grievance.statusHistory?.sort((left, right) => new Date(left.changedAt) - new Date(right.changedAt))
  grievance.comments?.sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
  return res.json({ success: true, data: grievance })
}))
router.post('/:id/comments', authorize('admin', 'resolver'), asyncHandler(addComment))
router.post('/:id/attachments', authorize('admin', 'resolver'), uploadFiles('attachments'), verifyUploadedFiles, asyncHandler(async (req, res) => {
  const grievance = await require('../models/Grievance').findById(req.params.id)
  if (!grievance) return res.status(404).json({ success: false, message: 'Grievance not found' })
  if (!req.files?.length) return res.status(400).json({ success: false, message: 'Select at least one attachment' })
  if (grievance.attachments.length + req.files.length > maxFiles) { cleanupFiles(req.files); return res.status(400).json({ success: false, message: `A grievance can contain at most ${maxFiles} attachments` }) }
  const docs = (req.files || []).map((file) => ({ storageName: file.filename, originalName: file.originalname.slice(0, 180), mimeType: file.mimetype, size: file.size, uploader: req.user.id, uploadedAt: new Date() }))
  try { grievance.attachments.push(...docs); await grievance.save() } catch (error) { cleanupFiles(req.files); throw error }
  res.status(201).json({ success: true, data: docs })
}))
router.post('/:id/resolution-evidence', authorize('admin', 'resolver'), uploadFiles('attachments'), verifyUploadedFiles, asyncHandler(async (req, res) => {
  const grievance = await require('../models/Grievance').findById(req.params.id)
  if (!grievance) { cleanupFiles(req.files); return res.status(404).json({ success: false, message: 'Grievance not found' }) }
  if (!req.files?.length) return res.status(400).json({ success: false, message: 'Select at least one evidence file' })
  if ((grievance.resolution?.evidence?.length || 0) + req.files.length > maxFiles) { cleanupFiles(req.files); return res.status(400).json({ success: false, message: `A grievance can contain at most ${maxFiles} resolution evidence files` }) }
  const docs = (req.files || []).map((file) => ({ storageName: file.filename, originalName: file.originalname.slice(0, 180), mimeType: file.mimetype, size: file.size, uploader: req.user.id, uploadedAt: new Date() }))
  try {
    if (!grievance.resolution) grievance.resolution = {}
    grievance.resolution.evidence.push(...docs)
    await grievance.save()
  } catch (error) { cleanupFiles(req.files); throw error }
  res.status(201).json({ success: true, data: docs })
}))
router.get('/:id/attachments/:file', asyncHandler(async (req, res, next) => {
  const Grievance = require('../models/Grievance')
  const grievance = await Grievance.findById(req.params.id).select('reportedBy attachments resolution.evidence')
  if (!/^[a-f0-9-]{36}[.]bin$/i.test(req.params.file)) return res.status(404).json({ success: false, message: 'File not found' })
  if (!grievance) return res.status(404).json({ success: false, message: 'File not found' })
  if (req.user.role === 'student' && String(grievance.reportedBy) !== req.user.id) return res.status(404).json({ success: false, message: 'File not found' })
  const file = [...grievance.attachments, ...(grievance.resolution?.evidence || [])].find((item) => item.storageName === req.params.file)
  if (!file) return res.status(404).json({ success: false, message: 'File not found' })
  res.set('Cache-Control', 'private, no-store').set('Content-Security-Policy', "default-src 'none'; media-src 'self'; img-src 'self'").set('X-Content-Type-Options', 'nosniff').type(file.mimeType)
  return res.sendFile(file.storageName, { root: uploadRoot, dotfiles: 'deny' }, (error) => {
    if (!error || res.headersSent) return
    if (error.statusCode === 404) return res.status(404).json({ success: false, message: 'File not found' })
    return next(error)
  })
}))
router.delete('/:id/attachments/:file', asyncHandler(async (req, res) => {
  const Grievance = require('../models/Grievance')
  const { uploadRoot } = require('../middleware/uploadMiddleware')
  const path = require('node:path')
  const fs = require('node:fs')
  const grievance = await Grievance.findById(req.params.id)
  if (!grievance || req.user.role !== 'student' || String(grievance.reportedBy) !== req.user.id) return res.status(404).json({ success: false, message: 'Attachment not found' })
  if (!/^[a-f0-9-]{36}[.]bin$/i.test(req.params.file)) return res.status(404).json({ success: false, message: 'Attachment not found' })
  if (grievance.status !== 'Pending') return res.status(409).json({ success: false, message: 'Attachments can only be removed while the grievance is pending' })
  const index = grievance.attachments.findIndex((item) => item.storageName === req.params.file && String(item.uploader) === req.user.id)
  if (index < 0) return res.status(404).json({ success: false, message: 'Attachment not found' })
  const [attachment] = grievance.attachments.splice(index, 1)
  await grievance.save()
  fs.unlink(path.join(uploadRoot, attachment.storageName), () => {})
  res.json({ success: true, message: 'Attachment removed' })
}))
router.put('/:id', authorize('admin', 'resolver'), asyncHandler(updateGrievanceStatus))

module.exports = router
