const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const { after, before, beforeEach, describe, it } = require('node:test')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')
const request = require('supertest')
const jwt = require('jsonwebtoken')

process.env.NODE_ENV = 'test'
process.env.MONGOMS_DOWNLOAD_DIR = path.join(__dirname, '..', '.mongodb-binaries')
process.env.JWT_SECRET = 'test-only-secret-that-is-long-enough-for-tests'
process.env.JWT_EXPIRES_IN = '1h'
process.env.CLIENT_ORIGIN = 'http://localhost:5173'
process.env.UPLOAD_MAX_FILE_BYTES = '1024'
process.env.UPLOAD_DIR = path.join(__dirname, '..', '.test-uploads')

const { createApp } = require('../server')
const User = require('../models/User')
const Grievance = require('../models/Grievance')

const app = createApp()
let mongoServer
let student
let secondStudent
let admin
let resolver
let studentToken
let secondStudentToken
let adminToken
let resolverToken

const tokenFor = (user) => jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET)

before(async () => {
  mongoServer = await MongoMemoryServer.create()
  await mongoose.connect(mongoServer.getUri())
})

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Grievance.deleteMany({})])
  student = await User.create({ name: 'Primary Student', username: 'primary.student', email: 'primary@example.com', password: 'StrongPass1' })
  secondStudent = await User.create({ name: 'Second Student', username: 'second.student', email: 'second@example.com', password: 'StrongPass1' })
  admin = await User.create({ name: 'Campus Admin', username: 'campus.admin', email: 'admin@example.com', password: 'StrongPass1', role: 'admin' })
  resolver = await User.create({ name: 'Campus Resolver', username: 'campus.resolver', email: 'resolver@example.com', password: 'StrongPass1', role: 'resolver' })
  studentToken = tokenFor(student)
  secondStudentToken = tokenFor(secondStudent)
  adminToken = tokenFor(admin)
  resolverToken = tokenFor(resolver)
})

after(async () => {
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})

const payload = {
  title: 'Projector is not working',
  description: 'The projector in room B-204 does not power on during lectures.',
  category: 'IT Hardware',
  location: 'Academic Block B, room 204',
}

describe('grievance API', () => {
  it('generates distinct tracking IDs for concurrent submissions', async () => {
    const submit = () => request(app).post('/api/grievances').set('Authorization', `Bearer ${studentToken}`).send(payload)
    const results = await Promise.all([submit(), submit()])
    assert.deepEqual(results.map((result) => result.status), [201, 201])
    const ids = results.map((result) => result.body.data.trackingId)
    assert.equal(new Set(ids).size, 2)
  })

  it('allows students to create and retrieve only their own grievances', async () => {
    const created = await request(app).post('/api/grievances')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ ...payload, reportedBy: secondStudent._id.toString(), status: 'Resolved' })
    assert.equal(created.status, 201)
    assert.equal(created.body.data.status, 'Pending')
    assert.match(created.body.data.trackingId, /^CGT-\d{4}-\d{6}-[A-F0-9]{24}$/)
    assert.equal(created.body.data.reportedBy.email, student.email)

    const own = await request(app).get('/api/grievances').set('Authorization', `Bearer ${studentToken}`)
    assert.equal(own.status, 200)
    assert.equal(own.body.data.length, 1)
    assert.equal(own.body.data[0].reportedBy.email, student.email)

    const second = await request(app).get('/api/grievances').set('Authorization', `Bearer ${secondStudentToken}`)
    assert.equal(second.status, 200)
    assert.equal(second.body.data.length, 0)
  })

  it('rejects unauthenticated creation and allows admins to retrieve all records', async () => {
    const unauthenticated = await request(app).post('/api/grievances').send(payload)
    assert.equal(unauthenticated.status, 401)
    await Grievance.create({ ...payload, reportedBy: student._id })
    const response = await request(app).get('/api/grievances?all=true').set('Authorization', `Bearer ${adminToken}`)
    assert.equal(response.status, 200)
    assert.equal(response.body.data.length, 1)
  })

  it('restricts status changes to admins and validates the status', async () => {
    const grievance = await Grievance.create({ ...payload, reportedBy: student._id })
    const forbidden = await request(app).put(`/api/grievances/${grievance._id}`)
      .set('Authorization', `Bearer ${studentToken}`).send({ status: 'Resolved' })
    assert.equal(forbidden.status, 403)

    const invalid = await request(app).put(`/api/grievances/${grievance._id}`)
      .set('Authorization', `Bearer ${adminToken}`).send({ status: 'Closed' })
    assert.equal(invalid.status, 400)

    const updated = await request(app).put(`/api/grievances/${grievance._id}`)
      .set('Authorization', `Bearer ${adminToken}`).send({ status: 'Resolved' })
    assert.equal(updated.status, 200)
    assert.equal(updated.body.data.status, 'Resolved')
    assert.equal(updated.body.data.statusHistory.length, 1)
    assert.equal(updated.body.data.statusHistory[0].previousStatus, 'Pending')
    assert.equal(updated.body.data.statusHistory[0].actorRole, 'admin')
    assert.ok(Date.parse(updated.body.data.statusHistory[0].changedAt))

    const directResolution = await Grievance.create({ ...payload, reportedBy: student._id })
    const resolvedWithoutNotes = await request(app).put(`/api/grievances/${directResolution._id}`)
      .set('Authorization', `Bearer ${adminToken}`).send({ status: 'Resolved' })
    assert.equal(resolvedWithoutNotes.status, 200)
    assert.equal(resolvedWithoutNotes.body.data.resolution.resolvedBy.toString(), admin._id.toString())
    assert.ok(Date.parse(resolvedWithoutNotes.body.data.resolution.resolvedAt))
    assert.equal(resolvedWithoutNotes.body.data.resolutionHistory.length, 1)
  })

  it('returns useful errors for invalid and nonexistent identifiers', async () => {
    const invalid = await request(app).put('/api/grievances/not-an-id')
      .set('Authorization', `Bearer ${adminToken}`).send({ status: 'Resolved' })
    assert.equal(invalid.status, 400)
    const missing = await request(app).put(`/api/grievances/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${adminToken}`).send({ status: 'Resolved' })
    assert.equal(missing.status, 404)
  })

  it('accepts private image/video attachments and enforces grievance ownership', async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0xd9])
    const video = Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d])
    const created = await request(app).post('/api/grievances').set('Authorization', `Bearer ${studentToken}`).field('title', payload.title).field('description', payload.description).field('category', payload.category).field('location', payload.location).attach('attachments', jpeg, { filename: 'evidence.jpg', contentType: 'image/jpeg' }).attach('attachments', video, { filename: 'clip.mp4', contentType: 'video/mp4' })
    assert.equal(created.status, 201)
    assert.equal(created.body.data.attachments.length, 2)
    const storageName = created.body.data.attachments[0].storageName
    assert.equal(fs.existsSync(path.join(require('../middleware/uploadMiddleware').uploadRoot, storageName)), true, `upload root=${require('../middleware/uploadMiddleware').uploadRoot}`)
    const ownFile = await request(app).get(`/api/grievances/${created.body.data._id}/attachments/${storageName}`).set('Authorization', `Bearer ${studentToken}`)
    assert.equal(ownFile.status, 200)
    const videoName = created.body.data.attachments[1].storageName
    assert.equal((await request(app).get(`/api/grievances/${created.body.data._id}/attachments/${videoName}`).set('Authorization', `Bearer ${studentToken}`)).status, 200)
    const adminFile = await request(app).get(`/api/grievances/${created.body.data._id}/attachments/${storageName}`).set('Authorization', `Bearer ${adminToken}`)
    assert.equal(adminFile.status, 200)
    const resolverFile = await request(app).get(`/api/grievances/${created.body.data._id}/attachments/${storageName}`).set('Authorization', `Bearer ${resolverToken}`)
    assert.equal(resolverFile.status, 200)
    const forbidden = await request(app).get(`/api/grievances/${created.body.data._id}/attachments/${storageName}`).set('Authorization', `Bearer ${secondStudentToken}`)
    assert.equal(forbidden.status, 404)
    const missingFile = await request(app).get(`/api/grievances/${created.body.data._id}/attachments/${new mongoose.Types.ObjectId()}.bin`).set('Authorization', `Bearer ${studentToken}`)
    assert.equal(missingFile.status, 404)
    const unsupported = await request(app).post('/api/grievances').set('Authorization', `Bearer ${studentToken}`).field('title', payload.title).field('description', payload.description).field('category', payload.category).field('location', payload.location).attach('attachments', Buffer.from('unsafe'), { filename: 'bad.exe', contentType: 'application/octet-stream' })
    assert.equal(unsupported.status, 400)
    const spoofed = await request(app).post('/api/grievances').set('Authorization', `Bearer ${studentToken}`).field('title', payload.title).field('description', payload.description).field('category', payload.category).field('location', payload.location).attach('attachments', Buffer.from('not really jpeg'), { filename: 'spoof.jpg', contentType: 'image/jpeg' })
    assert.equal(spoofed.status, 400)
    const tooLarge = await request(app).post('/api/grievances').set('Authorization', `Bearer ${studentToken}`).field('title', payload.title).field('description', payload.description).field('category', payload.category).field('location', payload.location).attach('attachments', Buffer.alloc(1025, 0), { filename: 'large.jpg', contentType: 'image/jpeg' })
    assert.equal(tooLarge.status, 413)
    let excessive = request(app).post('/api/grievances').set('Authorization', `Bearer ${studentToken}`).field('title', payload.title).field('description', payload.description).field('category', payload.category).field('location', payload.location)
    for (let index = 0; index < 6; index += 1) excessive = excessive.attach('attachments', jpeg, { filename: `image-${index}.jpg`, contentType: 'image/jpeg' })
    assert.equal((await excessive).status, 400)
    assert.equal((await request(app).delete(`/api/grievances/${created.body.data._id}/attachments/${storageName}`).set('Authorization', `Bearer ${secondStudentToken}`)).status, 404)
    assert.equal((await request(app).delete(`/api/grievances/${created.body.data._id}/attachments/${storageName}`).set('Authorization', `Bearer ${studentToken}`)).status, 200)
    assert.equal((await request(app).get(`/api/grievances/${created.body.data._id}/attachments/${storageName}`).set('Authorization', `Bearer ${studentToken}`)).status, 404)
    const videoPath = path.join(require('../middleware/uploadMiddleware').uploadRoot, videoName)
    fs.unlinkSync(videoPath)
    assert.equal((await request(app).get(`/api/grievances/${created.body.data._id}/attachments/${videoName}`).set('Authorization', `Bearer ${studentToken}`)).status, 404)
  })
})
