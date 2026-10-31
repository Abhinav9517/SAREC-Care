import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const Auth = lazy(() => import('./pages/Auth'))
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'))
const ResolverDashboard = lazy(() => import('./pages/ResolverDashboard'))
const AdminManagementPage = lazy(() => import('./pages/AdminManagementPage'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const LandingPage = lazy(() => import('./pages/LandingPage'))
import ProtectedRoute from './components/ProtectedRoute'
import { getStoredSession } from './utils/auth'
import LoadingState from './components/LoadingState'

function PublicRoute() {
  const session = getStoredSession()
  if (session) return <Navigate to={`/${session.user.role}`} replace />
  return <LandingPage />
}

function App() {
  return <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-mist px-5"><LoadingState label="Loading SAREC Care…" /></main>}><Routes><Route path="/" element={<PublicRoute />} /><Route path="/login" element={<Auth />} /><Route path="/forgot-password" element={<ForgotPassword />} /><Route path="/reset-password" element={<ResetPassword />} /><Route path="/student" element={<ProtectedRoute roles={['student']}><StudentDashboard /></ProtectedRoute>} /><Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} /><Route path="/admin/manage" element={<ProtectedRoute roles={['admin']}><AdminManagementPage /></ProtectedRoute>} /><Route path="/resolver" element={<ProtectedRoute roles={['resolver']}><ResolverDashboard /></ProtectedRoute>} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></Suspense>
}

export default App
