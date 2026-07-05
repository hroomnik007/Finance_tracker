import { useAuth } from '../context/AuthContext'

export function useBudgetTemplate() {
  const { user, isGuest } = useAuth()
  if (isGuest) return false
  // If user has completed onboarding (backend flag), skip template
  if (user?.onboardingComplete) return false
  return true
}
