const express = require('express')
const crypto = require('node:crypto')
const { rateLimit, ipKeyGenerator } = require('express-rate-limit')
const { login, register, changePassword, forgotPassword, resetPassword } = require('../controllers/authController')
const { authenticate } = require('../middleware/authMiddleware')
const asyncHandler = require('../utils/asyncHandler')

const router = express.Router()
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts. Please try again later.' },
})
const recoveryIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Password recovery requests are temporarily limited. Please wait before trying again.' },
})
const recoveryAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${crypto.createHash('sha256').update(String(req.body?.email || '').trim().toLowerCase()).digest('hex')}`,
  message: { success: false, message: 'Password recovery requests are temporarily limited. Please wait before trying again.' },
})
const resetAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many reset attempts. Request a new password reset link later.' },
})

router.post('/register', authLimiter, asyncHandler(register))
router.post('/login', authLimiter, asyncHandler(login))
router.post('/forgot-password', recoveryIpLimiter, recoveryAccountLimiter, asyncHandler(forgotPassword))
router.post('/reset-password', resetAttemptLimiter, asyncHandler(resetPassword))
router.post('/change-password', authenticate, asyncHandler(changePassword))

module.exports = router
