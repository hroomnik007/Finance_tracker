import { Response } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { categories, transactions } from "../db/schema";
import { AuthRequest } from "../middleware/authenticate";

type CategoryRow = typeof categories.$inferSelect;
function normalizeCategory(row: CategoryRow) {
  return {
    ...row,
    budgetLimit: row.budgetLimit != null ? Number(row.budgetLimit) : null,
  };
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["income", "expense"]),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional(),
  budgetLimit: z.number().positive().nullable().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional(),
  budgetLimit: z.number().positive().nullable().optional(),
});

export async function listCategories(req: AuthRequest, res: Response): Promise<void> {
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, req.userId!))
    .orderBy(categories.type, categories.name);

  res.json({ data: rows.map(normalizeCategory) });
}

export async function createCategory(req: AuthRequest, res: Response): Promise<void> {
  const body = createSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", details: body.error.errors });
    return;
  }

  const { budgetLimit: bl, ...rest } = body.data
  const [row] = await db
    .insert(categories)
    .values({ ...rest, userId: req.userId!, budgetLimit: bl != null ? String(bl) : null })
    .returning();

  res.status(201).json({ data: normalizeCategory(row) });
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

  const { budgetLimit: bl, ...fields } = body.data
  const setData = {
    ...fields,
    ...(body.data.budgetLimit !== undefined ? { budgetLimit: bl != null ? String(bl) : null } : {}),
  }
  const [updated] = await db
    .update(categories)
    .set(setData)
    .where(and(eq(categories.id, id), eq(categories.userId, req.userId!)))
    .returning();

  res.json({ data: normalizeCategory(updated) });
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
