import { Navigate } from 'react-router-dom'

import { getStoredSession } from '../utils/auth'

function ProtectedRoute({ roles, children }) {
  const session = getStoredSession()
  if (!session) return <Navigate to="/" replace />
  if (roles && !roles.includes(session.user.role)) return <Navigate to={`/${session.user.role}`} replace />
  return children
}

export default ProtectedRoute
