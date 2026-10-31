const notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` })
}

const errorHandler = (error, req, res, _next) => {
  let statusCode = error.statusCode || 500
  let message = error.message || 'An unexpected server error occurred'
  let details

  if (error.type === 'entity.parse.failed' || error instanceof SyntaxError) {
    statusCode = 400
    message = 'Request body contains invalid JSON'
  } else if (error.name === 'ValidationError') {
    statusCode = 400
    message = 'Validation failed'
    details = Object.values(error.errors).map((item) => ({ field: item.path, message: item.message }))
  } else if (error.name === 'CastError') {
    statusCode = 400
    message = 'Invalid resource identifier'
  } else if (error.name === 'VersionError') {
    statusCode = 409
    message = 'This grievance changed while you were editing it. Refresh and try again.'
  } else if (error.code === 11000) {
    statusCode = 409
    message = 'A record with one of these values already exists'
  }
  if (error.code === 'LIMIT_FILE_SIZE') { statusCode = 413; message = 'An uploaded file exceeds the configured size limit' }
  if (error.code === 'LIMIT_FILE_COUNT') { statusCode = 400; message = 'Too many files were uploaded' }
  if (error.code === 'LIMIT_UNEXPECTED_FILE') { statusCode = 400; message = 'Unexpected upload field' }
  if (error.message === 'Unsupported file type') { statusCode = 400; message = error.message }

  if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
    message = 'An unexpected server error occurred'
  }

  if (statusCode >= 500) {
  console.error('[API ERROR]', {
    method: req.method,
    path: req.originalUrl,
    errorName: error.name,
    errorMessage: error.message,
    errorCode: error.code,
    stack: error.stack,
  })
}

  const response = { success: false, message }
  if (details) response.details = details
  if (process.env.NODE_ENV !== 'production' && statusCode >= 500) {
    response.debug = error.message
  }

  return res.status(statusCode).json(response)
}

module.exports = { notFound, errorHandler }
