interface CategorySeed {
  name: string;
  type: "income" | "expense";
  color: string;
  icon: string;
}

export const DEFAULT_CATEGORIES: CategorySeed[] = [
  { name: "Bývanie",       type: "expense", color: "#3B82F6", icon: "🏠" },
  { name: "Jedlo",         type: "expense", color: "#10B981", icon: "🍔" },
  { name: "Doprava",       type: "expense", color: "#F59E0B", icon: "🚗" },
  { name: "Zdravie",       type: "expense", color: "#EF4444", icon: "💊" },
  { name: "Voľný čas",     type: "expense", color: "#8B5CF6", icon: "🎉" },
  { name: "Oblečenie",     type: "expense", color: "#EC4899", icon: "👕" },
  { name: "Ostatné",       type: "expense", color: "#6B7280", icon: "📦" },
  { name: "Plat",          type: "income",  color: "#10B981", icon: "💰" },
  { name: "Brigáda",       type: "income",  color: "#3B82F6", icon: "⏱️" },
  { name: "Ostatné príjmy",type: "income",  color: "#6B7280", icon: "💸" },
];
