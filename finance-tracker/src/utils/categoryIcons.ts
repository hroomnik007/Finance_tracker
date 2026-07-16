import type { LucideIcon } from 'lucide-react'
import {
  UtensilsCrossed, ShoppingCart, Car, Home, Pill, PartyPopper, Shirt, BookOpen,
  Plane, Gamepad2, PawPrint, Scissors, Dumbbell, Smartphone, Lightbulb, Pizza,
  Coffee, Clapperboard, Truck, Hospital, GraduationCap, Leaf, Droplet, Wallet,
  Laptop, Zap,
} from 'lucide-react'

// Single source of truth mapping a category's emoji icon to a matching lucide
// outline icon. Shared by every place that renders a category icon (Categories
// page, Variable/Fixed expense lists, GlobalFAB pickers, Dashboard budget
// widget, expense heatmap popup) so the same category always shows the same
// glyph. Callers fall back to the generic Tag icon for anything unmapped:
//   const Icon = CATEGORY_ICON_MAP[cat.icon ?? ''] ?? Tag
export const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  '🍔': UtensilsCrossed, '🛒': ShoppingCart, '🚗': Car, '🏠': Home, '💊': Pill,
  '🎉': PartyPopper, '👕': Shirt, '📚': BookOpen, '✈️': Plane, '🎮': Gamepad2,
  '🐾': PawPrint, '💇': Scissors, '🏋️': Dumbbell, '📱': Smartphone, '💡': Lightbulb,
  '🍕': Pizza, '☕': Coffee, '🎬': Clapperboard, '🛻': Truck, '🏥': Hospital,
  '🎓': GraduationCap, '🌿': Leaf, '🧴': Droplet, '💰': Wallet,
  '💻': Laptop, '⚡': Zap,
}
