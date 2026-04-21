import { Response } from "express";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, webauthnCredentials, refreshTokens } from "../db/schema";
import { AuthRequest } from "../middleware/authenticate";
import {
  signAccessToken,
  signRefreshToken,
  hashToken,
  refreshTokenExpiry,
  REFRESH_COOKIE,
  REFRESH_COOKIE_OPTIONS,
} from "../lib/tokens";

const RP_NAME = "Finvu";
const RP_ID = process.env.WEBAUTHN_RP_ID ?? "financie.pedani.eu";
const ORIGIN = process.env.WEBAUTHN_ORIGIN ?? "https://financie.pedani.eu";

const challengeStore = new Map<string, { challenge: string; expiresAt: number }>();

function storeChallenge(key: string, challenge: string) {
  challengeStore.set(key, { challenge, expiresAt: Date.now() + 5 * 60 * 1000 });
}

function consumeChallenge(key: string): string | null {
  const entry = challengeStore.get(key);
  challengeStore.delete(key);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry.challenge;
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

function userPublic(u: typeof users.$inferSelect) {
  return {
    id: u.id, email: u.email, name: u.name, avatarUrl: u.avatarUrl ?? null,
    role: u.role ?? 'user', weeklyEmailEnabled: u.weeklyEmailEnabled ?? false,
    monthlyEmailEnabled: u.monthlyEmailEnabled ?? false,
    onboardingComplete: u.onboardingComplete ?? false,
    currentStreak: u.currentStreak ?? 0, longestStreak: u.longestStreak ?? 0,
    badges: u.badges ?? [],
  };
}

// GET /api/auth/webauthn/register-options
export async function webauthnRegisterOptions(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const existingCreds = await db
    .select({ credentialId: webauthnCredentials.credentialId })
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.userId, userId));

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: new TextEncoder().encode(user.id),
    userName: user.email,
    userDisplayName: user.name,
    excludeCredentials: existingCreds.map(c => ({ id: c.credentialId, type: 'public-key' as const })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  storeChallenge(userId, options.challenge);
  res.json(options);
}

// POST /api/auth/webauthn/register-verify
export async function webauthnRegisterVerify(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const body = req.body as RegistrationResponseJSON;

  const expectedChallenge = consumeChallenge(userId);
  if (!expectedChallenge) { res.status(400).json({ error: "Challenge vypršal." }); return; }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: false,
    });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message }); return;
  }

  if (!verification.verified || !verification.registrationInfo) {
    res.status(400).json({ error: "Registrácia zlyhala." }); return;
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  await db.insert(webauthnCredentials).values({
    userId,
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64'),
    counter: credential.counter,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
  });

  res.json({ success: true });
}

// GET /api/auth/webauthn/authenticate-options?email=...
export async function webauthnAuthenticateOptions(req: any, res: Response): Promise<void> {
  const email = req.query.email as string | undefined;

  let allowCredentials: { id: string; type: 'public-key' }[] = [];
  let challengeKey = email ?? 'anonymous';

  if (email) {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (user) {
      const creds = await db
        .select({ credentialId: webauthnCredentials.credentialId })
        .from(webauthnCredentials)
        .where(eq(webauthnCredentials.userId, user.id));
      allowCredentials = creds.map(c => ({ id: c.credentialId, type: 'public-key' as const }));
      challengeKey = user.id;
    }
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials,
    userVerification: 'preferred',
  });

  storeChallenge(challengeKey, options.challenge);
  res.json({ ...options, _challengeKey: challengeKey });
}

// POST /api/auth/webauthn/authenticate-verify
export async function webauthnAuthenticateVerify(req: any, res: Response): Promise<void> {
  const body = req.body as AuthenticationResponseJSON & { _challengeKey?: string };
  const challengeKey = body._challengeKey;
  if (!challengeKey) { res.status(400).json({ error: "Chýba challengeKey." }); return; }

  const expectedChallenge = consumeChallenge(challengeKey);
  if (!expectedChallenge) { res.status(400).json({ error: "Challenge vypršal." }); return; }

  const [storedCred] = await db
    .select()
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.credentialId, body.id))
    .limit(1);

  if (!storedCred) { res.status(401).json({ error: "Neznáme zariadenie." }); return; }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: storedCred.credentialId,
        publicKey: new Uint8Array(Buffer.from(storedCred.publicKey, 'base64')),
        counter: storedCred.counter,
      },
      requireUserVerification: false,
    });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message }); return;
  }

  if (!verification.verified) { res.status(401).json({ error: "Overenie zlyhalo." }); return; }

  await db.update(webauthnCredentials)
    .set({ counter: verification.authenticationInfo.newCounter })
    .where(eq(webauthnCredentials.id, storedCred.id));

  const [user] = await db.select().from(users).where(eq(users.id, storedCred.userId)).limit(1);
  if (!user) { res.status(404).json({ error: "Používateľ nenájdený." }); return; }

  const accessToken = await issueTokens(res, user.id, user.email);
  res.json({ user: userPublic(user), accessToken });
}
