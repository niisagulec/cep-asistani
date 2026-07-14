import { api } from './api';
import { clearAccessToken, saveAccessToken } from './tokenStorage';

export async function login(email, password) {
  const response = await api.post('/auth/login', {
    email,
    password,
  });

  await saveAccessToken(response.data.access_token);

  return response.data;
}

export async function getCurrentUser() {
  const response = await api.get('/auth/me');
  return response.data;
}

export async function logout() {
  await clearAccessToken();
}
