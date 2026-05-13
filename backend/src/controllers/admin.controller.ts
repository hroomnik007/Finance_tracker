import { Request, Response } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { users, transactions, categories } from "../db/schema";

export async function getStats(_req: Request, res: Response): Promise<void> {
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

export async function getUserList(_req: Request, res: Response): Promise<void> {
  const userList = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      emailVerified: users.emailVerified,
    })
    .from(users)
    .orderBy(sql`${users.createdAt} desc`)
    .limit(200);
  res.json({ users: userList });
}

export async function getUserTransactions(req: Request, res: Response): Promise<void> {
  const userId = req.params.id as string;
  const rows = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      description: transactions.description,
      date: transactions.date,
      isFixed: transactions.isFixed,
      categoryName: categories.name,
      categoryIcon: categories.icon,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(eq(transactions.userId, userId))
    .orderBy(sql`${transactions.date} desc`)
    .limit(100);
  res.json({ transactions: rows });
}
