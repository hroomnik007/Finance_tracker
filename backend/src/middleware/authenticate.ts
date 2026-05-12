import { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { verifyAccessToken } from "../lib/tokens";
import { db } from "../db";
import { users } from "../db/schema";

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.userId;
    req.userEmail = payload.email;
    // Fire-and-forget — skip for session-check so it can read the unmodified timestamp
    if (!req.originalUrl.endsWith("/session-check")) {
      db.update(users)
        .set({ lastActiveAt: new Date() })
        .where(eq(users.id, payload.userId))
        .catch(() => {});
    }
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired access token" });
  }
}
