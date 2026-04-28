import { Response } from "express";
import { and, eq, sql, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { households, householdMembers, users, transactions } from "../db/schema";
import { AuthRequest } from "../middleware/authenticate";
import { generateInviteCode } from "../utils/inviteCode";

const createSchema = z.object({
  name: z.string().min(1).max(100),
});

const joinSchema = z.object({
  invite_code: z.string().min(1),
});

async function getUniqueInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateInviteCode();
    const existing = await db
      .select({ id: households.id })
      .from(households)
      .where(eq(households.inviteCode, code))
      .limit(1);
    if (existing.length === 0) return code;
  }
  throw new Error("Failed to generate unique invite code");
}

async function assertMember(householdId: number, userId: string, res: Response): Promise<boolean> {
  const [membership] = await db
    .select({ id: householdMembers.id })
    .from(householdMembers)
    .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)))
    .limit(1);
  if (!membership) {
    res.status(403).json({ error: "Nie ste členom tohto domácnosti." });
    return false;
  }
  return true;
}

export async function createHousehold(req: AuthRequest, res: Response): Promise<void> {
  const body = createSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", details: body.error.errors });
    return;
  }

  const userId = req.userId!;
  const inviteCode = await getUniqueInviteCode();

  const [household] = await db
    .insert(households)
    .values({ name: body.data.name, inviteCode, createdBy: userId })
    .returning();

  await db.insert(householdMembers).values({ householdId: household.id, userId });

  await db
    .update(users)
    .set({ householdId: household.id, householdEnabled: true })
    .where(eq(users.id, userId));

  res.status(201).json({
    id: household.id,
    name: household.name,
    invite_code: household.inviteCode,
    created_at: household.createdAt,
  });
}

export async function joinHousehold(req: AuthRequest, res: Response): Promise<void> {
  const body = joinSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", details: body.error.errors });
    return;
  }

  const userId = req.userId!;

  const [household] = await db
    .select()
    .from(households)
    .where(eq(households.inviteCode, body.data.invite_code))
    .limit(1);

  if (!household) {
    res.status(404).json({ error: "Domácnosť s týmto kódom neexistuje." });
    return;
  }

  const [existing] = await db
    .select({ id: householdMembers.id })
    .from(householdMembers)
    .where(and(eq(householdMembers.householdId, household.id), eq(householdMembers.userId, userId)))
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "Ste už členom tejto domácnosti." });
    return;
  }

  await db.insert(householdMembers).values({ householdId: household.id, userId });

  await db
    .update(users)
    .set({ householdId: household.id, householdEnabled: true })
    .where(eq(users.id, userId));

  const [{ memberCount }] = await db
    .select({ memberCount: sql<number>`COUNT(*)` })
    .from(householdMembers)
    .where(eq(householdMembers.householdId, household.id));

  res.json({
    id: household.id,
    name: household.name,
    invite_code: household.inviteCode,
    member_count: Number(memberCount),
  });
}

export async function getMyHousehold(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;

  const [user] = await db
    .select({ householdId: users.householdId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.householdId) {
    res.status(404).json({ error: "Nie ste členom žiadnej domácnosti." });
    return;
  }

  const [household] = await db
    .select()
    .from(households)
    .where(eq(households.id, user.householdId))
    .limit(1);

  if (!household) {
    res.status(404).json({ error: "Domácnosť nenájdená." });
    return;
  }

  const members = await db
    .select({
      id: users.id,
      name: users.name,
      joinedAt: householdMembers.joinedAt,
    })
    .from(householdMembers)
    .innerJoin(users, eq(householdMembers.userId, users.id))
    .where(eq(householdMembers.householdId, household.id))
    .orderBy(householdMembers.joinedAt);

  res.json({
    id: household.id,
    name: household.name,
    invite_code: household.inviteCode,
    created_at: household.createdAt,
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      joined_at: m.joinedAt,
      is_owner: m.id === household.createdBy,
    })),
  });
}

export async function getHouseholdMembers(req: AuthRequest, res: Response): Promise<void> {
  const householdId = parseInt(req.params["id"] as string, 10);
  if (isNaN(householdId)) { res.status(400).json({ error: "Invalid household id" }); return; }

  const isMember = await assertMember(householdId, req.userId!, res);
  if (!isMember) return;

  const [household] = await db
    .select({ createdBy: households.createdBy })
    .from(households)
    .where(eq(households.id, householdId))
    .limit(1);

  const members = await db
    .select({
      userId: users.id,
      name: users.name,
      joinedAt: householdMembers.joinedAt,
    })
    .from(householdMembers)
    .innerJoin(users, eq(householdMembers.userId, users.id))
    .where(eq(householdMembers.householdId, householdId))
    .orderBy(householdMembers.joinedAt);

  res.json(
    members.map((m) => ({
      user_id: m.userId,
      name: m.name,
      joined_at: m.joinedAt,
      is_owner: m.userId === household?.createdBy,
    }))
  );
}

export async function getMonthlyStats(req: AuthRequest, res: Response): Promise<void> {
  const householdId = parseInt(req.params["id"] as string, 10);
  if (isNaN(householdId)) { res.status(400).json({ error: "Invalid household id" }); return; }

  const isMember = await assertMember(householdId, req.userId!, res);
  if (!isMember) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const start = `${year}-${month}-01`;
  const nextMonth = now.getMonth() === 11 ? `${year + 1}-01-01` : `${year}-${String(now.getMonth() + 2).padStart(2, "0")}-01`;

  const rows = await db
    .select({
      createdBy: transactions.createdBy,
      type: transactions.type,
      total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
      creatorName: users.name,
    })
    .from(transactions)
    .leftJoin(users, eq(transactions.createdBy, users.id))
    .where(
      and(
        eq(transactions.householdId, householdId),
        sql`${transactions.date} >= ${start}`,
        sql`${transactions.date} < ${nextMonth}`
      )
    )
    .groupBy(transactions.createdBy, transactions.type, users.name);

  const memberMap = new Map<string, { user_id: string; name: string; expenses: number; income: number }>();

  for (const row of rows) {
    const uid = row.createdBy ?? "unknown";
    if (!memberMap.has(uid)) {
      memberMap.set(uid, { user_id: uid, name: row.creatorName ?? "Unknown", expenses: 0, income: 0 });
    }
    const entry = memberMap.get(uid)!;
    if (row.type === "expense") entry.expenses += parseFloat(row.total);
    else entry.income += parseFloat(row.total);
  }

  const perMember = Array.from(memberMap.values());
  const totalExpenses = perMember.reduce((s, m) => s + m.expenses, 0);
  const totalIncome = perMember.reduce((s, m) => s + m.income, 0);

  res.json({ total_expenses: totalExpenses, total_income: totalIncome, per_member: perMember });
}

export async function getActivity(req: AuthRequest, res: Response): Promise<void> {
  const householdId = parseInt(req.params["id"] as string, 10);
  if (isNaN(householdId)) { res.status(400).json({ error: "Invalid household id" }); return; }

  const isMember = await assertMember(householdId, req.userId!, res);
  if (!isMember) return;

  const limitRaw = parseInt((req.query["limit"] as string) ?? "10", 10);
  const limit = Math.min(isNaN(limitRaw) ? 10 : limitRaw, 50);

  const rows = await db
    .select({
      type: transactions.type,
      amount: transactions.amount,
      description: transactions.description,
      createdByName: users.name,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .leftJoin(users, eq(transactions.createdBy, users.id))
    .where(eq(transactions.householdId, householdId))
    .orderBy(desc(transactions.createdAt))
    .limit(limit);

  res.json(
    rows.map((r) => ({
      type: r.type,
      amount: parseFloat(r.amount as string),
      description: r.description,
      created_by_name: r.createdByName,
      created_at: r.createdAt,
    }))
  );
}

export async function leaveHousehold(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;

  const [user] = await db
    .select({ householdId: users.householdId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.householdId) {
    res.status(400).json({ error: "Nie ste členom žiadnej domácnosti." });
    return;
  }

  const householdId = user.householdId;

  const [household] = await db
    .select()
    .from(households)
    .where(eq(households.id, householdId))
    .limit(1);

  await db
    .delete(householdMembers)
    .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)));

  await db
    .update(users)
    .set({ householdId: null, householdEnabled: false })
    .where(eq(users.id, userId));

  const remainingMembers = await db
    .select({ userId: householdMembers.userId, joinedAt: householdMembers.joinedAt })
    .from(householdMembers)
    .where(eq(householdMembers.householdId, householdId))
    .orderBy(householdMembers.joinedAt)
    .limit(1);

  if (remainingMembers.length === 0) {
    await db.delete(households).where(eq(households.id, householdId));
  } else if (household && household.createdBy === userId) {
    await db
      .update(households)
      .set({ createdBy: remainingMembers[0].userId })
      .where(eq(households.id, householdId));
  }

  res.json({ success: true });
}

export async function toggleHousehold(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { enabled } = req.body as { enabled?: boolean };

  if (typeof enabled !== "boolean") {
    res.status(400).json({ error: "enabled (boolean) is required" });
    return;
  }

  await db.update(users).set({ householdEnabled: enabled }).where(eq(users.id, userId));

  res.json({ household_enabled: enabled });
}
