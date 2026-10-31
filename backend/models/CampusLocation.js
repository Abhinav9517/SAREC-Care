const mongoose = require('mongoose')
module.exports = mongoose.model('CampusLocation', new mongoose.Schema({ name: { type: String, required: true, trim: true, maxlength: 120 }, description: { type: String, maxlength: 500, default: '' }, active: { type: Boolean, default: true } }, { timestamps: true }))
