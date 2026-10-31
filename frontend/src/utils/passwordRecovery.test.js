import assert from 'node:assert/strict'
import test from 'node:test'
import { validateResetPassword } from './passwordRecovery.js'

test('rejects passwords that do not meet the current password policy', () => {
  assert.match(validateResetPassword('weak', 'weak'), /8–72 characters/)
})

test('rejects a confirmation that does not match', () => {
  assert.equal(validateResetPassword('StrongPass1', 'DifferentPass2'), 'The passwords do not match.')
})

test('accepts matching passwords that meet the policy', () => {
  assert.equal(validateResetPassword('StrongPass1', 'StrongPass1'), '')
})
