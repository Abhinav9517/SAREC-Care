const assert = require('node:assert/strict')
const path = require('node:path')
const { after, before, beforeEach, describe, it } = require('node:test')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')
const request = require('supertest')
const bcrypt = require('bcryptjs')

process.env.NODE_ENV = 'test'
process.env.MONGOMS_DOWNLOAD_DIR = path.join(__dirname, '..', '.mongodb-binaries')
process.env.JWT_SECRET = 'test-only-secret-that-is-long-enough-for-tests'
process.env.JWT_EXPIRES_IN = '1h'
process.env.CLIENT_ORIGIN = 'http://localhost:5173'
process.env.UPLOAD_MAX_FILE_BYTES = '1024'
process.env.UPLOAD_DIR = path.join(__dirname, '..', '.test-uploads')

const { createApp } = require('../server')
const User = require('../models/User')

const app = createApp()
let mongoServer

before(async () => {
  mongoServer = await MongoMemoryServer.create()
  await mongoose.connect(mongoServer.getUri())
})

beforeEach(async () => {
  await User.deleteMany({})
})

after(async () => {
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})

describe('authentication API', () => {
  it('registers a student and stores a password hash', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Asha Student',
      email: 'asha@example.com',
      username: 'asha.student',
      password: 'StrongPass1',
      role: 'admin',
    })

    assert.equal(response.status, 201)
    assert.equal(response.body.data.user.role, 'student')
    assert.equal(response.body.data.user.password, undefined)
    const user = await User.findOne({ email: 'asha@example.com' }).select('+password')
    assert.ok(user.password.startsWith('$2'))
    assert.notEqual(user.password, 'StrongPass1')
    assert.equal(await bcrypt.compare('StrongPass1', user.password), true)
  })

  it('rejects duplicate registrations', async () => {
    const payload = { name: 'Asha Student', email: 'asha@example.com', username: 'asha', password: 'StrongPass1' }
    await request(app).post('/api/auth/register').send(payload)
    const response = await request(app).post('/api/auth/register').send(payload)
    assert.equal(response.status, 409)
  })

  it('logs in with valid credentials and rejects an invalid password', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Asha Student', email: 'asha@example.com', username: 'asha', password: 'StrongPass1',
    })
    const success = await request(app).post('/api/auth/login').send({ username: 'ASHA', password: 'StrongPass1' })
    assert.equal(success.status, 200)
    assert.ok(success.body.token)
    assert.equal(success.body.user.role, 'student')

    const failure = await request(app).post('/api/auth/login').send({ username: 'asha', password: 'WrongPass1' })
    assert.equal(failure.status, 401)
    assert.equal(failure.body.token, undefined)
  })

  it('requires unique usernames and does not allow privileged self-registration', async () => {
    const payload = { name: 'Asha Student', email: 'asha@example.com', username: 'Asha', password: 'StrongPass1', role: 'admin' }
    const first = await request(app).post('/api/auth/register').send(payload)
    assert.equal(first.status, 201)
    assert.equal(first.body.data.user.role, 'student')
    const duplicate = await request(app).post('/api/auth/register').send({ ...payload, email: 'other@example.com', username: 'asha' })
    assert.equal(duplicate.status, 409)
  })

  it('allows a legacy email sign-in and assigns a safe username before returning the session', async () => {
    const legacyId = new mongoose.Types.ObjectId()
    const now = new Date()
    await User.collection.insertOne({ _id: legacyId, name: 'Legacy Account', email: 'legacy.account@example.com', password: await bcrypt.hash('StrongPass1', 10), role: 'student', active: true, createdAt: now, updatedAt: now })
    const response = await request(app).post('/api/auth/login').send({ email: 'LEGACY.ACCOUNT@example.com', password: 'StrongPass1' })
    assert.equal(response.status, 200)
    assert.equal(response.body.user.username, 'legacy.account')
    const saved = await User.collection.findOne({ _id: legacyId })
    assert.equal(saved.username, 'legacy.account')
  })

  it('rejects missing and invalid tokens', async () => {
    const missing = await request(app).get('/api/grievances')
    assert.equal(missing.status, 401)
    const invalid = await request(app).get('/api/grievances').set('Authorization', 'Bearer not-a-real-token')
    assert.equal(invalid.status, 401)
  })
})
