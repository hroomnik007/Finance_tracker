interface CategorySeed {
  name: string;
  type: "income" | "expense";
  color: string;
  icon: string;
}

export const DEFAULT_CATEGORIES: CategorySeed[] = [
  { name: "Bývanie",       type: "expense", color: "#3B82F6", icon: "home" },
  { name: "Jedlo",         type: "expense", color: "#10B981", icon: "utensils" },
  { name: "Doprava",       type: "expense", color: "#F59E0B", icon: "car" },
  { name: "Zdravie",       type: "expense", color: "#EF4444", icon: "heart" },
  { name: "Voľný čas",     type: "expense", color: "#8B5CF6", icon: "gamepad-2" },
  { name: "Oblečenie",     type: "expense", color: "#EC4899", icon: "shirt" },
  { name: "Ostatné",       type: "expense", color: "#6B7280", icon: "circle-ellipsis" },
  { name: "Plat",          type: "income",  color: "#10B981", icon: "briefcase" },
  { name: "Brigáda",       type: "income",  color: "#3B82F6", icon: "clock" },
  { name: "Ostatné príjmy",type: "income",  color: "#6B7280", icon: "circle-ellipsis" },
];
