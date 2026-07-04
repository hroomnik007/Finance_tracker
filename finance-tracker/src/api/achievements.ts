import { apiClient } from './client'

export interface AchievementState {
  key: string
  unlocked: boolean
  unlockedAt: string | null
}

export function getAchievements(): Promise<{ data: AchievementState[] }> {
  return apiClient.get<{ data: AchievementState[] }>('/api/achievements').then(r => r.data)
}
