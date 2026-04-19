import { Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { users, transactions } from "../db/schema";
import { AuthRequest } from "../middleware/authenticate";

export async function getStats(req: AuthRequest, res: Response): Promise<void> {
  const [totalUsers] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  const [newUsers7d] = await db.select({ count: sql<number>`count(*)::int` }).from(users)
    .where(sql`${users.createdAt} >= now() - interval '7 days'`);
  const [totalTransactions] = await db.select({ count: sql<number>`count(*)::int` }).from(transactions);
  const [activeUsers30d] = await db.select({ count: sql<number>`count(distinct user_id)::int` }).from(transactions)
    .where(sql`${transactions.createdAt} >= now() - interval '30 days'`);

  res.json({
    totalUsers: totalUsers.count,
    newUsers7d: newUsers7d.count,
    totalTransactions: totalTransactions.count,
    activeUsers30d: activeUsers30d.count,
  });
}

export async function getUserList(req: AuthRequest, res: Response): Promise<void> {
  const userList = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      emailVerified: users.emailVerified,
    })
    .from(users)
    .orderBy(sql`${users.createdAt} desc`)
    .limit(200);
  res.json({ users: userList });
}
