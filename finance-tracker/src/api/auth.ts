import { apiClient } from './client'
import type { AuthUser } from '../types'

export async function login(email: string, password: string): Promise<{ user: AuthUser; accessToken: string }> {
  const { data } = await apiClient.post('/api/auth/login', { email, password })
  return data
}

export async function register(
  email: string,
  password: string,
  name: string
): Promise<{ user: AuthUser; accessToken: string }> {
  const { data } = await apiClient.post('/api/auth/register', { email, password, name })
  return data
}

export async function logout(): Promise<void> {
  await apiClient.post('/api/auth/logout')
}

export async function refreshToken(): Promise<{ accessToken: string }> {
  const { data } = await apiClient.post('/api/auth/refresh')
  return data
}

export async function getMe(): Promise<{ user: AuthUser }> {
  const { data } = await apiClient.get('/api/auth/me')
  return data
}
