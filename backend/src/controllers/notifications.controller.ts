import { Response } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { notificationsDismissed } from "../db/schema";
import { AuthRequest } from "../middleware/authenticate";

export async function getDismissed(req: AuthRequest, res: Response): Promise<void> {
  const rows = await db
    .select({ key: notificationsDismissed.notificationKey })
    .from(notificationsDismissed)
    .where(eq(notificationsDismissed.userId, req.userId!));
  res.json({ data: rows.map(r => r.key) });
}

export async function dismissNotification(req: AuthRequest, res: Response): Promise<void> {
  const body = z.object({ key: z.string().min(1).max(255) }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error" });
    return;
  }
  await db
    .insert(notificationsDismissed)
    .values({ userId: req.userId!, notificationKey: body.data.key })
    .onConflictDoNothing();
  res.json({ success: true });
}
