const TOKEN_KEY = 'cep_asistani_admin_token'
const USER_KEY = 'cep_asistani_admin_user'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAuthSession(loginResponse) {
  localStorage.setItem(TOKEN_KEY, loginResponse.access_token)
  localStorage.setItem(
    USER_KEY,
    JSON.stringify({
      userId: loginResponse.user_id,
      role: loginResponse.role,
      mustChangePassword: loginResponse.must_change_password,
    }),
  )
}

export function updateAuthUser(partialUser) {
  const currentUser = getAuthUser()

  if (!currentUser) return

  localStorage.setItem(USER_KEY, JSON.stringify({ ...currentUser, ...partialUser }))
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getAuthUser() {
  const storedUser = localStorage.getItem(USER_KEY)
  return storedUser ? JSON.parse(storedUser) : null
}
