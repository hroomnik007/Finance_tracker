import { Response } from "express";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { categories, transactions, users, householdMembers } from "../db/schema";
import { AuthRequest } from "../middleware/authenticate";

type CategoryRow = typeof categories.$inferSelect;
function normalizeCategory(row: CategoryRow) {
  return {
    ...row,
    budgetLimit: row.budgetLimit != null ? Number(row.budgetLimit) : null,
    autoLimit: row.autoLimit,
  };
}

export async function recalculateCategoryLimit(categoryId: string, userId: string): Promise<void> {
  const [cat] = await db
    .select({ autoLimit: categories.autoLimit })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
    .limit(1);

  if (!cat?.autoLimit) return;

  const [{ total }] = await db
    .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)` })
    .from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      eq(transactions.categoryId, categoryId),
      eq(transactions.isFixed, true),
      eq(transactions.type, "expense")
    ));

  const newLimit = parseFloat(total ?? "0");
  if (newLimit > 0) {
    await db
      .update(categories)
      .set({ budgetLimit: String(newLimit) })
      .where(eq(categories.id, categoryId));
  } else {
    // All fixed expenses removed — disable auto_limit so category returns to manual mode
    await db
      .update(categories)
      .set({ budgetLimit: null, autoLimit: false })
      .where(eq(categories.id, categoryId));
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["income", "expense"]),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional(),
  budgetLimit: z.number().positive().nullable().optional(),
  autoLimit: z.boolean().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional(),
  budgetLimit: z.number().positive().nullable().optional(),
  autoLimit: z.boolean().optional(),
});

export async function listCategories(req: AuthRequest, res: Response): Promise<void> {
  const [user] = await db
    .select({ householdId: users.householdId, householdEnabled: users.householdEnabled })
    .from(users)
    .where(eq(users.id, req.userId!))
    .limit(1);

  let rows;
  if (user?.householdEnabled && user?.householdId) {
    const members = await db
      .select({ userId: householdMembers.userId })
      .from(householdMembers)
      .where(eq(householdMembers.householdId, user.householdId));
    const memberIds = members.map((m) => m.userId);
    rows = await db
      .select()
      .from(categories)
      .where(memberIds.length > 0 ? inArray(categories.userId, memberIds) : eq(categories.userId, req.userId!))
      .orderBy(categories.type, categories.name);
  } else {
    rows = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, req.userId!))
      .orderBy(categories.type, categories.name);
  }

  // Determine which categories have at least one fixed expense transaction
  const categoryIds = rows.map((r) => r.id);
  let fixedCatIds = new Set<string>();
  if (categoryIds.length > 0) {
    const fixedRows = await db
      .select({ categoryId: transactions.categoryId })
      .from(transactions)
      .where(and(
        eq(transactions.isFixed, true),
        eq(transactions.type, "expense"),
        isNotNull(transactions.categoryId),
        inArray(transactions.categoryId, categoryIds)
      ))
      .groupBy(transactions.categoryId);
    fixedCatIds = new Set(fixedRows.map((r) => r.categoryId!));
  }

  res.json({
    data: rows.map((r) => ({ ...normalizeCategory(r), hasFixedExpenses: fixedCatIds.has(r.id) })),
  });
}

export async function createCategory(req: AuthRequest, res: Response): Promise<void> {
  const body = createSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", details: body.error.errors });
    return;
  }

  const { budgetLimit: bl, autoLimit, ...rest } = body.data
  const [row] = await db
    .insert(categories)
    .values({
      ...rest,
      userId: req.userId!,
      budgetLimit: bl != null ? String(bl) : null,
      autoLimit: autoLimit ?? false,
    })
    .returning();

  res.status(201).json({ data: { ...normalizeCategory(row), hasFixedExpenses: false } });
}

export async function updateCategory(req: AuthRequest, res: Response): Promise<void> {
  const id = req.params["id"] as string;

  const [existing] = await db
    .select({ userId: categories.userId })
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Category not found" });
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

  if (Object.keys(body.data).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const { budgetLimit: bl, autoLimit, ...fields } = body.data
  const setData: Record<string, unknown> = { ...fields };
  if (body.data.budgetLimit !== undefined) setData.budgetLimit = bl != null ? String(bl) : null;
  if (autoLimit !== undefined) setData.autoLimit = autoLimit;

  const [updated] = await db
    .update(categories)
    .set(setData)
    .where(and(eq(categories.id, id), eq(categories.userId, req.userId!)))
    .returning();

  // When auto_limit is being enabled, immediately recalculate from existing fixed expenses
  if (autoLimit === true) {
    await recalculateCategoryLimit(id, req.userId!);
    const [refreshed] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
    const [hasFixed] = await db
      .select({ categoryId: transactions.categoryId })
      .from(transactions)
      .where(and(eq(transactions.categoryId, id), eq(transactions.isFixed, true), eq(transactions.type, "expense")))
      .limit(1);
    res.json({ data: { ...normalizeCategory(refreshed), hasFixedExpenses: !!hasFixed } });
    return;
  }

  const [hasFixed] = await db
    .select({ categoryId: transactions.categoryId })
    .from(transactions)
    .where(and(eq(transactions.categoryId, id), eq(transactions.isFixed, true), eq(transactions.type, "expense")))
    .limit(1);
  res.json({ data: { ...normalizeCategory(updated), hasFixedExpenses: !!hasFixed } });
}

export async function deleteAllCategories(req: AuthRequest, res: Response): Promise<void> {
  // FK onDelete:'set null' handles transactions automatically
  await db.delete(categories).where(eq(categories.userId, req.userId!));
  res.json({ success: true });
}

export async function deleteCategory(req: AuthRequest, res: Response): Promise<void> {
  const id = req.params["id"] as string;

  const [existing] = await db
    .select({ userId: categories.userId })
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  if (existing.userId !== req.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const refs = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(eq(transactions.categoryId, id))
    .limit(1);

  if (refs.length > 0) {
    res.status(400).json({
      error: "Cannot delete category with existing transactions. Reassign or delete them first.",
    });
    return;
  }

  await db.delete(categories).where(eq(categories.id, id));
  res.json({ success: true });
}
