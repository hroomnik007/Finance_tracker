import bcrypt from "bcrypt";
import { eq, inArray, and } from "drizzle-orm";
import { db } from "../db";
import {
  users,
  categories,
  transactions,
  savingsGoals,
  households,
  householdMembers,
} from "../db/schema";

const DEMO_EMAIL = "demo@finvu.sk";
const DEMO_PASSWORD = "demo123";

// Helper: fixed date string YYYY-MM-DD
function d(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Today: 2026-05-22 → last 3 months = March, April, May 2026
const MONTHS = [
  { year: 2026, month: 3 },
  { year: 2026, month: 4 },
  { year: 2026, month: 5 },
];

const EXPENSE_CATS = [
  { name: "Bývanie",    type: "expense" as const, color: "#3B82F6", icon: "🏠", budgetLimit: "800" },
  { name: "Jedlo",      type: "expense" as const, color: "#10B981", icon: "🍔", budgetLimit: "400" },
  { name: "Doprava",    type: "expense" as const, color: "#F59E0B", icon: "🚗", budgetLimit: "200" },
  { name: "Zdravie",    type: "expense" as const, color: "#EF4444", icon: "💊", budgetLimit: "150" },
  { name: "Zábava",     type: "expense" as const, color: "#8B5CF6", icon: "🎉", budgetLimit: "100" },
  { name: "Predplatné", type: "expense" as const, color: "#06B6D4", icon: "📱", budgetLimit: "50"  },
  { name: "Energie",    type: "expense" as const, color: "#F97316", icon: "⚡", budgetLimit: null },
  { name: "Poistenie",  type: "expense" as const, color: "#6366F1", icon: "🛡️", budgetLimit: null },
  { name: "Investície", type: "expense" as const, color: "#059669", icon: "📈", budgetLimit: null },
  { name: "Oblečenie",  type: "expense" as const, color: "#EC4899", icon: "👕", budgetLimit: null },
  { name: "Nákupy",     type: "expense" as const, color: "#84CC16", icon: "🛍️", budgetLimit: null },
  { name: "Ostatné",    type: "expense" as const, color: "#9CA3AF", icon: "📦", budgetLimit: null },
  { name: "Osobné",     type: "expense" as const, color: "#D97706", icon: "👤", budgetLimit: null },
  { name: "Iné",        type: "expense" as const, color: "#94A3B8", icon: "✨", budgetLimit: null },
];

const INCOME_CATS = [
  { name: "Plat",    type: "income" as const, color: "#34D399", icon: "💰", budgetLimit: null },
  { name: "Brigáda", type: "income" as const, color: "#A3E635", icon: "💼", budgetLimit: null },
];

const ALL_CATS = [...EXPENSE_CATS, ...INCOME_CATS];

async function getOrCreateUser(email: string, name: string, avatarUrl: string | null = null) {
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    // Ensure name is up-to-date
    await db.update(users).set({ name }).where(eq(users.id, existing.id));
    return { ...existing, name };
  }
  const passwordHash = await bcrypt.hash("demo123", 10);
  const [created] = await db.insert(users).values({
    email,
    passwordHash,
    name,
    emailVerified: true,
    role: "user",
    avatarUrl,
    onboardingComplete: true,
  }).returning();
  return created;
}

async function main() {
  console.log("=== Seeding demo account ===");

  // ── 1. Create/get users ──────────────────────────────────────────────────
  const peter = await getOrCreateUser(DEMO_EMAIL, "Demo");
  const lucia = await getOrCreateUser("lucia@finvu.sk", "Demo1");
  const tomas = await getOrCreateUser("tomas@finvu.sk", "Demo2");
  console.log(`Users: Demo(${peter.id.slice(0,8)}…), Demo1(${lucia.id.slice(0,8)}…), Demo2(${tomas.id.slice(0,8)}…)`);

  // ── 2. Clear old demo data for Peter ────────────────────────────────────
  await db.delete(transactions).where(eq(transactions.userId, peter.id));
  await db.delete(savingsGoals).where(eq(savingsGoals.userId, peter.id));
  await db.delete(categories).where(eq(categories.userId, peter.id));
  console.log("Cleared old data for demo user.");

  // ── 3. Clear old household if exists ────────────────────────────────────
  if (peter.householdId) {
    const hid = peter.householdId;
    await db.delete(householdMembers).where(eq(householdMembers.householdId, hid));
    await db.delete(households).where(eq(households.id, hid));
    await db.update(users).set({ householdId: null, householdEnabled: false })
      .where(inArray(users.id, [peter.id, lucia.id, tomas.id]));
    console.log(`Deleted old household ${hid}.`);
  }

  // ── 4. Create categories ─────────────────────────────────────────────────
  const insertedCats = await db.insert(categories).values(
    ALL_CATS.map(c => ({
      userId: peter.id,
      name: c.name,
      type: c.type,
      color: c.color,
      icon: c.icon,
      isDefault: true,
      budgetLimit: c.budgetLimit ?? undefined,
      autoLimit: false,
    }))
  ).returning();

  const catMap = new Map(insertedCats.map(c => [c.name, c.id]));
  console.log(`Created ${insertedCats.length} categories.`);

  const cid = (name: string) => catMap.get(name)!;

  // ── 5. Create household (before transactions so we have the ID) ──────────
  const [household] = await db.insert(households).values({
    name: "Demových",
    inviteCode: "DEMO2026",
    createdBy: peter.id,
  }).returning();

  await db.insert(householdMembers).values([
    { householdId: household.id, userId: peter.id },
    { householdId: household.id, userId: lucia.id },
    { householdId: household.id, userId: tomas.id },
  ]);

  await db.update(users)
    .set({ householdId: household.id, householdEnabled: true, savingsEnabled: true, onboardingComplete: true })
    .where(eq(users.id, peter.id));
  await db.update(users)
    .set({ householdId: household.id, householdEnabled: true })
    .where(eq(users.id, lucia.id));
  await db.update(users)
    .set({ householdId: household.id, householdEnabled: true })
    .where(eq(users.id, tomas.id));

  console.log(`Created household "${household.name}" (id=${household.id}) with 3 members.`);

  // ── 6. Fixed expenses — last 3 months ───────────────────────────────────
  type TxRow = {
    userId: string; categoryId: string; type: "expense" | "income";
    amount: string; description: string; date: string; isFixed: boolean;
    householdId: number; createdBy: string;
  };

  const fixedRows: TxRow[] = [];

  const fixedDefs = [
    { desc: "Nájom",              cat: "Bývanie",    amount: "650",   day: 1  },
    { desc: "Elektrina",          cat: "Energie",    amount: "50",    day: 14 },
    { desc: "Internet",           cat: "Predplatné", amount: "24.90", day: 20 },
    { desc: "Streamovanie video", cat: "Predplatné", amount: "13.99", day: 14 },
    { desc: "Streamovanie hudba", cat: "Predplatné", amount: "9.99",  day: 12 },
    { desc: "Poistenie",          cat: "Poistenie",  amount: "59.20", day: 14 },
    { desc: "Investícia",         cat: "Investície", amount: "100",   day: 20 },
  ];

  const hid = household.id;
  const uid = peter.id;

  for (const m of MONTHS) {
    for (const f of fixedDefs) {
      // Skip future dates (today is 2026-05-22, skip if day > 22 in May)
      if (m.month === 5 && f.day > 22) continue;
      fixedRows.push({
        userId: uid, categoryId: cid(f.cat), type: "expense",
        amount: f.amount, description: f.desc, date: d(m.year, m.month, f.day),
        isFixed: true, householdId: hid, createdBy: uid,
      });
    }
  }

  // ── 7. Variable expenses ─────────────────────────────────────────────────
  const tx = (cat: string, type: "expense" | "income", amount: string, desc: string, date: string, isFixed = false): TxRow =>
    ({ userId: uid, categoryId: cid(cat), type, amount, description: desc, date, isFixed, householdId: hid, createdBy: uid });

  const variableRows: TxRow[] = [
    // March 2026
    tx("Jedlo",     "expense", "45.20", "Potraviny",         d(2026,3,3)),
    tx("Doprava",   "expense", "62.50", "Tankovanie",        d(2026,3,7)),
    tx("Zdravie",   "expense", "28.90", "Lekáreň",           d(2026,3,10)),
    tx("Jedlo",     "expense", "38.40", "Potraviny",         d(2026,3,15)),
    tx("Doprava",   "expense", "30.00", "MHD mesačná karta", d(2026,3,18)),
    tx("Zábava",    "expense", "22.00", "Kino",              d(2026,3,22)),
    // April 2026
    tx("Jedlo",     "expense", "52.70", "Potraviny",         d(2026,4,2)),
    tx("Doprava",   "expense", "58.30", "Tankovanie",        d(2026,4,5)),
    tx("Jedlo",     "expense", "41.60", "Potraviny",         d(2026,4,9)),
    tx("Oblečenie", "expense", "89.00", "Oblečenie",         d(2026,4,13)),
    tx("Zdravie",   "expense", "18.50", "Lekáreň",           d(2026,4,17)),
    tx("Zábava",    "expense", "16.00", "Kino",              d(2026,4,20)),
    tx("Jedlo",     "expense", "67.30", "Potraviny",         d(2026,4,24)),
    tx("Doprava",   "expense", "71.00", "Tankovanie",        d(2026,4,28)),
    // May 2026
    tx("Jedlo",     "expense", "33.80", "Potraviny",         d(2026,5,5)),
    tx("Oblečenie", "expense", "45.00", "Oblečenie",         d(2026,5,10)),
    tx("Zdravie",   "expense", "35.20", "Lekáreň",           d(2026,5,14)),
    tx("Jedlo",     "expense", "58.90", "Potraviny",         d(2026,5,18)),
  ];

  // ── 8. Income — last 3 months ───────────────────────────────────────────
  const incomeRows: TxRow[] = [];
  for (const m of MONTHS) {
    incomeRows.push(tx("Plat",    "income", "1200", "Výplata", d(m.year, m.month, 1),  true));
    incomeRows.push(tx("Brigáda", "income", "364",  "Brigáda", d(m.year, m.month, 15), true));
  }

  // ── 9. Insert all transactions ───────────────────────────────────────────
  const allTx = [...fixedRows, ...variableRows, ...incomeRows];
  await db.insert(transactions).values(allTx);
  console.log(`Created ${allTx.length} transactions (${fixedRows.length} fixed, ${variableRows.length} variable, ${incomeRows.length} income).`);

  // ── 9. Savings goals ─────────────────────────────────────────────────────
  await db.insert(savingsGoals).values([
    {
      userId: peter.id,
      name: "Dovolenka",
      targetAmount: "1500",
      savedAmount: "320",
      deadline: "2026-08-22",
      icon: "✈️",
      color: "#06B6D4",
      note: "Dovolenka v lete",
    },
    {
      userId: peter.id,
      name: "Nové auto",
      targetAmount: "8000",
      savedAmount: "1200",
      deadline: "2027-11-22",
      icon: "🚗",
      color: "#F59E0B",
      note: "Nové auto — záloha",
    },
    {
      userId: peter.id,
      name: "Rezervný fond",
      targetAmount: "3000",
      savedAmount: "2100",
      deadline: "2026-11-22",
      icon: "🏦",
      color: "#10B981",
      note: "Rezerva na 3 mesiace",
    },
  ]);
  console.log("Created 3 savings goals.");
  console.log("=== Demo seed complete ===");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
