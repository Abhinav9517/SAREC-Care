require('dotenv').config()
const mongoose = require('mongoose')
const User = require('../models/User')
const Grievance = require('../models/Grievance')
const Category = require('../models/Category')
const CampusLocation = require('../models/CampusLocation')

async function run(mongoUri = process.env.MONGO_URI) {
  if (!mongoUri) throw new Error('MONGO_URI is not configured')
  await mongoose.connect(mongoUri, { autoIndex: false })
  try {
  const users = await User.find().select('_id email username').sort({ createdAt: 1, _id: 1 })
  const usedUsernames = new Set()
  const usernameAssignments = []
  for (const user of users) {
    const storedUsername = String(user.username || '')
    let username = storedUsername.toLowerCase()
    const migrationMarker = `mig${user._id.toString().toLowerCase()}`
    if (!/^[a-z0-9._-]{3,30}$/.test(username) || usedUsernames.has(username) || username.startsWith(migrationMarker)) {
      const emailLocalPart = String(user.email || '').split('@')[0]
      let seed = emailLocalPart.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 24) || 'user'
      if (seed.length < 3) seed = `${seed}usr`.slice(0, 3)
      username = seed; let suffix = 1
      while (usedUsernames.has(username)) {
        const suffixText = String(suffix++)
        username = `${seed.slice(0, 30 - suffixText.length)}${suffixText}`
      }
    }
    usedUsernames.add(username)
    usernameAssignments.push({ user, storedUsername, username, migrationMarker })
  }
  const reservedUsernames = new Set([
    ...users.map((user) => String(user.username || '').toLowerCase()),
    ...usernameAssignments.map((assignment) => assignment.username),
  ])
  const changedUsernames = usernameAssignments.filter(({ storedUsername, username, migrationMarker }) => storedUsername.toLowerCase() !== username || storedUsername.toLowerCase().startsWith(migrationMarker))
  // Stage every changed username first so an existing case-sensitive unique index cannot
  // block swaps such as `Legacy` -> `legacy` while the duplicate record is being renamed.
  for (const assignment of changedUsernames) {
    let temporary = assignment.migrationMarker
    let suffix = 1
    while (reservedUsernames.has(temporary)) {
      const suffixText = String(suffix++)
      temporary = `${assignment.migrationMarker.slice(0, 30 - suffixText.length)}${suffixText}`
    }
    await User.collection.updateOne({ _id: assignment.user._id }, { $set: { username: temporary } })
    reservedUsernames.add(temporary)
  }
  for (const { user, username } of changedUsernames) {
    await User.collection.updateOne({ _id: user._id }, { $set: { username } })
  }
  const allGrievances = await Grievance.find().select('_id trackingId createdAt status reportedBy statusHistory resolution resolutionHistory').sort({ createdAt: 1, _id: 1 })
  const usedTrackingIds = new Set()
  let trackingIdsAssigned = 0
  let trackingIdsRepaired = 0
  let historiesAdded = 0
  for (const grievance of allGrievances) {
    let trackingId = String(grievance.trackingId || '').trim()
    if (!trackingId || usedTrackingIds.has(trackingId.toUpperCase())) {
      const createdAt = grievance.createdAt || grievance._id.getTimestamp()
      const year = createdAt.getUTCFullYear()
      trackingId = `CGT-${year}-${grievance._id.toString().toUpperCase()}`
      let suffix = 1
      while (usedTrackingIds.has(trackingId.toUpperCase())) trackingId = `CGT-${year}-${grievance._id.toString().toUpperCase()}-${suffix++}`
      await Grievance.collection.updateOne({ _id: grievance._id }, { $set: { trackingId } })
      if (grievance.trackingId) trackingIdsRepaired += 1
      else trackingIdsAssigned += 1
    }
    usedTrackingIds.add(trackingId.toUpperCase())
    if (!grievance.statusHistory?.length) {
      const createdAt = grievance.createdAt || grievance._id.getTimestamp()
      await Grievance.collection.updateOne({ _id: grievance._id, 'statusHistory.0': { $exists: false } }, { $push: { statusHistory: { newStatus: grievance.status || 'Pending', changedAt: createdAt, actor: grievance.reportedBy, actorName: 'System migration', actorRole: 'system', comment: 'Initial status recorded during migration' } } })
      historiesAdded += 1
    }
    if (grievance.resolution?.resolvedAt && !grievance.resolutionHistory?.length) {
      await Grievance.collection.updateOne({ _id: grievance._id, 'resolutionHistory.0': { $exists: false } }, { $push: { resolutionHistory: { workPerformed: grievance.resolution.workPerformed, rootCause: grievance.resolution.rootCause, materials: grievance.resolution.materials, notes: grievance.resolution.notes, resolvedAt: grievance.resolution.resolvedAt, resolvedBy: grievance.resolution.resolvedBy, updatedAt: grievance.resolution.resolvedAt } } })
    }
  }
  for (const name of ['IT Hardware', 'Electrical', 'Plumbing', 'Housekeeping', 'Furniture', 'Internet and Networking', 'Laboratory Equipment', 'Other']) await Category.updateOne({ name }, { $setOnInsert: { name, active: true, description: '' } }, { upsert: true })
  for (const name of ['Academic Block', 'Computer Laboratory', 'Library', 'Hostel', 'Administrative Office', 'Classroom', 'Canteen', 'Other']) await CampusLocation.updateOne({ name }, { $setOnInsert: { name, active: true, description: '' } }, { upsert: true })
  const usernameIndexes = (await User.collection.indexes()).filter((index) => Object.keys(index.key || {}).length === 1 && index.key.username === 1)
  for (const index of usernameIndexes) {
    if (index.collation?.locale === 'en' && index.collation?.strength === 2 && index.unique) continue
    if (index.name !== '_id_') await User.collection.dropIndex(index.name)
  }
  await User.collection.createIndex({ username: 1 }, { unique: true, sparse: true, collation: { locale: 'en', strength: 2 } })
  await Grievance.collection.createIndex({ trackingId: 1 }, { unique: true, sparse: true })
  return { usersChecked: users.length, trackingIdsAssigned, trackingIdsRepaired, historiesAdded, grievancesChecked: allGrievances.length }
  } finally {
    await mongoose.disconnect()
  }
}
if (require.main === module) run().then((stats) => console.log(`Backfill complete: checked ${stats.usersChecked} users and ${stats.grievancesChecked} grievances; assigned ${stats.trackingIdsAssigned} tracking IDs; repaired ${stats.trackingIdsRepaired} duplicates; added ${stats.historiesAdded} initial history entries.`)).catch((error) => { console.error(error.message); process.exitCode = 1 })

module.exports = { run }
