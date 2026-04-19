import { randomUUID, timingSafeEqual } from "crypto";
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { eq, and, gt } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { users, refreshTokens, categories, transactions } from "../db/schema";
import { env } from "../config/env";
import {
  signAccessToken,
  signRefreshToken,
  signAdminToken,
  verifyRefreshToken,
  hashToken,
  compareToken,
  refreshTokenExpiry,
  REFRESH_COOKIE,
  REFRESH_COOKIE_OPTIONS,
} from "../lib/tokens";
import { sendEmail, verificationEmailHtml, resetPasswordEmailHtml } from "../lib/email";
import { DEFAULT_CATEGORIES } from "../lib/defaultCategories";
import { AuthRequest } from "../middleware/authenticate";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(100),
  gdprConsent: z.boolean().refine(v => v === true, { message: "GDPR consent is required" }),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function userPublic(u: { id: string; email: string; name: string; avatarUrl?: string | null; role?: string }) {
  return { id: u.id, email: u.email, name: u.name, avatarUrl: u.avatarUrl ?? null, role: u.role ?? 'user' };
}

async function issueTokens(res: Response, userId: string, email: string): Promise<string> {
  const accessToken = signAccessToken({ userId, email });
  const refreshToken = signRefreshToken({ userId, email });
  const tokenHash = await hashToken(refreshToken);

  await db.insert(refreshTokens).values({ userId, tokenHash, expiresAt: refreshTokenExpiry() });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
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

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Email je už zaregistrovaný." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  const verificationToken = randomUUID();

  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, name, emailVerified: false, verificationToken })
    .returning({ id: users.id, email: users.email, name: users.name });

  await db.insert(categories).values(
    DEFAULT_CATEGORIES.map((c) => ({ ...c, userId: user.id, isDefault: true }))
  );

  await sendEmail(email, "Finvu — Overte váš email", verificationEmailHtml(verificationToken));

  res.status(201).json({ message: "Registrácia úspešná. Skontrolujte email a kliknite na overovací odkaz." });
}

export async function login(req: Request, res: Response): Promise<void> {
  const body = loginSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", details: body.error.errors });
    return;
  }

  const { email, password } = body.data;

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Nesprávne prihlasovacie údaje." });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Nesprávne prihlasovacie údaje." });
    return;
  }

  if (!user.emailVerified) {
    res.status(403).json({ error: "Prosím overte svoj email pred prihlásením.", code: "EMAIL_NOT_VERIFIED" });
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

  const stored = await db.select().from(refreshTokens).where(eq(refreshTokens.userId, payload.userId));

  let matchedRow: (typeof stored)[number] | undefined;
  for (const row of stored) {
    if (await compareToken(token, row.tokenHash)) { matchedRow = row; break; }
  }

  if (!matchedRow) { res.status(401).json({ error: "Refresh token not recognized" }); return; }
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
      const stored = await db.select().from(refreshTokens).where(eq(refreshTokens.userId, payload.userId));
      for (const row of stored) {
        if (await compareToken(token, row.tokenHash)) {
          await db.delete(refreshTokens).where(eq(refreshTokens.id, row.id));
          break;
        }
      }
    } catch { /* token invalid — still clear cookie */ }
  }
  res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_OPTIONS.path });
  res.json({ success: true });
}

export async function me(req: AuthRequest, res: Response): Promise<void> {
  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name, avatarUrl: users.avatarUrl, role: users.role })
    .from(users)
    .where(eq(users.id, req.userId!))
    .limit(1);

  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ user: userPublic(user) });
}

export async function updateAvatar(req: AuthRequest, res: Response): Promise<void> {
  const { avatarUrl } = req.body as { avatarUrl?: string };
  if (!avatarUrl || typeof avatarUrl !== 'string') {
    res.status(400).json({ error: "avatarUrl is required" });
    return;
  }
  if (avatarUrl.length > 2 * 1024 * 1024) {
    res.status(413).json({ error: "Avatar too large (max 2MB)" });
    return;
  }
  await db.update(users).set({ avatarUrl, updatedAt: new Date() }).where(eq(users.id, req.userId!));
  res.json({ success: true, avatarUrl });
}

export async function demoLogin(req: Request, res: Response): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.email, "demo@finvu.sk")).limit(1);
  if (!user) {
    res.status(404).json({ error: "Demo account not available. Run db:seed-demo first." });
    return;
  }
  const accessToken = await issueTokens(res, user.id, user.email);
  res.json({ user: userPublic(user), accessToken });
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const token = req.query.token as string | undefined;
  if (!token) {
    res.status(400).json({ error: "Chýba overovací token." });
    return;
  }

  const [user] = await db.select().from(users).where(eq(users.verificationToken, token)).limit(1);
  if (!user) {
    res.status(400).json({ error: "Neplatný alebo vypršaný overovací odkaz." });
    return;
  }

  await db
    .update(users)
    .set({ emailVerified: true, verificationToken: null })
    .where(eq(users.id, user.id));

  res.json({ message: "Email bol úspešne overený. Môžete sa prihlásiť." });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body as { email?: string };
  const OK_MSG = "Ak email existuje, bol odoslaný odkaz na obnovenie hesla.";

  if (!email) { res.json({ message: OK_MSG }); return; }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (user) {
    const resetToken = randomUUID();
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db
      .update(users)
      .set({ resetToken, resetTokenExpiry })
      .where(eq(users.id, user.id));

    await sendEmail(email, "Finvu — Obnova hesla", resetPasswordEmailHtml(resetToken));
  }

  res.json({ message: OK_MSG });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, newPassword } = req.body as { token?: string; newPassword?: string };

  if (!token || !newPassword || newPassword.length < 8) {
    res.status(400).json({ error: "Neplatná požiadavka." });
    return;
  }

  const now = new Date();
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.resetToken, token), gt(users.resetTokenExpiry, now)))
    .limit(1);

  if (!user) {
    res.status(400).json({ error: "Neplatný alebo vypršaný odkaz na obnovu hesla." });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  await db
    .update(users)
    .set({ passwordHash, resetToken: null, resetTokenExpiry: null })
    .where(eq(users.id, user.id));

  // Invalidate all refresh tokens
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, user.id));

  res.json({ message: "Heslo bolo úspešne zmenené." });
}

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufB, bufB); // dummy comparison to keep timing similar
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export async function adminLogin(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: "Username and password required" });
    return;
  }

  const userOk = safeCompare(username, env.ADMIN_USERNAME);
  const passOk = safeCompare(password, env.ADMIN_PASSWORD);

  if (!userOk || !passOk) {
    res.status(401).json({ error: "Nesprávne prihlasovacie údaje." });
    return;
  }

  const token = signAdminToken();
  res.json({ token });
}

export async function deleteAccount(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;

  // Cascading deletes handle categories, transactions, refresh_tokens automatically
  await db.delete(users).where(eq(users.id, userId));

  res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_OPTIONS.path });
  res.json({ success: true });
}
