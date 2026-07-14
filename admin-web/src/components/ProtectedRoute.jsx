import { Navigate } from 'react-router-dom'
import { getAuthUser, getToken } from '../lib/authStorage'

export default function ProtectedRoute({ children, allowPasswordChange = false }) {
  if (!getToken()) {
    return <Navigate replace to="/login" />
  }

  const authUser = getAuthUser()

  if (authUser?.mustChangePassword && !allowPasswordChange) {
    return <Navigate replace to="/password-required" />
  }

  return children
}
