require('dotenv').config()

const readline = require('node:readline')
const mongoose = require('mongoose')
const User = require('../models/User')
const { passwordPattern } = require('../controllers/authController')

const ask = (question, hidden = false) =>
  new Promise((resolve) => {
    const input = process.stdin
    const output = process.stdout
    let muted = false
    const rl = readline.createInterface({ input, output, terminal: true })
    if (hidden && process.stdin.isTTY) {
      process.stdin.setRawMode(true)
      muted = true
      output.write(question)
      let answer = ''
      const onData = (chunk) => {
        const key = chunk.toString()
        if (key === '\r' || key === '\n') {
          process.stdin.setRawMode(false)
          process.stdin.off('data', onData)
          output.write('\n')
          rl.close()
          resolve(answer)
        } else if (key === '\u0003') {
          process.exit(1)
        } else if (key === '\u007f') {
          answer = answer.slice(0, -1)
        } else {
          answer += key
        }
      }
      process.stdin.on('data', onData)
      return
    }
    rl.question(question, (answer) => {
      if (muted) output.write('\n')
      rl.close()
      resolve(answer)
    })
  })

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not configured')
  await mongoose.connect(process.env.MONGO_URI)
  const adminExists = await User.exists({ role: 'admin' })
  if (adminExists) {
    console.error('An administrator already exists. No changes were made.')
    return
  }

  const name = (await ask('Administrator name: ')).trim()
  const username = (await ask('Administrator username (3-30 letters, numbers, dots, underscores, or hyphens): ')).trim().toLowerCase()
  const email = (await ask('Administrator email: ')).trim().toLowerCase()
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD || (await ask('Administrator password: ', true))
  if (name.length < 2 || name.length > 80 || !/^[a-z0-9._-]{3,30}$/.test(username) || !/^\S+@\S+\.\S+$/.test(email) || !passwordPattern.test(password)) {
    throw new Error('Name, username, email, or password does not meet the required format')
  }

  await User.create({ name, username, email, password, role: 'admin' })
  console.log('Administrator account created. Remove ADMIN_BOOTSTRAP_PASSWORD from your shell if it was used.')
}

run()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
