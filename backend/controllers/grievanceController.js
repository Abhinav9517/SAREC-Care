const mongoose = require('mongoose')
const fs = require('node:fs')
const Category = require('../models/Category')
const CampusLocation = require('../models/CampusLocation')
const Grievance = require('../models/Grievance')
const User = require('../models/User')
const AuditLog = require('../models/AuditLog')

const { categories, statuses } = Grievance

const parsePagination = (query) => {
  const page = Number.parseInt(query.page || '1', 10)
  const limit = Number.parseInt(query.limit || '20', 10)
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    const error = new Error('Page must be at least 1 and limit must be between 1 and 100')
    error.statusCode = 400
    throw error
  }
  return { page, limit }
}

const buildFilters = (query) => {
  const filter = {}
  if (query.status) {
    if (!statuses.includes(query.status)) {
      const error = new Error('Invalid status filter')
      error.statusCode = 400
      throw error
    }
    filter.status = query.status
  }
  if (query.category) {
    if (typeof query.category !== 'string' || query.category.trim().length > 80) { const error = new Error('Invalid category filter'); error.statusCode = 400; throw error }
    filter.category = query.category
  }
  if (query.location) {
    if (typeof query.location !== 'string' || query.location.trim().length > 160) { const error = new Error('Invalid location filter'); error.statusCode = 400; throw error }
    filter.location = query.location
  }
  if (query.search) {
    const search = String(query.search).trim()
    if (search.length > 100) {
      const error = new Error('Search terms cannot exceed 100 characters')
      error.statusCode = 400
      throw error
    }
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const expression = new RegExp(escaped, 'i')
      filter.$or = [
        { title: expression },
        { description: expression },
        { location: expression },
      ]
    }
  }
  return filter
}

const createGrievance = async (req, res, next) => {
  const { title, description } = req.body || {}
  try {
    let category = String(req.body?.category || '').trim()
    let location = String(req.body?.location || '').trim()
    let categoryId = null
    let locationId = null
    if (req.body?.categoryId) {
      const record = await Category.findOne({ _id: req.body.categoryId, active: true }).select('_id name')
      if (!record) return res.status(400).json({ success: false, message: 'Select an active grievance category' })
      category = record.name
      categoryId = record._id
    }
    if (req.body?.locationId) {
      const record = await CampusLocation.findOne({ _id: req.body.locationId, active: true }).select('_id name')
      if (!record) return res.status(400).json({ success: false, message: 'Select an active campus location' })
      location = record.name
      locationId = record._id
    }
    if (!title || !description || !category || !location) return res.status(400).json({ success: false, message: 'Title, description, category, and location are required' })
    if (!categoryId && !categories.includes(category)) return res.status(400).json({ success: false, message: 'Select a category from the active category list' })
    const user = await User.findById(req.user.id).select('name role')
    const year = new Date().getUTCFullYear()
    const sequence = await Grievance.countDocuments({ createdAt: { $gte: new Date(`${year}-01-01T00:00:00Z`), $lt: new Date(`${year + 1}-01-01T00:00:00Z`) } }) + 1
    const grievanceId = new mongoose.Types.ObjectId()
    const grievance = await Grievance.create({
      _id: grievanceId,
      title,
      description,
      category,
      categoryId,
      location,
      locationId,
      reportedBy: req.user.id,
      status: 'Pending',
      // The full ObjectId suffix makes the human-readable ID collision-safe across workers and restarts.
      trackingId: `CGT-${year}-${String(sequence).padStart(6, '0')}-${grievanceId.toString().toUpperCase()}`,
      statusHistory: [{ newStatus: 'Pending', changedAt: new Date(), actor: req.user.id, actorName: user.name, actorRole: user.role, comment: 'Grievance submitted' }],
      attachments: (req.files || []).map((file) => ({ storageName: file.filename, originalName: file.originalname.slice(0, 180), mimeType: file.mimetype, size: file.size, uploader: req.user.id, uploadedAt: new Date() })),
    })
    const populated = await grievance.populate('reportedBy', 'name email')
    return res.status(201).json({ success: true, message: 'Grievance submitted successfully', data: populated })
  } catch (error) {
    for (const file of req.files || []) fs.unlink(file.path, () => {})
    return next(error)
  }
}

const listGrievances = async (req, res, next) => {
  try {
    const { page, limit } = parsePagination(req.query)
    const filter = buildFilters(req.query)
    if (req.user.role === 'student') {
      filter.reportedBy = req.user.id
    }

    const allRequested = ['admin', 'resolver'].includes(req.user.role) && req.query.all === 'true'
    if (req.query.search) {
      const expression = new RegExp(String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      const reporters = await User.find({ $or: [{ username: expression }, { name: expression }, { email: expression }] }).select('_id').lean()
      filter.$or = [...(filter.$or || []), { trackingId: expression }, { reportedBy: { $in: reporters.map((reporter) => reporter._id) } }]
    }
    const total = await Grievance.countDocuments(filter)
    let query = Grievance.find(filter)
      .sort({ createdAt: -1 })
      .populate('reportedBy', 'name email username')

    if (allRequested) {
      query = query.limit(5000)
    } else {
      query = query.skip((page - 1) * limit).limit(limit)
    }

    const grievances = await query.lean()
    return res.json({
      success: true,
      data: grievances,
      pagination: {
        page: allRequested ? 1 : page,
        limit: allRequested ? Math.min(total, 5000) : limit,
        total,
        pages: allRequested ? (total ? 1 : 0) : Math.ceil(total / limit),
        truncated: allRequested && total > grievances.length,
      },
    })
  } catch (error) {
    return next(error)
  }
}

const updateGrievanceStatus = async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid grievance identifier' })
  }

  const allowedFields = ['status', 'comment', 'resolution']
  if (Object.keys(req.body || {}).some((key) => !allowedFields.includes(key))) return res.status(400).json({ success: false, message: 'Unsupported update field' })
  if (req.body?.comment !== undefined && (typeof req.body.comment !== 'string' || req.body.comment.length > 1000)) return res.status(400).json({ success: false, message: 'Status explanation cannot exceed 1,000 characters' })
  const allowedResolutionFields = ['workPerformed', 'rootCause', 'materials', 'notes']
  if (req.body?.resolution !== undefined && (typeof req.body.resolution !== 'object' || req.body.resolution === null || Array.isArray(req.body.resolution) || Object.keys(req.body.resolution).some((key) => !allowedResolutionFields.includes(key)))) return res.status(400).json({ success: false, message: 'Unsupported resolution field' })
  for (const key of allowedResolutionFields) {
    const value = req.body?.resolution?.[key]
    if (value !== undefined && (typeof value !== 'string' || value.length > (key === 'notes' ? 2000 : 500))) return res.status(400).json({ success: false, message: `Invalid resolution field: ${key}` })
  }
  if (!statuses.includes(req.body.status)) {
    return res.status(400).json({ success: false, message: 'Invalid grievance status' })
  }

  try {
    const grievance = await Grievance.findById(req.params.id)

    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found' })
    }
    if (req.body.status) {
      const previousStatus = grievance.status
      const transitions = { Pending: ['In Progress', 'In-Progress', 'Resolved'], 'In Progress': ['Resolved'], 'In-Progress': ['Resolved'], Resolved: [] }
      if (!transitions[previousStatus]?.includes(req.body.status) && req.body.status !== previousStatus) return res.status(400).json({ success: false, message: 'Invalid status transition' })
      const actor = await User.findById(req.user.id).select('name role')
      if (previousStatus !== req.body.status) grievance.statusHistory.push({ previousStatus, newStatus: req.body.status, changedAt: new Date(), actor: actor._id, actorName: actor.name, actorRole: actor.role, comment: String(req.body.comment || '').slice(0, 1000) })
      grievance.status = req.body.status
      if (req.body.status === 'Resolved' && (previousStatus !== 'Resolved' || req.body.resolution !== undefined)) {
        const submittedResolution = req.body.resolution || {}
        const resolvedAt = new Date()
        const record = { ...submittedResolution, resolvedAt, resolvedBy: actor._id, updatedAt: resolvedAt }
        grievance.resolutionHistory.push(record)
        grievance.resolution = { ...(grievance.resolution?.toObject?.() || {}), ...record }
      }
    }
    await grievance.save()
    if (req.body.status) {
      const actor = await User.findById(req.user.id).select('name role')
      await AuditLog.create({ actor: actor._id, actorName: actor.name, actorRole: actor.role, action: 'grievance.status.update', targetType: 'Grievance', targetId: grievance._id.toString() })
    }
    await grievance.populate('reportedBy', 'name email username')
    return res.json({ success: true, message: 'Grievance status updated', data: grievance })
  } catch (error) {
    return next(error)
  }
}

const addComment = async (req, res, next) => {
  try {
    const text = String(req.body?.text || '').trim()
    if (!text || text.length > 2000) return res.status(400).json({ success: false, message: 'Comment must be between 1 and 2,000 characters' })
    const grievance = await Grievance.findById(req.params.id)
    if (!grievance) return res.status(404).json({ success: false, message: 'Grievance not found' })
    const actor = await User.findById(req.user.id).select('name role')
    grievance.comments.push({ text, author: actor._id, authorName: actor.name, authorRole: actor.role, createdAt: new Date() })
    await grievance.save()
    await AuditLog.create({ actor: actor._id, actorName: actor.name, actorRole: actor.role, action: 'grievance.comment.add', targetType: 'Grievance', targetId: grievance._id.toString() })
    return res.status(201).json({ success: true, data: grievance.comments.at(-1) })
  } catch (error) { return next(error) }
}

const getSummary = async (req, res, next) => {
  try {
    const match = req.user.role === 'student' ? { reportedBy: new mongoose.Types.ObjectId(req.user.id) } : {}
    const grouped = await Grievance.aggregate([{ $match: match }, { $group: { _id: { category: '$category', status: '$status' }, count: { $sum: 1 } } }])
    const categoryCounts = new Map()
    const statusCounts = new Map([['Pending', 0], ['In Progress', 0], ['Resolved', 0]])
    let total = 0
    for (const row of grouped) {
      total += row.count
      categoryCounts.set(row._id.category, (categoryCounts.get(row._id.category) || 0) + row.count)
      const status = row._id.status === 'In-Progress' ? 'In Progress' : row._id.status
      if (statusCounts.has(status)) statusCounts.set(status, statusCounts.get(status) + row.count)
    }
    const configured = await Category.find().select('name').lean()
    const categoryNames = [...new Set([...configured.map((item) => item.name), ...categoryCounts.keys()])]
    const pending = statusCounts.get('Pending')
    const inProgress = statusCounts.get('In Progress')
    const resolved = statusCounts.get('Resolved')
    res.json({ success: true, data: { total, pending, inProgress, resolved, active: pending + inProgress, resolutionRate: total ? Math.round((resolved / total) * 100) : 0, categoryData: categoryNames.map((name) => ({ name, value: categoryCounts.get(name) || 0 })), statusData: [...statusCounts].map(([name, value]) => ({ name, value })) } })
  } catch (error) { next(error) }
}

module.exports = { createGrievance, listGrievances, updateGrievanceStatus, addComment, getSummary, parsePagination, buildFilters }
