require('dotenv').config()

const { verifyMailTransport } = require('../services/emailService')

verifyMailTransport().then((result) => {
  if (!result.ok) process.exitCode = 1
}).catch(() => {
  console.error('SMTP diagnostic could not complete.')
  process.exitCode = 1
})
