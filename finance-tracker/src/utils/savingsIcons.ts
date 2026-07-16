import type { LucideIcon } from 'lucide-react'
import {
  Target, Palmtree, Car, Home, Laptop, Plane, GraduationCap,
  Gem, Gamepad2, Baby, Wallet, Gift, Dumbbell,
} from 'lucide-react'

// Savings goals pick from their own emoji preset (see Savings.tsx PRESET_ICONS).
// Map each to a matching lucide outline icon so a goal renders a themed icon
// inside its rounded tile instead of a raw emoji. Callers fall back to the
// Target "goal" icon for anything unmapped (including the default 🎯):
//   const Icon = SAVINGS_ICON_MAP[goal.icon ?? ''] ?? Target
export const SAVINGS_ICON_MAP: Record<string, LucideIcon> = {
  '🎯': Target, '🏖️': Palmtree, '🚗': Car, '🏠': Home, '💻': Laptop,
  '✈️': Plane, '🎓': GraduationCap, '💍': Gem, '🎮': Gamepad2, '👶': Baby,
  '💰': Wallet, '🎁': Gift, '🏋️': Dumbbell,
}
