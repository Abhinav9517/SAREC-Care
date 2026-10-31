const mongoose = require('mongoose')

const categories = ['IT Hardware', 'Electrical', 'Plumbing', 'Housekeeping']
const statuses = ['Pending', 'In Progress', 'In-Progress', 'Resolved']

const grievanceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [4, 'Title must be at least 4 characters'],
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [2000, 'Description cannot exceed 2,000 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      // Names are retained as snapshots so category renames never rewrite history.
      maxlength: [80, 'Category cannot exceed 80 characters'],
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
      minlength: [2, 'Location must be at least 2 characters'],
      maxlength: [160, 'Location cannot exceed 160 characters'],
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reporter is required'],
      index: true,
    },
    status: {
      type: String,
      enum: statuses,
      default: 'Pending',
      index: true,
    },
    trackingId: { type: String, immutable: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'CampusLocation' },
    statusHistory: [{ previousStatus: String, newStatus: String, changedAt: { type: Date, default: Date.now }, actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, actorName: String, actorRole: String, comment: { type: String, maxlength: 1000 } }],
    comments: [{ text: { type: String, required: true, maxlength: 2000 }, author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, authorName: String, authorRole: String, createdAt: { type: Date, default: Date.now } }],
    attachments: [{ storageName: String, originalName: String, mimeType: String, size: Number, uploadedAt: { type: Date, default: Date.now }, uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } }],
    resolution: { workPerformed: String, rootCause: String, materials: String, notes: String, resolvedAt: Date, resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, evidence: [{ storageName: String, originalName: String, mimeType: String, size: Number, uploadedAt: Date, uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } }] },
    resolutionHistory: [{ workPerformed: { type: String, maxlength: 500 }, rootCause: { type: String, maxlength: 500 }, materials: { type: String, maxlength: 500 }, notes: { type: String, maxlength: 2000 }, resolvedAt: { type: Date, required: true }, resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, updatedAt: { type: Date, default: Date.now } }],
  },
  { timestamps: true, optimisticConcurrency: true },
)

grievanceSchema.index({ reportedBy: 1, createdAt: -1 })
grievanceSchema.index({ category: 1, status: 1, createdAt: -1 })
grievanceSchema.index({ trackingId: 1 }, { unique: true, sparse: true })

module.exports = mongoose.model('Grievance', grievanceSchema)
module.exports.categories = categories
module.exports.statuses = statuses
