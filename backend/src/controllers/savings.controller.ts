import { Response } from "express";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { savingsGoals } from "../db/schema";
import { AuthRequest } from "../middleware/authenticate";

type SavingsGoalRow = typeof savingsGoals.$inferSelect;

function normalizeGoal(row: SavingsGoalRow) {
  return {
    ...row,
    targetAmount: Number(row.targetAmount),
    savedAmount: Number(row.savedAmount),
  };
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  targetAmount: z.number().positive(),
  savedAmount: z.number().min(0).optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  icon: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  note: z.string().max(500).nullable().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  targetAmount: z.number().positive().optional(),
  savedAmount: z.number().min(0).optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  icon: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  note: z.string().max(500).nullable().optional(),
});

export async function listSavingsGoals(req: AuthRequest, res: Response): Promise<void> {
  const rows = await db
    .select()
    .from(savingsGoals)
    .where(eq(savingsGoals.userId, req.userId!))
    .orderBy(sql`${savingsGoals.deadline} ASC NULLS LAST`);
  res.json({ data: rows.map(normalizeGoal) });
}

export async function createSavingsGoal(req: AuthRequest, res: Response): Promise<void> {
  const body = createSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", details: body.error.errors });
    return;
  }

  const { targetAmount, savedAmount, ...rest } = body.data;
  const [row] = await db
    .insert(savingsGoals)
    .values({
      ...rest,
      userId: req.userId!,
      targetAmount: String(targetAmount),
      savedAmount: savedAmount != null ? String(savedAmount) : "0",
    })
    .returning();

  res.status(201).json({ data: normalizeGoal(row) });
}

export async function updateSavingsGoal(req: AuthRequest, res: Response): Promise<void> {
  const id = req.params["id"] as string;

  const [existing] = await db
    .select({ userId: savingsGoals.userId })
    .from(savingsGoals)
    .where(eq(savingsGoals.id, id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Savings goal not found" });
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

  const { targetAmount, savedAmount, ...rest } = body.data;
  const setData = {
    ...rest,
    ...(targetAmount !== undefined ? { targetAmount: String(targetAmount) } : {}),
    ...(savedAmount !== undefined ? { savedAmount: String(savedAmount) } : {}),
    updatedAt: new Date(),
  };

  const [updated] = await db
    .update(savingsGoals)
    .set(setData)
    .where(eq(savingsGoals.id, id))
    .returning();

  res.json({ data: normalizeGoal(updated) });
}

export async function pauseSavingsGoal(req: AuthRequest, res: Response): Promise<void> {
  const id = req.params["id"] as string;
  const [existing] = await db.select({ userId: savingsGoals.userId }).from(savingsGoals).where(eq(savingsGoals.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Savings goal not found" }); return; }
  if (existing.userId !== req.userId) { res.status(403).json({ error: "Forbidden" }); return; }
  const [updated] = await db.update(savingsGoals).set({ paused: true, updatedAt: new Date() }).where(eq(savingsGoals.id, id)).returning();
  res.json({ data: normalizeGoal(updated) });
}

export async function resumeSavingsGoal(req: AuthRequest, res: Response): Promise<void> {
  const id = req.params["id"] as string;
  const [existing] = await db.select({ userId: savingsGoals.userId }).from(savingsGoals).where(eq(savingsGoals.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Savings goal not found" }); return; }
  if (existing.userId !== req.userId) { res.status(403).json({ error: "Forbidden" }); return; }
  const [updated] = await db.update(savingsGoals).set({ paused: false, updatedAt: new Date() }).where(eq(savingsGoals.id, id)).returning();
  res.json({ data: normalizeGoal(updated) });
}

export async function deleteSavingsGoal(req: AuthRequest, res: Response): Promise<void> {
  const id = req.params["id"] as string;

  const [existing] = await db
    .select({ userId: savingsGoals.userId })
    .from(savingsGoals)
    .where(eq(savingsGoals.id, id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Savings goal not found" });
    return;
  }
  if (existing.userId !== req.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(savingsGoals).where(eq(savingsGoals.id, id));
  res.json({ success: true });
}
