import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import AttendancePage from './pages/AttendancePage'
import CafeteriaPage from './pages/CafeteriaPage'
import DashboardPage from './pages/DashboardPage'
import EmployeesPage from './pages/EmployeesPage'
import FeedbacksPage from './pages/FeedbacksPage'
import LoginPage from './pages/LoginPage'
import PasswordRequiredPage from './pages/PasswordRequiredPage'
import SettingsPage from './pages/SettingsPage'
import ShuttlePage from './pages/ShuttlePage'

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/password-required',
    element: (
      <ProtectedRoute allowPasswordChange>
        <PasswordRequiredPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'employees', element: <EmployeesPage /> },
      { path: 'attendance', element: <AttendancePage /> },
      { path: 'cafeteria', element: <CafeteriaPage /> },
      { path: 'shuttles', element: <ShuttlePage /> },
      { path: 'feedbacks', element: <FeedbacksPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
