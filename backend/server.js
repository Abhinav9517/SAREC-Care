require('dotenv').config()

const http = require('node:http')
const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const authRoutes = require('./routes/authRoutes')
const grievanceRoutes = require('./routes/grievanceRoutes')
const adminRoutes = require('./routes/adminRoutes')
const announcementRoutes = require('./routes/announcementRoutes')
const catalogRoutes = require('./routes/catalogRoutes')
const { errorHandler, notFound } = require('./middleware/errorMiddleware')

const createApp = () => {
  const app = express()
  const defaultOrigin = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173'
  const allowedOrigins = (process.env.CLIENT_ORIGIN || defaultOrigin)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  app.disable('x-powered-by')
  app.use(cors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin || allowedOrigins.includes(requestOrigin)) return callback(null, true)
      return callback(new Error('Origin is not allowed by the server CORS policy'))
    },
    credentials: true,
  }))
  app.use(express.json({ limit: '10kb' }))
  app.use(express.urlencoded({ extended: false, limit: '10kb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' })
  })
  app.use('/api/auth', authRoutes)
  app.use('/api/grievances', grievanceRoutes)
  app.use('/api/admin', adminRoutes)
  app.use('/api/announcements', announcementRoutes)
  app.use('/api/catalog', catalogRoutes)
  app.use(notFound)
  app.use(errorHandler)
  return app
}

const connectDatabase = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not configured')
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters')
  }
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 })
  } catch (error) {
    if (error.name === 'MongooseServerSelectionError' && /ECONNREFUSED/.test(error.message)) {
      throw new Error('MongoDB is not accepting connections. Start the local MongoDB service or set MONGO_URI to a reachable MongoDB Atlas connection.')
    }
    throw error
  }
}

const startServer = async () => {
  if (process.env.NODE_ENV === 'production') {
    const origins = (process.env.CLIENT_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean)
    if (!origins.length || origins.some((origin) => {
      try { const parsed = new URL(origin); return parsed.protocol !== 'https:' || parsed.origin !== origin }
      catch { return true }
    })) throw new Error('CLIENT_ORIGIN must contain one or more HTTPS frontend origins in production')
  }
  await connectDatabase()
  const app = createApp()
  const port = Number.parseInt(process.env.PORT || '5000', 10)
  const server = http.createServer(app)
  try {
    await new Promise((resolve, reject) => {
      const onError = (error) => { server.off('listening', onListening); reject(error) }
      const onListening = () => { server.off('error', onError); resolve() }
      server.once('error', onError)
      server.once('listening', onListening)
      server.listen(port)
    })
  } catch (error) {
    await mongoose.disconnect()
    throw error
  }
  console.log(`SAREC Care API listening on port ${server.address().port}`)

  const shutdown = async (signal) => {
    console.log(`Received ${signal}; closing server gracefully`)
    await new Promise((resolve) => server.close(resolve))
    await mongoose.disconnect()
    process.exit(0)
  }
  process.once('SIGINT', () => shutdown('SIGINT'))
  process.once('SIGTERM', () => shutdown('SIGTERM'))
  return server
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error(`Server startup failed: ${error.message}`)
    process.exit(1)
  })
}

module.exports = { createApp, connectDatabase, startServer }
