const assert = require('node:assert/strict')
const path = require('node:path')
const { after, before, beforeEach, describe, it } = require('node:test')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')
const request = require('supertest')
const bcrypt = require('bcryptjs')

process.env.NODE_ENV = 'test'
process.env.MONGOMS_DOWNLOAD_DIR = path.join(__dirname, '..', '.mongodb-binaries')
process.env.JWT_SECRET = 'password-recovery-test-secret-at-least-32-characters'
process.env.JWT_EXPIRES_IN = '1h'
process.env.CLIENT_ORIGIN = 'http://localhost:5173'
process.env.PASSWORD_RESET_ORIGIN = 'http://localhost:5173'
process.env.SMTP_HOST = 'smtp.test.invalid'
process.env.SMTP_PORT = '1025'
process.env.SMTP_SECURE = 'false'
process.env.SMTP_USER = 'test-user'
process.env.SMTP_PASS = 'test-password'
process.env.MAIL_FROM = 'campus-test@example.invalid'

const { createApp } = require('../server')
const User = require('../models/User')
const emailService = require('../services/emailService')
const app = createApp()
// Give each test its own client IP so route-level rate limiters do not make
// unrelated tests depend on execution order. Requests within a test share it.
app.set('trust proxy', 'loopback')
let mongoServer
let sentMessages
let mailFailure = false
let testClientIp = 1

before(async () => {
  mongoServer = await MongoMemoryServer.create()
  await mongoose.connect(mongoServer.getUri())
})

beforeEach(async () => {
  await User.deleteMany({})
  sentMessages = []
  mailFailure = false
  testClientIp += 1
  emailService.setTestTransport({
    sendMail: async (message) => {
      if (mailFailure) throw Object.assign(new Error(`SMTP auth failed test-password ${process.env.JWT_SECRET} https://localhost/reset-password?token=${'A'.repeat(43)} ${message.to}`), { code: 'EAUTH', command: 'AUTH PLAIN', responseCode: 535, response: `rejected ${message.to}` })
      sentMessages.push(message)
      return { messageId: 'test-message' }
    },
  })
})

after(async () => {
  emailService.setTestTransport(null)
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})

const createAccount = (role, suffix) => User.create({
  name: `${role} Recovery User`,
  username: `${role}.${suffix}`,
  email: `${role}.${suffix}@example.test`,
  password: 'StrongPass1',
  role,
})
const clientRequest = (method, route) => request(app)[method](route).set('X-Forwarded-For', `198.51.100.${testClientIp}`)
const requestReset = (email) => clientRequest('post', '/api/auth/forgot-password').send({ email })
const tokenFromMail = (mail) => new URL(mail.text.match(/https?:\/\/\S+/)[0]).searchParams.get('token')
const reset = (token, newPassword = 'ReplacementPass2') => clientRequest('post', '/api/auth/reset-password').send({ token, newPassword })

describe('password recovery', () => {
  it('returns the same generic response for known, unknown, and inactive accounts', async () => {
    const student = await createAccount('student', 'generic')
    const existing = await requestReset(student.email)
    const unknown = await requestReset('unknown@example.test')
    const previouslyIssuedToken = tokenFromMail(sentMessages[0])
    student.active = false
    await student.save()
    const inactive = await requestReset(student.email)
    const inactiveReset = await reset(previouslyIssuedToken)
    assert.equal(existing.status, 202)
    assert.deepEqual(existing.body, unknown.body)
    assert.deepEqual(existing.body, inactive.body)
    assert.equal(inactiveReset.status, 400)
    assert.equal(sentMessages.length, 1)
  })

  it('validates email input and fails safely when SMTP is not configured', async () => {
    assert.equal((await requestReset('not-an-email')).status, 400)
    process.env.SMTP_HOST = ''
    const unavailable = await requestReset('mail-unconfigured@example.test')
    process.env.SMTP_HOST = 'smtp.test.invalid'
    assert.equal(unavailable.status, 503)
    assert.equal(unavailable.body.message.includes('sent'), false)
    assert.equal(sentMessages.length, 0)
  })

  it('stores only a hash and uses one token for all supported roles without changing privileges', async () => {
    for (const role of ['student', 'admin', 'resolver']) {
      const user = await createAccount(role, 'allroles')
      const response = await requestReset(user.email)
      assert.equal(response.status, 202)
      assert.equal(response.body.token, undefined)
      const mail = sentMessages.at(-1)
      assert.equal(mail.subject, 'Reset your SAREC Care password')
      assert.equal(mail.to, user.email)
      const token = tokenFromMail(mail)
      assert.match(token, /^[A-Za-z0-9_-]{43}$/)
      const record = await User.collection.findOne({ _id: user._id })
      assert.match(record.passwordReset.tokenHash, /^[a-f0-9]{64}$/)
      assert.notEqual(record.passwordReset.tokenHash, token)
      assert.ok(record.passwordReset.expiresAt > new Date())
      const result = await reset(token)
      assert.equal(result.status, 200)
      assert.equal(result.body.token, undefined)
      assert.equal(result.body.user, undefined)
      const saved = await User.findById(user._id).select('+password +passwordReset.tokenHash +tokenVersion')
      const stored = await User.collection.findOne({ _id: user._id })
      assert.equal(saved.role, role)
      assert.equal(stored.passwordReset, null)
      assert.equal(saved.tokenVersion, 1)
      assert.equal(await bcrypt.compare('ReplacementPass2', saved.password), true)
      assert.equal(JSON.stringify(saved.toJSON()).includes(record.passwordReset.tokenHash), false)
    }
  })

  it('invalidates previous links, rejects forged ownership and consumes tokens once', async () => {
    const firstUser = await createAccount('student', 'owner')
    const otherUser = await createAccount('student', 'other')
    await requestReset(firstUser.email)
    const firstToken = tokenFromMail(sentMessages.at(-1))
    await requestReset(firstUser.email)
    const secondToken = tokenFromMail(sentMessages.at(-1))
    assert.notEqual(firstToken, secondToken)
    assert.equal((await reset(firstToken)).status, 400)
    const forged = await clientRequest('post', '/api/auth/reset-password').send({ token: secondToken, newPassword: 'ReplacementPass2', userId: otherUser.id, role: 'admin' })
    assert.equal(forged.status, 400)
    assert.equal((await User.findById(otherUser._id).select('+password')).password === 'ReplacementPass2', false)
    assert.equal((await reset(secondToken)).status, 200)
    assert.equal((await reset(secondToken)).status, 400)
  })

  it('rejects expired and malformed tokens and preserves the old password', async () => {
    const user = await createAccount('resolver', 'expired')
    await requestReset(user.email)
    const token = tokenFromMail(sentMessages.at(-1))
    await User.updateOne({ _id: user._id }, { $set: { 'passwordReset.expiresAt': new Date(Date.now() - 1000) } })
    assert.equal((await reset(token)).status, 400)
    assert.equal((await reset('bad-token')).status, 400)
    const login = await clientRequest('post', '/api/auth/login').send({ username: user.username, password: 'StrongPass1' })
    assert.equal(login.status, 200)
  })

  it('requires login again after reset, and new credentials replace old credentials', async () => {
    const user = await createAccount('admin', 'sessions')
    const oldLogin = await clientRequest('post', '/api/auth/login').send({ username: user.username, password: 'StrongPass1' })
    assert.equal(oldLogin.status, 200)
    await requestReset(user.email)
    const token = tokenFromMail(sentMessages.at(-1))
    assert.equal((await reset(token)).status, 200)
    assert.equal((await clientRequest('get', '/api/grievances').set('Authorization', `Bearer ${oldLogin.body.token}`)).status, 401)
    assert.equal((await clientRequest('post', '/api/auth/login').send({ username: user.username, password: 'StrongPass1' })).status, 401)
    const newLogin = await clientRequest('post', '/api/auth/login').send({ username: user.username, password: 'ReplacementPass2' })
    assert.equal(newLogin.status, 200)
    assert.equal(newLogin.body.user.role, 'admin')
  })

  it('supports existing users without a stored token version and invalidates their legacy sessions after reset', async () => {
    const id = new mongoose.Types.ObjectId()
    await User.collection.insertOne({ _id: id, name: 'Legacy Admin', username: 'legacy.admin', email: 'legacy.admin@example.test', password: await bcrypt.hash('StrongPass1', 10), role: 'admin', createdAt: new Date(), updatedAt: new Date() })
    const login = await clientRequest('post', '/api/auth/login').send({ username: 'legacy.admin', password: 'StrongPass1' })
    assert.equal(login.status, 200)
    assert.equal((await clientRequest('get', '/api/grievances').set('Authorization', `Bearer ${login.body.token}`)).status, 200)
    await requestReset('legacy.admin@example.test')
    const token = tokenFromMail(sentMessages.at(-1))
    assert.equal((await reset(token)).status, 200)
    assert.equal((await clientRequest('get', '/api/grievances').set('Authorization', `Bearer ${login.body.token}`)).status, 401)
  })

  it('does not disclose SMTP failures and rate-limits requests by account and IP', async () => {
    const user = await createAccount('student', 'limited')
    mailFailure = true
    const originalError = console.error
    const logged = []
    console.error = (...args) => logged.push(args.join(' '))
    try {
      const failedDelivery = await requestReset(user.email)
      await new Promise((resolve) => setTimeout(resolve, 10))
      assert.equal(failedDelivery.status, 202)
      assert.equal(failedDelivery.body.message, 'If an eligible account exists for this email address, recovery instructions will be processed. If no email arrives, contact campus support.')
      assert.equal(logged.join(' ').includes(user.email), false)
      assert.equal(logged.join(' ').includes('secret smtp failure'), false)
      assert.match(logged.join(' '), /EAUTH/)
      assert.match(logged.join(' '), /535/)
      assert.equal(logged.join(' ').includes('A'.repeat(43)), false)
      assert.equal(logged.join(' ').includes(process.env.JWT_SECRET), false)
      assert.equal(logged.join(' ').includes('test-password'), false)
    } finally { console.error = originalError }

    mailFailure = false
    const rateEmail = 'rate-limited@example.test'
    for (let index = 0; index < 5; index += 1) assert.equal((await requestReset(rateEmail)).status, 202)
    assert.equal((await requestReset(rateEmail)).status, 429)
  })
})
