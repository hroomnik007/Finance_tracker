import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  users,
  categories,
  transactions,
  savingsGoals,
  households,
  householdMembers,
} from "../db/schema";

const DEMO_EMAIL  = "demo@finvu.sk";
const DEMO1_EMAIL = "lucia@finvu.sk";
const DEMO2_EMAIL = "tomas@finvu.sk";

function d(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Last 3 calendar months ending with the current month (inclusive)
function lastThreeMonths(): Array<{ year: number; month: number }> {
  const now = new Date();
  const result = [];
  for (let i = 2; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({ year: dt.getFullYear(), month: dt.getMonth() + 1 });
  }
  return result;
}

const EXPENSE_CATS = [
  { name: "Bývanie",    type: "expense" as const, color: "#3B82F6", icon: "🏠", budgetLimit: "800" },
  { name: "Jedlo",      type: "expense" as const, color: "#10B981", icon: "🍔", budgetLimit: "400" },
  { name: "Doprava",    type: "expense" as const, color: "#F59E0B", icon: "🚗", budgetLimit: "200" },
  { name: "Zdravie",    type: "expense" as const, color: "#EF4444", icon: "💊", budgetLimit: "150" },
  { name: "Zábava",     type: "expense" as const, color: "#8B5CF6", icon: "🎉", budgetLimit: "100" },
  { name: "Predplatné", type: "expense" as const, color: "#06B6D4", icon: "📱", budgetLimit: "50"  },
  { name: "Energie",    type: "expense" as const, color: "#F97316", icon: "⚡", budgetLimit: null  },
  { name: "Poistenie",  type: "expense" as const, color: "#6366F1", icon: "🛡️", budgetLimit: null  },
  { name: "Investície", type: "expense" as const, color: "#059669", icon: "📈", budgetLimit: null  },
  { name: "Oblečenie",  type: "expense" as const, color: "#EC4899", icon: "👕", budgetLimit: null  },
  { name: "Nákupy",     type: "expense" as const, color: "#84CC16", icon: "🛍️", budgetLimit: null  },
  { name: "Ostatné",    type: "expense" as const, color: "#9CA3AF", icon: "📦", budgetLimit: null  },
  { name: "Osobné",     type: "expense" as const, color: "#D97706", icon: "👤", budgetLimit: null  },
  { name: "Iné",        type: "expense" as const, color: "#94A3B8", icon: "✨", budgetLimit: null  },
];

const INCOME_CATS = [
  { name: "Plat",    type: "income" as const, color: "#34D399", icon: "💰", budgetLimit: null },
  { name: "Brigáda", type: "income" as const, color: "#A3E635", icon: "💼", budgetLimit: null },
];

const ALL_CATS = [...EXPENSE_CATS, ...INCOME_CATS];

const FIXED_DEFS = [
  { desc: "Nájom",              cat: "Bývanie",    amount: "650",   day: 1  },
  { desc: "Elektrina",          cat: "Energie",    amount: "50",    day: 14 },
  { desc: "Internet",           cat: "Predplatné", amount: "24.90", day: 20 },
  { desc: "Streamovanie video", cat: "Predplatné", amount: "13.99", day: 14 },
  { desc: "Streamovanie hudba", cat: "Predplatné", amount: "9.99",  day: 12 },
  { desc: "Poistenie",          cat: "Poistenie",  amount: "59.20", day: 14 },
  { desc: "Investícia",         cat: "Investície", amount: "100",   day: 20 },
];

/**
 * Resets the demo account to a known fresh state.
 * Called on every demo login — errors are caught and logged by the caller.
 */
export async function resetDemoAccount(userId: string): Promise<void> {
  const now = new Date();
  const todayYear  = now.getFullYear();
  const todayMonth = now.getMonth() + 1;
  const todayDay   = now.getDate();

  const MONTHS = lastThreeMonths();

  // ── 1. Fetch helper user IDs ─────────────────────────────────────────────
  const [lucia] = await db.select({ id: users.id, householdId: users.householdId })
    .from(users).where(eq(users.email, DEMO1_EMAIL)).limit(1);
  const [tomas] = await db.select({ id: users.id, householdId: users.householdId })
    .from(users).where(eq(users.email, DEMO2_EMAIL)).limit(1);

  // ── 2. Clear demo user's data ────────────────────────────────────────────
  await db.delete(transactions).where(eq(transactions.userId, userId));
  await db.delete(savingsGoals).where(eq(savingsGoals.userId, userId));
  await db.delete(categories).where(eq(categories.userId, userId));

  // ── 3. Clear existing household ──────────────────────────────────────────
  const [demoUser] = await db.select({ householdId: users.householdId })
    .from(users).where(eq(users.id, userId)).limit(1);

  if (demoUser?.householdId) {
    const hid = demoUser.householdId;
    await db.delete(householdMembers).where(eq(householdMembers.householdId, hid));
    await db.delete(households).where(eq(households.id, hid));
    const memberIds = [userId, lucia?.id, tomas?.id].filter(Boolean) as string[];
    await db.update(users)
      .set({ householdId: null, householdEnabled: false })
      .where(inArray(users.id, memberIds));
  }

  // ── 4. Re-create categories ───────────────────────────────────────────────
  const insertedCats = await db.insert(categories).values(
    ALL_CATS.map(c => ({
      userId,
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
  const cid = (name: string) => catMap.get(name)!;

  // ── 5. Re-create household ────────────────────────────────────────────────
  const [household] = await db.insert(households).values({
    name: "Demových",
    inviteCode: "DEMO2026",
    createdBy: userId,
  }).returning();

  const memberRows = [
    { householdId: household.id, userId },
    ...(lucia ? [{ householdId: household.id, userId: lucia.id }] : []),
    ...(tomas ? [{ householdId: household.id, userId: tomas.id }] : []),
  ];
  await db.insert(householdMembers).values(memberRows);

  await db.update(users)
    .set({ householdId: household.id, householdEnabled: true, savingsEnabled: true, onboardingComplete: true })
    .where(eq(users.id, userId));
  if (lucia) {
    await db.update(users)
      .set({ householdId: household.id, householdEnabled: true })
      .where(eq(users.id, lucia.id));
  }
  if (tomas) {
    await db.update(users)
      .set({ householdId: household.id, householdEnabled: true })
      .where(eq(users.id, tomas.id));
  }

  // ── 6. Build transactions ─────────────────────────────────────────────────
  type TxRow = {
    userId: string; categoryId: string; type: "expense" | "income";
    amount: string; description: string; date: string; isFixed: boolean;
    householdId: number; createdBy: string;
  };

  const tx = (cat: string, type: "expense" | "income", amount: string, desc: string, date: string, isFixed = false): TxRow =>
    ({ userId, categoryId: cid(cat), type, amount, description: desc, date, isFixed, householdId: household.id, createdBy: userId });

  const fixedRows: TxRow[] = [];
  for (const m of MONTHS) {
    for (const f of FIXED_DEFS) {
      // Skip days that haven't occurred yet in the current month
      if (m.year === todayYear && m.month === todayMonth && f.day > todayDay) continue;
      fixedRows.push(tx(f.cat, "expense", f.amount, f.desc, d(m.year, m.month, f.day), true));
    }
  }

  // Variable expenses — distributed across the last 3 months
  const [m0, m1, m2] = MONTHS; // oldest → newest
  const variableRows: TxRow[] = [
    // Month -2
    tx("Jedlo",     "expense", "45.20", "Potraviny",         d(m0.year, m0.month, 3)),
    tx("Doprava",   "expense", "62.50", "Tankovanie",        d(m0.year, m0.month, 7)),
    tx("Zdravie",   "expense", "28.90", "Lekáreň",           d(m0.year, m0.month, 10)),
    tx("Jedlo",     "expense", "38.40", "Potraviny",         d(m0.year, m0.month, 15)),
    tx("Doprava",   "expense", "30.00", "MHD mesačná karta", d(m0.year, m0.month, 18)),
    tx("Zábava",    "expense", "22.00", "Kino",              d(m0.year, m0.month, 22)),
    // Month -1
    tx("Jedlo",     "expense", "52.70", "Potraviny",         d(m1.year, m1.month, 2)),
    tx("Doprava",   "expense", "58.30", "Tankovanie",        d(m1.year, m1.month, 5)),
    tx("Jedlo",     "expense", "41.60", "Potraviny",         d(m1.year, m1.month, 9)),
    tx("Oblečenie", "expense", "89.00", "Oblečenie",         d(m1.year, m1.month, 13)),
    tx("Zdravie",   "expense", "18.50", "Lekáreň",           d(m1.year, m1.month, 17)),
    tx("Zábava",    "expense", "16.00", "Kino",              d(m1.year, m1.month, 20)),
    tx("Jedlo",     "expense", "67.30", "Potraviny",         d(m1.year, m1.month, 24)),
    tx("Doprava",   "expense", "71.00", "Tankovanie",        d(m1.year, m1.month, 28)),
    // Current month — only days up to today
    ...(todayDay >= 5  ? [tx("Jedlo",     "expense", "33.80", "Potraviny",  d(m2.year, m2.month, 5))]  : []),
    ...(todayDay >= 10 ? [tx("Oblečenie", "expense", "45.00", "Oblečenie",  d(m2.year, m2.month, 10))] : []),
    ...(todayDay >= 14 ? [tx("Zdravie",   "expense", "35.20", "Lekáreň",    d(m2.year, m2.month, 14))] : []),
    ...(todayDay >= 18 ? [tx("Jedlo",     "expense", "58.90", "Potraviny",  d(m2.year, m2.month, 18))] : []),
  ];

  const incomeRows: TxRow[] = [];
  for (const m of MONTHS) {
    // Skip income entries whose date is in the future
    if (!(m.year === todayYear && m.month === todayMonth && todayDay < 1)) {
      incomeRows.push(tx("Plat",    "income", "1200", "Výplata", d(m.year, m.month, 1),  true));
    }
    if (!(m.year === todayYear && m.month === todayMonth && todayDay < 15)) {
      incomeRows.push(tx("Brigáda", "income", "364",  "Brigáda", d(m.year, m.month, 15), true));
    }
  }

  await db.insert(transactions).values([...fixedRows, ...variableRows, ...incomeRows]);

  // ── 7. Savings goals ──────────────────────────────────────────────────────
  // Deadlines are relative to today: +3 months, +18 months, +6 months
  const deadline = (addMonths: number) => {
    const dt = new Date(now.getFullYear(), now.getMonth() + addMonths, now.getDate());
    return d(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
  };

  await db.insert(savingsGoals).values([
    {
      userId,
      name: "Dovolenka",
      targetAmount: "1500",
      savedAmount:  "320",
      deadline: deadline(3),
      icon:  "✈️",
      color: "#06B6D4",
      note:  "Dovolenka v lete",
    },
    {
      userId,
      name: "Nové auto",
      targetAmount: "8000",
      savedAmount:  "1200",
      deadline: deadline(18),
      icon:  "🚗",
      color: "#F59E0B",
      note:  "Nové auto — záloha",
    },
    {
      userId,
      name: "Rezervný fond",
      targetAmount: "3000",
      savedAmount:  "2100",
      deadline: deadline(6),
      icon:  "🏦",
      color: "#10B981",
      note:  "Rezerva na 3 mesiace",
    },
  ]);

  console.log(`[demo-reset] Reset complete for userId=${userId.slice(0, 8)}…`);
}

export { DEMO_EMAIL };
