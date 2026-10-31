const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const { after, before, describe, it } = require('node:test')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')

process.env.NODE_ENV = 'test'
process.env.MONGOMS_DOWNLOAD_DIR = path.join(__dirname, '..', '.mongodb-binaries')

const User = require('../models/User')
const Grievance = require('../models/Grievance')
const { run } = require('../scripts/backfill')
let mongoServer

before(async () => { mongoServer = await MongoMemoryServer.create() })
after(async () => {
  if (mongoose.connection.readyState) await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
  fs.rmSync(path.join(__dirname, '..', '.test-uploads'), { recursive: true, force: true })
})

describe('safe database backfill', () => {
  it('preserves records, repairs duplicate legacy usernames, assigns unique IDs, and is rerunnable', async () => {
    const uri = mongoServer.getUri()
    await mongoose.connect(uri, { autoIndex: false })
    const firstUserId = new mongoose.Types.ObjectId()
    const secondUserId = new mongoose.Types.ObjectId()
    const now = new Date('2024-04-01T09:00:00.000Z')
    await User.collection.insertMany([
      { _id: firstUserId, name: 'Legacy One', username: 'Legacy', email: 'legacy.one@example.com', password: 'not-selected', role: 'student', active: true, createdAt: now, updatedAt: now },
      { _id: secondUserId, name: 'Legacy Two', username: 'legacy', email: 'legacy.two@example.com', password: 'not-selected', role: 'resolver', active: true, createdAt: new Date(now.getTime() + 1000), updatedAt: now },
    ])
    await User.collection.createIndex({ username: 1 }, { unique: true })
    const grievanceId = new mongoose.Types.ObjectId()
    const duplicateTrackingIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()]
    await Grievance.collection.insertMany([
      { _id: grievanceId, title: 'Old issue', description: 'Existing record must be retained in the migration.', category: 'Electrical', location: 'Old Building', reportedBy: firstUserId, status: 'Pending', createdAt: now, updatedAt: now },
      ...duplicateTrackingIds.map((_id, index) => ({ _id, title: `Legacy duplicate ${index}`, description: 'Duplicate tracking IDs are repaired without replacing the record.', category: 'Electrical', location: 'Old Building', reportedBy: secondUserId, status: 'In-Progress', trackingId: 'CGT-2024-LEGACY-DUPLICATE', createdAt: new Date(now.getTime() + (index + 2) * 1000), updatedAt: now })),
    ])
    await mongoose.disconnect()

    const firstRun = await run(uri)
    assert.equal(firstRun.usersChecked, 2)
    assert.equal(firstRun.trackingIdsAssigned, 1)
    assert.equal(firstRun.trackingIdsRepaired, 1)
    assert.equal(firstRun.historiesAdded, 3)
    const secondRun = await run(uri)
    assert.equal(secondRun.trackingIdsAssigned, 0)
    assert.equal(secondRun.trackingIdsRepaired, 0)
    assert.equal(secondRun.historiesAdded, 0)
    assert.equal(secondRun.grievancesChecked, 3)

    await mongoose.connect(uri, { autoIndex: false })
    const users = await User.collection.find({}).sort({ _id: 1 }).toArray()
    const migratedSecondUser = await User.collection.findOne({ _id: secondUserId })
    const grievance = await Grievance.collection.findOne({ _id: grievanceId })
    const duplicateGrievances = await Grievance.collection.find({ _id: { $in: duplicateTrackingIds } }).toArray()
    assert.equal(users.length, 2)
    assert.equal(new Set(users.map((user) => user.username.toLowerCase())).size, 2)
    assert.equal(migratedSecondUser.role, 'resolver')
    assert.equal(grievance.reportedBy.toString(), firstUserId.toString())
    assert.match(grievance.trackingId, /^CGT-2024-[A-F0-9]{24}$/)
    assert.equal(grievance.statusHistory.length, 1)
    assert.equal(duplicateGrievances.length, 2)
    assert.equal(new Set(duplicateGrievances.map((record) => record.trackingId)).size, 2)
    assert.equal(new Set([grievance, ...duplicateGrievances].map((record) => record.trackingId)).size, 3)
    assert.ok(duplicateGrievances.every((record) => record.reportedBy.toString() === secondUserId.toString() && record.statusHistory[0].actorRole === 'system'))
    await assert.doesNotReject(() => Grievance.collection.createIndex({ trackingId: 1 }, { unique: true, sparse: true }))
    const usernameIndex = (await User.collection.indexes()).find((index) => index.key.username === 1)
    assert.equal(usernameIndex.collation.locale, 'en')
    assert.equal(usernameIndex.collation.strength, 2)
  })
})
