import { useState, useEffect } from 'react'
import { X, ChevronRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

interface OnboardingStep {
  title: string
  description: string
  emoji: string
  elementId?: string
}

const STEPS: OnboardingStep[] = [
  {
    title: 'Vitajte vo Finvu!',
    description: 'Toto je váš prehľad financií. Tu vidíte súhrn príjmov, výdavkov a zostatok na jeden pohľad.',
    emoji: '🎉',
  },
  {
    title: 'Pridajte príjmy',
    description: 'Kliknite na "Príjmy" v menu a pridajte váš plat alebo iné príjmy pomocou tlačidla +.',
    emoji: '💰',
  },
  {
    title: 'Sledujte výdavky',
    description: 'V sekcii "Výdavky" zaznamenajte nákupy podľa kategórií a sledujte, kam idú vaše peniaze.',
    emoji: '📊',
  },
  {
    title: 'Nastavenia',
    description: 'V nastaveniach si prispôsobíte kategórie, limity rozpočtu, menu a ďalšie predvoľby.',
    emoji: '⚙️',
  },
]

export function useOnboarding() {
  const { user, isLoading, isGuest, completeOnboarding: saveOnboarding } = useAuth()
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    if (isLoading) return
    if (isGuest) { setShowOnboarding(false); return }
    if (user && !user.onboardingComplete) setShowOnboarding(true)
    else setShowOnboarding(false)
  }, [user, isLoading, isGuest])

  async function completeOnboarding() {
    setShowOnboarding(false)
    await saveOnboarding()
  }

  return { showOnboarding, completeOnboarding }
}

interface OnboardingTutorialProps {
  onComplete: () => void
}

export function OnboardingTutorial({ onComplete }: OnboardingTutorialProps) {
  const [step, setStep] = useState(0)
  const [exiting, setExiting] = useState(false)

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  function handleNext() {
    if (isLast) {
      handleComplete()
    } else {
      setStep(s => s + 1)
    }
  }

  function handleComplete() {
    setExiting(true)
    setTimeout(onComplete, 300)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: 'rgba(13,10,26,0.85)',
        backdropFilter: 'blur(6px)',
        opacity: exiting ? 0 : 1,
        transition: 'opacity 0.3s ease',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'linear-gradient(135deg, #1E1535, #2D1F5E)',
          border: '1px solid #4C3A8A',
          borderRadius: '24px',
          padding: '32px 28px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          position: 'relative',
        }}
      >
        {/* Close button */}
        <button
          onClick={handleComplete}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#9D84D4',
          }}
        >
          <X size={16} />
        </button>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '28px' }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                height: '3px',
                flex: 1,
                borderRadius: '2px',
                backgroundColor: i <= step ? '#7C3AED' : '#4C3A8A',
                transition: 'background-color 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* Emoji */}
        <div style={{ fontSize: '56px', marginBottom: '20px', textAlign: 'center' }}>
          {current.emoji}
        </div>

        {/* Title */}
        <h2 style={{
          fontSize: '22px',
          fontWeight: 700,
          color: '#E2D9F3',
          marginBottom: '12px',
          textAlign: 'center',
        }}>
          {current.title}
        </h2>

        {/* Description */}
        <p style={{
          fontSize: '15px',
          color: '#B8A3E8',
          lineHeight: 1.6,
          textAlign: 'center',
          marginBottom: '32px',
        }}>
          {current.description}
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleComplete}
            style={{
              flex: 1,
              height: '48px',
              background: 'transparent',
              border: '1px solid #4C3A8A',
              borderRadius: '14px',
              color: '#9D84D4',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Preskočiť
          </button>
          <button
            onClick={handleNext}
            style={{
              flex: 2,
              height: '48px',
              background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
              border: 'none',
              borderRadius: '14px',
              color: 'white',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            {isLast ? 'Začať!' : 'Ďalej'}
            {!isLast && <ChevronRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  )
}
