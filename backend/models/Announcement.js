const mongoose = require('mongoose')

module.exports = mongoose.model('Announcement', new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  text: { type: String, required: true, trim: true, maxlength: 4000 },
  image: { type: String, default: '' },
  imageAttachment: { storageName: String, originalName: String, mimeType: String, size: Number, uploadedAt: Date, uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } },
  published: { type: Boolean, default: false },
  popup: { type: Boolean, default: true },
  mandatory: { type: Boolean, default: false },
  startsAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null },
  acknowledgements: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, at: Date }],
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true }))
