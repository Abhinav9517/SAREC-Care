import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import AdminManagement from '../components/AdminManagement'
import { clearSession, getStoredUser } from '../utils/auth'

function AdminManagementPage() {
  const navigate = useNavigate(); const user = getStoredUser()
  return <div className="min-h-screen bg-mist"><Navbar user={user} onLogout={() => { clearSession(); location.assign('/') }} /><main className="mx-auto max-w-7xl space-y-4 px-5 py-8 sm:px-8"><button className="button-secondary" onClick={() => navigate('/admin')}>Back to overview</button><AdminManagement /></main></div>
}
export default AdminManagementPage
