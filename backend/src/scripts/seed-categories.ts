import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { users, categories } from "../db/schema";

const SEED_EMAIL = process.env.SEED_USER_EMAIL ?? "peter@pedani.eu";

const CATEGORIES = [
  { name: "Bývanie",           icon: "🏠", color: "#3B82F6", type: "expense" as const },
  { name: "Energie",           icon: "⚡", color: "#F59E0B", type: "expense" as const },
  { name: "Telekomunikácie",   icon: "📱", color: "#8B5CF6", type: "expense" as const },
  { name: "Poistenie",         icon: "🛡️", color: "#10B981", type: "expense" as const },
  { name: "Financie & Úvery", icon: "🏦", color: "#EF4444", type: "expense" as const },
  { name: "IT & Technika",     icon: "💻", color: "#6366F1", type: "expense" as const },
  { name: "Investície",        icon: "📈", color: "#34D399", type: "expense" as const },
];

async function main() {
  console.log(`Seeding categories for: ${SEED_EMAIL}`);

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, SEED_EMAIL)).limit(1);
  if (!user) {
    console.error(`User not found: ${SEED_EMAIL}`);
    process.exit(1);
  }

  for (const cat of CATEGORIES) {
    const existing = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.userId, user.id), eq(categories.name, cat.name)))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  SKIP   ${cat.icon} ${cat.name}`);
      continue;
    }

    await db.insert(categories).values({ ...cat, userId: user.id });
    console.log(`  INSERT ${cat.icon} ${cat.name}`);
  }

  console.log("Done.");
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
