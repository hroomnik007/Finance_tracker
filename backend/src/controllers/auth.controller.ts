import { randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { eq, and, gt, desc } from "drizzle-orm";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import { db } from "../db";
import { users, refreshTokens, categories, transactions, webauthnCredentials, households, passwordResetTokens, userSessions } from "../db/schema";
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
  ADMIN_COOKIE,
  ADMIN_COOKIE_OPTIONS,
  ADMIN_CSRF_COOKIE,
  ADMIN_CSRF_COOKIE_OPTIONS,
} from "../lib/tokens";
import { sendEmail, verificationEmailHtml, resetPasswordEmailHtml, resetPasswordEmailText } from "../lib/email";
import { DEFAULT_CATEGORIES } from "../lib/defaultCategories";
import { AuthRequest } from "../middleware/authenticate";
import { resetDemoAccount, DEMO_EMAIL } from "../lib/resetDemo";
import { parseImageDataUrl, saveAvatarFile, deleteAvatarFiles } from "../lib/avatarStorage";

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

function userPublic(u: {
  id: string; email: string; name: string; avatarUrl?: string | null; role?: string;
  weeklyEmailEnabled?: boolean; monthlyEmailEnabled?: boolean; onboardingComplete?: boolean;
  currentStreak?: number; longestStreak?: number; badges?: string[];
  defaultPage?: string | null; currencyFormat?: string | null;
  householdId?: number | null; householdEnabled?: boolean | null;
  savingsEnabled?: boolean | null;
  theme?: string | null;
  language?: string | null;
  trackingStartDate?: string | null;
  onboardingBannerDismissed?: boolean | null;
  pinHash?: string | null;
  autoLockMinutes?: number | null;
}) {
  return {
    id: u.id, email: u.email, name: u.name, avatarUrl: u.avatarUrl ?? null,
    role: u.role ?? 'user', weeklyEmailEnabled: u.weeklyEmailEnabled ?? false,
    monthlyEmailEnabled: u.monthlyEmailEnabled ?? false,
    onboardingComplete: u.onboardingComplete ?? false,
    currentStreak: u.currentStreak ?? 0, longestStreak: u.longestStreak ?? 0,
    badges: u.badges ?? [],
    defaultPage: u.defaultPage ?? 'dashboard',
    currencyFormat: u.currencyFormat ?? 'sk',
    household_id: u.householdId ?? null,
    household_enabled: u.householdEnabled ?? false,
    savings_enabled: u.savingsEnabled ?? false,
    theme: u.theme ?? null,
    language: u.language ?? null,
    tracking_start_date: u.trackingStartDate ?? null,
    onboarding_banner_dismissed: u.onboardingBannerDismissed ?? false,
    has_pin: !!u.pinHash,
    auto_lock_minutes: u.autoLockMinutes ?? null,
  };
}

function parseUA(ua: string): { deviceName: string; browser: string } {
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua)
  let browser = 'Unknown'
  if (/Chrome\/(\d+)/i.test(ua) && !/Chromium|OPR|Edg/i.test(ua)) {
    browser = `Chrome ${ua.match(/Chrome\/(\d+)/)?.[1] ?? ''}`
  } else if (/Firefox\/(\d+)/i.test(ua)) {
    browser = `Firefox ${ua.match(/Firefox\/(\d+)/)?.[1] ?? ''}`
  } else if (/Edg\/(\d+)/i.test(ua)) {
    browser = `Edge ${ua.match(/Edg\/(\d+)/)?.[1] ?? ''}`
  } else if (/OPR\/(\d+)/i.test(ua)) {
    browser = `Opera ${ua.match(/OPR\/(\d+)/)?.[1] ?? ''}`
  } else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) {
    browser = 'Safari'
  }
  let deviceName = 'Desktop'
  if (/iPhone/i.test(ua)) deviceName = 'iPhone'
  else if (/iPad/i.test(ua)) deviceName = 'iPad'
  else if (/Android/i.test(ua)) deviceName = isMobile ? 'Android Phone' : 'Android Tablet'
  else if (/Mac/i.test(ua)) deviceName = 'Mac'
  else if (/Windows/i.test(ua)) deviceName = 'Windows PC'
  else if (/Linux/i.test(ua)) deviceName = 'Linux'
  return { deviceName, browser }
}

async function createSession(userId: string, req: Request): Promise<string> {
  const ua = (req.headers['user-agent'] as string | undefined) ?? ''
  const rawIp = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ?? req.ip ?? ''
  const { deviceName, browser } = parseUA(ua)

  if (deviceName && browser) {
    const existing = await db.select({ id: userSessions.id })
      .from(userSessions)
      .where(and(eq(userSessions.userId, userId), eq(userSessions.deviceName, deviceName), eq(userSessions.browser, browser)))
      .limit(1)
    if (existing.length > 0) {
      await db.update(userSessions).set({ lastActive: new Date() }).where(eq(userSessions.id, existing[0].id))
      return existing[0].id
    }
  }

  const [session] = await db.insert(userSessions).values({
    userId,
    deviceName,
    browser,
    ip: rawIp,
    location: null,
  }).returning({ id: userSessions.id })

  // Non-blocking location lookup
  if (rawIp && rawIp !== '::1' && rawIp !== '127.0.0.1') {
    fetch(`http://ip-api.com/json/${rawIp}?fields=city,country`)
      .then(r => r.json())
      .then((data) => {
        const d = data as { city?: string; country?: string }
        const loc = [d.city, d.country].filter(Boolean).join(', ')
        if (loc) db.update(userSessions).set({ location: loc }).where(eq(userSessions.id, session.id)).catch(() => {})
      })
      .catch(() => {})
  }

  return session.id
}

async function issueTokens(res: Response, userId: string, email: string, req?: Request): Promise<{ accessToken: string; sessionId: string }> {
  const accessToken = signAccessToken({ userId, email });
  const refreshToken = signRefreshToken({ userId, email });
  const tokenHash = await hashToken(refreshToken);

  await db.insert(refreshTokens).values({ userId, tokenHash, expiresAt: refreshTokenExpiry() });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);

  const sessionId = req ? await createSession(userId, req) : randomUUID()
  return { accessToken, sessionId };
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
    .values({ email, passwordHash: passwordHash, name, emailVerified: false, verificationToken })
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

  if (!user.passwordHash) {
    res.status(401).json({ error: "Tento účet používa Google prihlásenie." });
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

  if (user.isDeactivated) {
    res.status(403).json({ error: "Váš účet je deaktivovaný. Pre reaktiváciu kontaktujte podporu.", code: "ACCOUNT_DEACTIVATED" });
    return;
  }

  // Reset demo account data on every login, then re-fetch the updated user record
  let loginUser = user;
  if (email === DEMO_EMAIL) {
    try {
      await resetDemoAccount(user.id);
      const [refreshed] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
      if (refreshed) loginUser = refreshed;
    } catch (e) {
      console.error("[demo-reset] failed:", e);
    }
  }

  const { accessToken, sessionId } = await issueTokens(res, loginUser.id, loginUser.email, req);
  res.json({ user: userPublic(loginUser), accessToken, sessionId });
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
    .where(and(eq(refreshTokens.userId, payload.userId), gt(refreshTokens.expiresAt, new Date())))
    .orderBy(desc(refreshTokens.createdAt));

  let matchedRow: (typeof stored)[number] | undefined;
  for (const row of stored) {
    if (await compareToken(token, row.tokenHash)) { matchedRow = row; break; }
  }

  if (!matchedRow) { res.status(401).json({ error: "Refresh token not recognized or expired" }); return; }

  const [tokenUser] = await db.select({ isDeactivated: users.isDeactivated }).from(users).where(eq(users.id, payload.userId)).limit(1);
  if (!tokenUser || tokenUser.isDeactivated) {
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, payload.userId));
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_OPTIONS.path });
    res.status(403).json({ error: "Účet je deaktivovaný.", code: "ACCOUNT_DEACTIVATED" });
    return;
  }

  if (matchedRow.revokedAt) {
    // This token was already rotated away — someone is replaying an old
    // refresh token, which means it was likely stolen. Kill every active
    // refresh token for the user so both the attacker and the legitimate
    // user are forced to log in again.
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, payload.userId));
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_OPTIONS.path });
    res.status(401).json({ error: "Refresh token reuse detected — all sessions revoked" });
    return;
  }

  // Rotate: revoke the token that was just used and issue a brand new one.
  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, matchedRow.id));

  const accessToken = signAccessToken({ userId: payload.userId, email: payload.email });
  const newRefreshToken = signRefreshToken({ userId: payload.userId, email: payload.email });
  const newTokenHash = await hashToken(newRefreshToken);
  await db.insert(refreshTokens).values({ userId: payload.userId, tokenHash: newTokenHash, expiresAt: refreshTokenExpiry() });
  res.cookie(REFRESH_COOKIE, newRefreshToken, REFRESH_COOKIE_OPTIONS);

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
    .select({
      id: users.id, email: users.email, name: users.name, avatarUrl: users.avatarUrl,
      role: users.role, weeklyEmailEnabled: users.weeklyEmailEnabled,
      monthlyEmailEnabled: users.monthlyEmailEnabled, onboardingComplete: users.onboardingComplete,
      currentStreak: users.currentStreak, longestStreak: users.longestStreak, badges: users.badges,
      defaultPage: users.defaultPage, currencyFormat: users.currencyFormat,
      householdId: users.householdId, householdEnabled: users.householdEnabled,
      savingsEnabled: users.savingsEnabled,
      theme: users.theme,
      language: users.language,
      autoLockMinutes: users.autoLockMinutes,
      trackingStartDate: users.trackingStartDate,
      onboardingBannerDismissed: users.onboardingBannerDismissed,
      pinHash: users.pinHash,
    })
    .from(users)
    .where(eq(users.id, req.userId!))
    .limit(1);

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  let householdInfo: { id: number; name: string; invite_code: string } | null = null;
  if (user.householdId) {
    const [h] = await db
      .select({ id: households.id, name: households.name, inviteCode: households.inviteCode })
      .from(households)
      .where(eq(households.id, user.householdId))
      .limit(1);
    if (h) householdInfo = { id: h.id, name: h.name, invite_code: h.inviteCode };
  }

  res.set('Cache-Control', 'no-store');
  res.json({
    user: {
      ...userPublic(user),
      household: householdInfo,
    },
  });
}

export async function updateAvatar(req: AuthRequest, res: Response): Promise<void> {
  const { avatarUrl } = req.body as { avatarUrl?: string };
  if (typeof avatarUrl !== 'string') {
    res.status(400).json({ error: "avatarUrl is required" });
    return;
  }

  // Empty string clears the avatar (fall back to initials)
  if (avatarUrl === '') {
    await deleteAvatarFiles(req.userId!);
    await db.update(users).set({ avatarUrl: null, updatedAt: new Date() }).where(eq(users.id, req.userId!));
    res.json({ success: true, avatarUrl: null });
    return;
  }

  // Photo upload: decode the data URL and store the image on disk — the DB
  // keeps only the public path, not megabytes of base64.
  if (avatarUrl.startsWith('data:image/')) {
    // ~10MB binary ≈ 13.7M base64 chars (matches the frontend file-size check)
    if (avatarUrl.length > 14_000_000) {
      res.status(413).json({ error: "Avatar too large (max 10MB)" });
      return;
    }
    const parsed = parseImageDataUrl(avatarUrl);
    if (!parsed) {
      res.status(400).json({ error: "Unsupported image format (png/jpeg/webp/gif)" });
      return;
    }
    const publicUrl = await saveAvatarFile(req.userId!, parsed.buffer, parsed.ext);
    await db.update(users).set({ avatarUrl: publicUrl, updatedAt: new Date() }).where(eq(users.id, req.userId!));
    res.json({ success: true, avatarUrl: publicUrl });
    return;
  }

  // Short non-URL string = emoji avatar, stored directly
  if (!avatarUrl.startsWith('http') && !avatarUrl.startsWith('/') && avatarUrl.length <= 16) {
    await deleteAvatarFiles(req.userId!);
    await db.update(users).set({ avatarUrl, updatedAt: new Date() }).where(eq(users.id, req.userId!));
    res.json({ success: true, avatarUrl });
    return;
  }

  res.status(400).json({ error: "avatarUrl must be an image data URL, an emoji, or empty" });
}

export async function demoLogin(req: Request, res: Response): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
  if (!user) {
    res.status(404).json({ error: "Demo account not available. Run db:seed-demo first." });
    return;
  }

  // Reset demo data, then re-fetch for updated household/savings state
  let loginUser = user;
  try {
    await resetDemoAccount(user.id);
    const [refreshed] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (refreshed) loginUser = refreshed;
  } catch (e) {
    console.error("[demo-reset] failed:", e);
  }

  const { accessToken, sessionId } = await issueTokens(res, loginUser.id, loginUser.email, req);
  res.json({ user: userPublic(loginUser), accessToken, sessionId });
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

  if (!email || !z.string().email().safeParse(email).success) {
    res.json({ message: OK_MSG });
    return;
  }

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (user) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
    await db.insert(passwordResetTokens).values({ userId: user.id, token, expiresAt });

    await sendEmail(
      email,
      "Obnova hesla — FinVu",
      resetPasswordEmailHtml(token),
      resetPasswordEmailText(token),
    );
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
  const [resetRecord] = await db
    .select()
    .from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.token, token), gt(passwordResetTokens.expiresAt, now)))
    .limit(1);

  if (!resetRecord) {
    res.status(400).json({ error: "Neplatný alebo vypršaný odkaz na obnovu hesla." });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, resetRecord.userId));

  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, resetRecord.id));
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, resetRecord.userId));

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
  const csrfToken = randomBytes(32).toString("hex");
  res.cookie(ADMIN_COOKIE, token, ADMIN_COOKIE_OPTIONS);
  res.cookie(ADMIN_CSRF_COOKIE, csrfToken, ADMIN_CSRF_COOKIE_OPTIONS);
  res.json({ success: true });
}

export async function adminLogout(_req: Request, res: Response): Promise<void> {
  res.clearCookie(ADMIN_COOKIE, { path: ADMIN_COOKIE_OPTIONS.path });
  res.clearCookie(ADMIN_CSRF_COOKIE, { path: ADMIN_CSRF_COOKIE_OPTIONS.path });
  res.json({ success: true });
}

export async function updateWeeklyEmail(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { enabled } = req.body as { enabled: boolean };
  await db.update(users).set({ weeklyEmailEnabled: !!enabled }).where(eq(users.id, userId));
  res.json({ weeklyEmailEnabled: !!enabled });
}

export async function updateUserSettings(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { onboardingComplete, monthlyEmailEnabled, defaultPage, currencyFormat, theme, savingsEnabled, trackingStartDate, onboardingBannerDismissed, language, autoLockMinutes } = req.body as {
    onboardingComplete?: boolean;
    monthlyEmailEnabled?: boolean;
    defaultPage?: string;
    currencyFormat?: string;
    theme?: string;
    savingsEnabled?: boolean;
    trackingStartDate?: string | null;
    onboardingBannerDismissed?: boolean;
    language?: string;
    autoLockMinutes?: number | null;
  };
  const VALID_PAGES = ['dashboard', 'income', 'variable-expenses', 'fixed-expenses', 'categories', 'settings'];
  const VALID_FORMATS = ['sk', 'en', 'de'];
  const VALID_THEMES = ['dark', 'light', 'system'];
  const VALID_LANGS = ['sk', 'cs', 'pl', 'hu', 'en'];
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof onboardingComplete === 'boolean') update.onboardingComplete = onboardingComplete;
  if (typeof monthlyEmailEnabled === 'boolean') update.monthlyEmailEnabled = monthlyEmailEnabled;
  if (typeof defaultPage === 'string' && VALID_PAGES.includes(defaultPage)) update.defaultPage = defaultPage;
  if (typeof currencyFormat === 'string' && VALID_FORMATS.includes(currencyFormat)) update.currencyFormat = currencyFormat;
  if (typeof theme === 'string' && VALID_THEMES.includes(theme)) update.theme = theme;
  if (typeof language === 'string' && VALID_LANGS.includes(language)) update.language = language;
  if (typeof savingsEnabled === 'boolean') update.savingsEnabled = savingsEnabled;
  if (trackingStartDate === null || (typeof trackingStartDate === 'string' && DATE_RE.test(trackingStartDate))) {
    update.trackingStartDate = trackingStartDate ?? null;
  }
  if (typeof onboardingBannerDismissed === 'boolean') update.onboardingBannerDismissed = onboardingBannerDismissed;
  if (autoLockMinutes === null || (typeof autoLockMinutes === 'number' && [0, 1, 5, 15].includes(autoLockMinutes))) {
    update.autoLockMinutes = autoLockMinutes;
  }
  await db.update(users).set(update).where(eq(users.id, userId));
  res.json({ success: true });
}

export async function googleAuth(req: Request, res: Response): Promise<void> {
  const { accessToken } = req.body as { accessToken?: string };
  if (!accessToken) {
    res.status(400).json({ error: "accessToken is required" });
    return;
  }

  let googleId: string;
  let email: string;
  let name: string;

  try {
    const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userinfoRes.ok) {
      res.status(401).json({ error: "Neplatný Google token." });
      return;
    }
    const info = await userinfoRes.json() as { sub: string; email: string; name: string; email_verified: boolean };
    if (!info.email || !info.sub) {
      res.status(401).json({ error: "Neplatný Google token." });
      return;
    }

    if (env.GOOGLE_CLIENT_ID) {
      const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
      if (!tokenInfoRes.ok) {
        res.status(401).json({ error: "Neplatný Google token." });
        return;
      }
      const tokenInfo = await tokenInfoRes.json() as { aud?: string; azp?: string };
      if (tokenInfo.aud !== env.GOOGLE_CLIENT_ID && tokenInfo.azp !== env.GOOGLE_CLIENT_ID) {
        res.status(401).json({ error: "Google token nebol vydaný pre túto aplikáciu." });
        return;
      }
    } else {
      console.warn("[googleAuth] GOOGLE_CLIENT_ID nie je nastavené — overenie audience Google tokenu bolo preskočené.");
    }

    googleId = info.sub;
    email = info.email;
    name = info.name || email.split("@")[0];
  } catch {
    res.status(401).json({ error: "Nepodarilo sa overiť Google token." });
    return;
  }

  let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (user?.isDeactivated) {
    res.status(403).json({ error: "Váš účet je deaktivovaný. Pre reaktiváciu kontaktujte podporu.", code: "ACCOUNT_DEACTIVATED" });
    return;
  }

  if (!user) {
    const [newUser] = await db
      .insert(users)
      .values({ email, passwordHash: null, name, emailVerified: true, googleId })
      .returning({ id: users.id, email: users.email, name: users.name, avatarUrl: users.avatarUrl, role: users.role, weeklyEmailEnabled: users.weeklyEmailEnabled });

    await db.insert(categories).values(
      DEFAULT_CATEGORIES.map((c) => ({ ...c, userId: newUser.id, isDefault: true }))
    );

    user = { ...newUser, passwordHash: null, googleId, emailVerified: true, verificationToken: null, resetToken: null, resetTokenExpiry: null, lastLoginAt: null, lastActiveAt: null, createdAt: new Date(), updatedAt: new Date(), monthlyEmailEnabled: false, onboardingComplete: false, currentStreak: 0, longestStreak: 0, lastActivityDate: null, badges: [], pinHash: null, defaultPage: 'dashboard', currencyFormat: 'sk', householdId: null, householdEnabled: false, savingsEnabled: false, theme: 'dark', language: 'sk', trackingStartDate: null, onboardingBannerDismissed: false, autoLockMinutes: null, isDeactivated: false };
  } else if (!user.googleId) {
    await db.update(users).set({ googleId, emailVerified: true }).where(eq(users.id, user.id));
  }

  const { accessToken: accessJwt, sessionId } = await issueTokens(res, user.id, user.email, req);
  res.json({ user: userPublic(user), accessToken: accessJwt, sessionId });
}

export async function deleteAccount(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { currentPassword } = req.body as { currentPassword?: string };

  const [user] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "Používateľ neexistuje." });
    return;
  }

  // Google-only accounts have no password to verify — nothing to check for them.
  if (user.passwordHash) {
    if (!currentPassword) {
      res.status(400).json({ error: "Pre zmazanie účtu zadajte aktuálne heslo." });
      return;
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Nesprávne aktuálne heslo." });
      return;
    }
  }

  await deleteAvatarFiles(userId);
  // Cascading deletes handle categories, transactions, refresh_tokens automatically
  await db.delete(users).where(eq(users.id, userId));

  res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_OPTIONS.path });
  res.json({ success: true });
}

// ── PIN login ──────────────────────────────────────────────────────────────

export async function pinLogin(req: Request, res: Response): Promise<void> {
  const { email, pin } = req.body as { email?: string; pin?: string };
  if (!email || !pin || typeof pin !== 'string' || pin.length !== 4) {
    res.status(400).json({ error: "Neplatná požiadavka." });
    return;
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !user.pinHash) {
    res.status(401).json({ error: "PIN prihlásenie nie je aktivované." });
    return;
  }

  const valid = await bcrypt.compare(pin, user.pinHash);
  if (!valid) {
    res.status(401).json({ error: "Nesprávny PIN." });
    return;
  }

  if (user.isDeactivated) {
    res.status(403).json({ error: "Váš účet je deaktivovaný. Pre reaktiváciu kontaktujte podporu.", code: "ACCOUNT_DEACTIVATED" });
    return;
  }

  const { accessToken, sessionId } = await issueTokens(res, user.id, user.email, req);
  res.json({ user: userPublic(user), accessToken, sessionId });
}

export async function updatePin(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { pin } = req.body as { pin?: string };
  if (!pin || typeof pin !== 'string' || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    res.status(400).json({ error: "PIN musí byť 4-miestne číslo." });
    return;
  }
  const pinHash = await bcrypt.hash(pin, env.BCRYPT_ROUNDS);
  await db.update(users).set({ pinHash, updatedAt: new Date() }).where(eq(users.id, userId));
  res.json({ success: true });
}

export async function removePin(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  await db.update(users).set({ pinHash: null, updatedAt: new Date() }).where(eq(users.id, userId));
  res.json({ success: true });
}

export async function changePassword(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };

  if (!currentPassword || !newPassword || newPassword.length < 8) {
    res.status(400).json({ error: "Neplatná požiadavka." });
    return;
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.passwordHash) {
    res.status(400).json({ error: "Zmena hesla nie je dostupná pre tento typ účtu." });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Nesprávne aktuálne heslo." });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
  res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_OPTIONS.path });
  res.json({ success: true });
}

export async function sessionCheck(req: AuthRequest, res: Response): Promise<void> {
  const [row] = await db
    .select({ lastActiveAt: users.lastActiveAt, autoLockMinutes: users.autoLockMinutes })
    .from(users)
    .where(eq(users.id, req.userId!))
    .limit(1);

  if (!row) { res.status(404).json({ error: "User not found" }); return; }

  if (row.autoLockMinutes === null) {
    res.json({ valid: true });
    return;
  }
  if (row.autoLockMinutes === 0) {
    res.json({ valid: false, reason: "timeout" });
    return;
  }
  const TIMEOUT_MS = row.autoLockMinutes * 60 * 1000;
  if (row.lastActiveAt && Date.now() - row.lastActiveAt.getTime() > TIMEOUT_MS) {
    res.json({ valid: false, reason: "timeout" });
  } else {
    res.json({ valid: true });
  }
}

export async function getSessions(req: AuthRequest, res: Response): Promise<void> {
  const sessions = await db
    .select()
    .from(userSessions)
    .where(eq(userSessions.userId, req.userId!))
    .orderBy(userSessions.createdAt)
  res.json({ data: sessions })
}

export async function deleteSession(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params as { id: string }
  const [session] = await db
    .select({ id: userSessions.id, userId: userSessions.userId })
    .from(userSessions)
    .where(eq(userSessions.id, id))
    .limit(1)
  if (!session || session.userId !== req.userId!) {
    res.status(404).json({ error: 'Session not found' })
    return
  }
  await db.delete(userSessions).where(eq(userSessions.id, id))
  res.json({ success: true })
}

export async function deactivateAccount(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!
  await db.update(users).set({ isDeactivated: true, updatedAt: new Date() }).where(eq(users.id, userId))
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId))
  res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_OPTIONS.path })
  res.json({ success: true })
}

export async function pingSession(req: AuthRequest, res: Response): Promise<void> {
  res.json({ ok: true });
}

export async function getAuthMethods(req: Request, res: Response): Promise<void> {
  const { email } = req.query as { email?: string }
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Email required' })
    return
  }
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1)
  if (!user) {
    res.json({ pin: false, google: false, password: false })
    return
  }
  res.json({
    pin: !!user.pinHash,
    google: !!user.googleId,
    password: !!user.passwordHash,
  })
}
