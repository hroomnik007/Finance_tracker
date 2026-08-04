import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

// In-memory only — never localStorage/sessionStorage, so the token isn't
// readable by any script running in the page (e.g. via a future XSS bug)
// and isn't left behind after the tab closes.
let adminToken: string | null = null

export function getAdminToken(): string | null {
  return adminToken
}

export function setAdminToken(token: string): void {
  adminToken = token
}

export function clearAdminToken(): void {
  adminToken = null
}

async function adminGet<T>(path: string): Promise<T> {
  const token = getAdminToken()
  const { data } = await axios.get<T>(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return data
}

export interface AdminStats {
  totalUsers: number
  newUsers7d: number
  totalTransactions: number
  activeUsers30d: number
}

export interface AdminUser {
  id: string
  email: string
  name: string
  createdAt: string
  lastLoginAt: string | null
  emailVerified: boolean
  transactionCount: number
}

export async function fetchAdminStats(): Promise<AdminStats> {
  return adminGet<AdminStats>('/api/admin/stats')
}

export async function fetchAdminUsers(): Promise<{ users: AdminUser[] }> {
  return adminGet<{ users: AdminUser[] }>('/api/admin/users')
}
