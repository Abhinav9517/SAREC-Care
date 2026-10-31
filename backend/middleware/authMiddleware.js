const jwt = require('jsonwebtoken')
const User = require('../models/User')

const unauthorized = (res, message = 'Authentication required') =>
  res.status(401).json({ success: false, message })

const authenticate = async (req, res, next) => {
  const header = req.get('authorization')
  if (!header || !header.startsWith('Bearer ')) {
    return unauthorized(res)
  }

  const token = header.slice(7).trim()
  if (!token) {
    return unauthorized(res, 'A valid bearer token is required')
  }

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT secret is not configured')
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET)
    if (
      !payload ||
      typeof payload.sub !== 'string' ||
      !['student', 'admin', 'resolver'].includes(payload.role)
    ) {
      return unauthorized(res, 'Invalid authentication token')
    }

    const user = await User.findById(payload.sub).select('_id role active mustChangePassword +tokenVersion')
    if (!user || user.role !== payload.role || !user.active || (payload.ver ?? 0) !== (user.tokenVersion || 0)) {
      return unauthorized(res, 'Invalid authentication token')
    }
    if (user.mustChangePassword && req.originalUrl.split('?')[0] !== '/api/auth/change-password') return res.status(403).json({ success: false, message: 'Change the temporary password before continuing' })

    req.user = { id: user._id.toString(), role: user.role }
    return next()
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return unauthorized(res, 'Authentication token has expired')
    }
    return unauthorized(res, 'Invalid authentication token')
  }
}

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'You do not have permission to perform this action' })
  }
  return next()
}

module.exports = { authenticate, authorize }
