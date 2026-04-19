import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, categories, transactions } from "../db/schema";

const DEMO_EMAIL = "demo@finvu.sk";
const DEMO_PASSWORD = "demo123";
const DEMO_NAME = "Demo";

const DEMO_CATEGORIES = [
  { name: "Jedlo", type: "expense" as const, color: "#10B981", icon: "🍔" },
  { name: "Doprava", type: "expense" as const, color: "#F59E0B", icon: "🚗" },
  { name: "Bývanie", type: "expense" as const, color: "#3B82F6", icon: "🏠" },
  { name: "Zdravie", type: "expense" as const, color: "#EF4444", icon: "💊" },
  { name: "Zábava", type: "expense" as const, color: "#8B5CF6", icon: "🎉" },
  { name: "Plat", type: "income" as const, color: "#34D399", icon: "💰" },
];

function randomBetween(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function dateOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

async function main() {
  console.log("Seeding demo user...");

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);

  let demoUserId: string;

  if (existing.length > 0) {
    demoUserId = existing[0].id;
    console.log("Demo user already exists, skipping user creation.");
  } else {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const [user] = await db
      .insert(users)
      .values({
        email: DEMO_EMAIL,
        passwordHash,
        name: DEMO_NAME,
        emailVerified: true,
        role: "user",
      })
      .returning({ id: users.id });
    demoUserId = user.id;
    console.log("Demo user created:", demoUserId);
  }

  const existingCats = await db.select().from(categories).where(eq(categories.userId, demoUserId));

  let categoryIds: string[] = [];

  if (existingCats.length > 0) {
    console.log("Demo categories already exist, skipping.");
    categoryIds = existingCats.slice(0, 6).map(c => c.id);
  } else {
    const inserted = await db
      .insert(categories)
      .values(DEMO_CATEGORIES.map(c => ({ ...c, userId: demoUserId, isDefault: true })))
      .returning({ id: categories.id });
    categoryIds = inserted.map(c => c.id);
    console.log("Demo categories created:", categoryIds.length);
  }

  const existingTx = await db.select({ id: transactions.id }).from(transactions).where(eq(transactions.userId, demoUserId)).limit(1);

  if (existingTx.length > 0) {
    console.log("Demo transactions already exist, skipping.");
  } else {
    const expenseCatIds = categoryIds.slice(0, 5);
    const incomeCatId = categoryIds[5];

    const txValues = [];

    // 3 months of income
    for (let m = 0; m < 3; m++) {
      txValues.push({
        userId: demoUserId,
        categoryId: incomeCatId,
        type: "income" as const,
        amount: String(randomBetween(1200, 1800)),
        description: "Mesačný plat",
        date: dateOffset(m * 30 + 1),
        isFixed: false,
      });
    }

    // 30 variable expenses across last 3 months
    const notes = ["Nákup v Lidl", "Tankovanie", "Nájom", "Lekáreň", "Kino", "Reštaurácia", "MHD", "Potraviny", "Fitnes", "Oblečenie"];
    for (let i = 0; i < 30; i++) {
      const catIdx = Math.floor(Math.random() * expenseCatIds.length);
      txValues.push({
        userId: demoUserId,
        categoryId: expenseCatIds[catIdx],
        type: "expense" as const,
        amount: String(randomBetween(5, 150)),
        description: notes[Math.floor(Math.random() * notes.length)],
        date: dateOffset(Math.floor(Math.random() * 90)),
        isFixed: false,
      });
    }

    // 3 fixed expenses
    const fixedLabels = [
      { label: "Nájom", amount: "650" },
      { label: "Internet", amount: "25" },
      { label: "Elektrina", amount: "80" },
    ];
    for (const f of fixedLabels) {
      txValues.push({
        userId: demoUserId,
        categoryId: expenseCatIds[0],
        type: "expense" as const,
        amount: f.amount,
        description: f.label,
        date: dateOffset(5),
        isFixed: true,
      });
    }

    await db.insert(transactions).values(txValues);
    console.log("Demo transactions created:", txValues.length);
  }

  console.log("Demo seed complete.");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
