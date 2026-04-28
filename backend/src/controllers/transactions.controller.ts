import { Response } from "express";
import { and, eq, gte, lt, isNull, or, sql, count } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { transactions, categories, users } from "../db/schema";
import { AuthRequest } from "../middleware/authenticate";

const createSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  type: z.enum(["income", "expense"]),
  amount: z.number().positive(),
  description: z.string().max(500).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  isFixed: z.boolean().optional().default(false),
});

const updateSchema = createSchema.partial();

const listQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  type: z.enum(["income", "expense"]).optional(),
  isFixed: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const summaryQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "month must be YYYY-MM"),
});

function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { start, end: next };
}

async function resolveUserHousehold(userId: string) {
  const [u] = await db
    .select({ householdId: users.householdId, householdEnabled: users.householdEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return u;
}

function buildFilters(
  userId: string,
  householdId: number | null | undefined,
  householdEnabled: boolean | null | undefined,
  month?: string,
  type?: string,
  isFixed?: string
) {
  const baseFilter =
    householdEnabled && householdId
      ? or(
          eq(transactions.householdId, householdId),
          and(eq(transactions.userId, userId), isNull(transactions.householdId))
        )
      : and(eq(transactions.userId, userId), isNull(transactions.householdId));

  const filters = [baseFilter!];
  if (month) {
    const { start, end } = monthRange(month);
    filters.push(gte(transactions.date, start));
    filters.push(lt(transactions.date, end));
  }
  if (type) {
    filters.push(eq(transactions.type, type));
  }
  if (isFixed !== undefined) {
    filters.push(eq(transactions.isFixed, isFixed === "true"));
  }
  return filters;
}

export async function listTransactions(req: AuthRequest, res: Response): Promise<void> {
  const query = listQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query params", details: query.error.errors });
    return;
  }

  const { month, type, isFixed, limit, offset } = query.data;
  const userCtx = await resolveUserHousehold(req.userId!);
  const filters = buildFilters(req.userId!, userCtx?.householdId, userCtx?.householdEnabled, month, type, isFixed);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: transactions.id,
        userId: transactions.userId,
        categoryId: transactions.categoryId,
        type: transactions.type,
        amount: transactions.amount,
        description: transactions.description,
        date: transactions.date,
        isFixed: transactions.isFixed,
        createdAt: transactions.createdAt,
        updatedAt: transactions.updatedAt,
        categoryName: categories.name,
        categoryColor: categories.color,
        categoryIcon: categories.icon,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(...filters))
      .orderBy(sql`${transactions.date} DESC, ${transactions.createdAt} DESC`)
      .limit(limit)
      .offset(offset),

    db
      .select({ total: count() })
      .from(transactions)
      .where(and(...filters)),
  ]);

  res.json({ data: rows.map(normalizeAmount), total: Number(total) });
}

export async function createTransaction(req: AuthRequest, res: Response): Promise<void> {
  const body = createSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", details: body.error.errors });
    return;
  }

  const { amount, categoryId, ...rest } = body.data;
  const userCtx = await resolveUserHousehold(req.userId!);

  const [row] = await db
    .insert(transactions)
    .values({
      ...rest,
      amount: String(amount),
      categoryId: categoryId ?? null,
      userId: req.userId!,
      createdBy: req.userId!,
      householdId: userCtx?.householdEnabled && userCtx?.householdId ? userCtx.householdId : null,
    })
    .returning();

  const withCategory = await fetchWithCategory(row.id);
  const newBadges = await updateStreakAndBadges(req.userId!, body.data.date);
  res.status(201).json({ data: normalizeAmount(withCategory), newBadges });
}

export async function updateTransaction(req: AuthRequest, res: Response): Promise<void> {
  const id = req.params["id"] as string;

  const [existing] = await db
    .select({ userId: transactions.userId })
    .from(transactions)
    .where(eq(transactions.id, id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  if (existing.userId !== req.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const body = updateSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", details: body.error.errors });
    return;
  }

  const { amount, categoryId, ...rest } = body.data;
  const patch: Record<string, unknown> = { ...rest, updatedAt: new Date() };
  if (amount !== undefined) patch.amount = String(amount);
  if (categoryId !== undefined) patch.categoryId = categoryId;

  await db
    .update(transactions)
    .set(patch)
    .where(and(eq(transactions.id, id), eq(transactions.userId, req.userId!)));

  const withCategory = await fetchWithCategory(id);
  res.json({ data: normalizeAmount(withCategory) });
}

export async function deleteTransaction(req: AuthRequest, res: Response): Promise<void> {
  const id = req.params["id"] as string;

  const [existing] = await db
    .select({ userId: transactions.userId })
    .from(transactions)
    .where(eq(transactions.id, id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  if (existing.userId !== req.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(transactions).where(eq(transactions.id, id));
  res.json({ success: true });
}

export async function getSummary(req: AuthRequest, res: Response): Promise<void> {
  const query = summaryQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query params", details: query.error.errors });
    return;
  }

  const { month } = query.data;
  const { start, end } = monthRange(month);
  const userCtx = await resolveUserHousehold(req.userId!);

  const baseFilter =
    userCtx?.householdEnabled && userCtx?.householdId
      ? or(
          eq(transactions.householdId, userCtx.householdId),
          and(eq(transactions.userId, req.userId!), isNull(transactions.householdId))
        )
      : and(eq(transactions.userId, req.userId!), isNull(transactions.householdId));

  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      type: transactions.type,
      categoryName: categories.name,
      categoryColor: categories.color,
      total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        baseFilter,
        gte(transactions.date, start),
        lt(transactions.date, end)
      )
    )
    .groupBy(
      transactions.categoryId,
      transactions.type,
      categories.name,
      categories.color
    );

  const totalIncome = rows
    .filter((r) => r.type === "income")
    .reduce((acc, r) => acc + parseFloat(r.total), 0);

  const totalExpenses = rows
    .filter((r) => r.type === "expense")
    .reduce((acc, r) => acc + parseFloat(r.total), 0);

  const byCategory = rows.map((r) => {
    const total = parseFloat(r.total);
    const base = r.type === "income" ? totalIncome : totalExpenses;
    const percentage = base > 0 ? Math.round((total / base) * 10000) / 100 : 0;
    return {
      categoryId: r.categoryId,
      name: r.categoryName ?? "Uncategorized",
      color: r.categoryColor ?? "#6B7280",
      type: r.type,
      total,
      percentage,
    };
  });

  res.json({
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    byCategory,
  });
}

async function fetchWithCategory(id: string) {
  const [row] = await db
    .select({
      id: transactions.id,
      userId: transactions.userId,
      categoryId: transactions.categoryId,
      type: transactions.type,
      amount: transactions.amount,
      description: transactions.description,
      date: transactions.date,
      isFixed: transactions.isFixed,
      createdAt: transactions.createdAt,
      updatedAt: transactions.updatedAt,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(eq(transactions.id, id));
  return row;
}

function normalizeAmount<T extends { amount: unknown }>(row: T): T {
  return { ...row, amount: parseFloat(row.amount as string) };
}

const BADGE_DEFS: { id: string; check: (txCount: number, streak: number, longestStreak: number) => boolean }[] = [
  { id: 'first_transaction',  check: (n) => n >= 1 },
  { id: 'streak_7',           check: (_, s) => s >= 7 },
  { id: 'streak_30',          check: (_, s) => s >= 30 },
  { id: 'transactions_10',    check: (n) => n >= 10 },
  { id: 'transactions_50',    check: (n) => n >= 50 },
  { id: 'transactions_100',   check: (n) => n >= 100 },
];

async function updateStreakAndBadges(userId: string, txDate: string): Promise<string[]> {
  const [user] = await db.select({
    currentStreak: users.currentStreak,
    longestStreak: users.longestStreak,
    lastActivityDate: users.lastActivityDate,
    badges: users.badges,
  }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return [];

  const today = txDate;
  const last = user.lastActivityDate;
  let streak = user.currentStreak ?? 0;

  if (!last) {
    streak = 1;
  } else if (last === today) {
    // same day — no change
  } else {
    const dayDiff = Math.round((new Date(today).getTime() - new Date(last).getTime()) / 86400000);
    streak = dayDiff === 1 ? streak + 1 : 1;
  }

  const longest = Math.max(user.longestStreak ?? 0, streak);

  const [{ txCount }] = await db.select({ txCount: count() }).from(transactions).where(eq(transactions.userId, userId));
  const n = Number(txCount);

  const earned = new Set(user.badges ?? []);
  const newBadges: string[] = [];
  for (const { id, check } of BADGE_DEFS) {
    if (!earned.has(id) && check(n, streak, longest)) {
      earned.add(id);
      newBadges.push(id);
    }
  }

  await db.update(users).set({
    currentStreak: streak,
    longestStreak: longest,
    lastActivityDate: today,
    badges: Array.from(earned),
  }).where(eq(users.id, userId));

  return newBadges;
}
