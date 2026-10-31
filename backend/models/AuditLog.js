const mongoose = require('mongoose')
module.exports = mongoose.model('AuditLog', new mongoose.Schema({ actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, actorName: String, actorRole: String, action: { type: String, required: true }, targetType: String, targetId: String, createdAt: { type: Date, default: Date.now } }, { timestamps: false }))
