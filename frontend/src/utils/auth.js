const TOKEN_KEY = 'campus_grievance_token'
const USER_KEY = 'campus_grievance_user'

const isValidUser = (user) => Boolean(
  user && typeof user === 'object' && typeof user.id === 'string' && typeof user.name === 'string' && typeof user.email === 'string' && ['student', 'admin', 'resolver'].includes(user.role),
)

export const getToken = () => {
  try {
    const token = window.localStorage.getItem(TOKEN_KEY)
    return token && token.trim() ? token : null
  } catch { return null }
}

export const getStoredUser = () => {
  try {
    const rawUser = window.localStorage.getItem(USER_KEY)
    if (!rawUser) return null
    const user = JSON.parse(rawUser)
    return isValidUser(user) ? user : null
  } catch { return null }
}

export const getStoredSession = () => {
  const token = getToken()
  const user = getStoredUser()
  return token && user ? { token, user } : null
}

export const saveSession = (token, user) => {
  if (!token || !isValidUser(user)) throw new Error('The server returned an invalid authentication session')
  window.localStorage.setItem(TOKEN_KEY, token)
  window.localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export const clearSession = () => {
  try {
    window.localStorage.removeItem(TOKEN_KEY)
    window.localStorage.removeItem(USER_KEY)
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

export const isUsableUser = isValidUser
