const bcrypt = require('bcryptjs')
const mongoose = require('mongoose')

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [160, 'Email cannot exceed 160 characters'],
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email'],
    },
    username: { type: String, required: true, lowercase: true, trim: true, minlength: 3, maxlength: 30, match: /^[a-z0-9._-]+$/i },
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
    },
    role: {
      type: String,
      enum: ['student', 'admin', 'resolver'],
      default: 'student',
    },
    active: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    tokenVersion: { type: Number, default: 0, select: false },
    passwordReset: {
      tokenHash: { type: String, select: false },
      createdAt: Date,
      expiresAt: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.password
        delete ret.passwordReset
        delete ret.tokenVersion
        delete ret.__v
        ret.id = ret._id.toString()
        delete ret._id
        return ret
      },
    },
  },
)

userSchema.index({ username: 1 }, { unique: true, sparse: true, collation: { locale: 'en', strength: 2 } })

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) {
    return
  }

  this.password = await bcrypt.hash(this.password, 10)
})

module.exports = mongoose.model('User', userSchema)
