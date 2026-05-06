import { apiClient } from './client'
import type { ApiSavingsGoal } from '../types'

export interface SavingsGoalPayload {
  name: string
  targetAmount: number
  savedAmount?: number
  deadline?: string | null
  icon?: string
  color?: string
  note?: string | null
}

export async function getSavingsGoals(): Promise<{ data: ApiSavingsGoal[] }> {
  const { data } = await apiClient.get('/api/savings')
  return data as { data: ApiSavingsGoal[] }
}

export async function createSavingsGoal(payload: SavingsGoalPayload): Promise<{ data: ApiSavingsGoal }> {
  const { data } = await apiClient.post('/api/savings', payload)
  return data as { data: ApiSavingsGoal }
}

export async function updateSavingsGoal(
  id: string,
  payload: Partial<SavingsGoalPayload>,
): Promise<{ data: ApiSavingsGoal }> {
  const { data } = await apiClient.patch(`/api/savings/${id}`, payload)
  return data as { data: ApiSavingsGoal }
}

export async function deleteSavingsGoal(id: string): Promise<void> {
  await apiClient.delete(`/api/savings/${id}`)
}
