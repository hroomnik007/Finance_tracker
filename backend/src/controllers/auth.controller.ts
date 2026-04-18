import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { users, refreshTokens, categories } from "../db/schema";
import { env } from "../config/env";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  compareToken,
  refreshTokenExpiry,
  REFRESH_COOKIE,
  REFRESH_COOKIE_OPTIONS,
} from "../lib/tokens";
import { DEFAULT_CATEGORIES } from "../lib/defaultCategories";
import { AuthRequest } from "../middleware/authenticate";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function userPublic(u: { id: string; email: string; name: string }) {
  return { id: u.id, email: u.email, name: u.name };
}

async function issueTokens(
  res: Response,
  userId: string,
  email: string
): Promise<string> {
  const accessToken = signAccessToken({ userId, email });
  const refreshToken = signRefreshToken({ userId, email });
  const tokenHash = await hashToken(refreshToken);

  await db.insert(refreshTokens).values({
    userId,
    tokenHash,
    expiresAt: refreshTokenExpiry(),
  });

  res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);
  return accessToken;
}

export async function register(req: Request, res: Response): Promise<void> {
  const body = registerSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", details: body.error.errors });
    return;
  }

  const { email, password, name } = body.data;

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, name })
    .returning({ id: users.id, email: users.email, name: users.name });

  await db.insert(categories).values(
    DEFAULT_CATEGORIES.map((c) => ({ ...c, userId: user.id, isDefault: true }))
  );

  const accessToken = await issueTokens(res, user.id, user.email);
  res.status(201).json({ user: userPublic(user), accessToken });
}

export async function login(req: Request, res: Response): Promise<void> {
  const body = loginSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", details: body.error.errors });
    return;
  }

  const { email, password } = body.data;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const accessToken = await issueTokens(res, user.id, user.email);
  res.json({ user: userPublic(user), accessToken });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const token: string | undefined = req.cookies?.[REFRESH_COOKIE];
  if (!token) {
    res.status(401).json({ error: "No refresh token" });
    return;
  }

  let payload: { userId: string; email: string };
  try {
    payload = verifyRefreshToken(token);
  } catch {
    res.status(401).json({ error: "Invalid refresh token" });
    return;
  }

  const stored = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.userId, payload.userId));

  let matchedRow: (typeof stored)[number] | undefined;
  for (const row of stored) {
    if (await compareToken(token, row.tokenHash)) {
      matchedRow = row;
      break;
    }
  }

  if (!matchedRow) {
    res.status(401).json({ error: "Refresh token not recognized" });
    return;
  }

  if (matchedRow.expiresAt < new Date()) {
    await db.delete(refreshTokens).where(eq(refreshTokens.id, matchedRow.id));
    res.status(401).json({ error: "Refresh token expired" });
    return;
  }

  const accessToken = signAccessToken({ userId: payload.userId, email: payload.email });
  res.json({ accessToken });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const token: string | undefined = req.cookies?.[REFRESH_COOKIE];

  if (token) {
    try {
      const payload = verifyRefreshToken(token);
      const stored = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.userId, payload.userId));

      for (const row of stored) {
        if (await compareToken(token, row.tokenHash)) {
          await db.delete(refreshTokens).where(eq(refreshTokens.id, row.id));
          break;
        }
      }
    } catch {
      // token invalid — still clear the cookie
    }
  }

  res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_OPTIONS.path });
  res.json({ success: true });
}

export async function me(req: AuthRequest, res: Response): Promise<void> {
  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, req.userId!))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ user: userPublic(user) });
}
