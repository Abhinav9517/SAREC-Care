const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/

export function validateResetPassword(password, confirmation) {
  if (!passwordPattern.test(password)) {
    return 'Use 8–72 characters with uppercase, lowercase, and a number.'
  }
  if (password !== confirmation) {
    return 'The passwords do not match.'
  }
  return ''
}
