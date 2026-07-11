import jwt from "jsonwebtoken";
import { createHash, timingSafeEqual } from "crypto";
import { env } from "../config/env";

// Refresh tokens are high-entropy, machine-generated opaque strings (unlike
// passwords, which are low-entropy and need bcrypt's slow, salted hashing to
// resist brute-force/dictionary attacks). bcrypt also silently truncates its
// input at 72 bytes — a signed refresh-token JWT exceeds that well before the
// parts that vary between tokens (iat/exp/signature), so every token issued
// to the same user used to hash identically. SHA-256 has no such truncation
// and is the standard choice for hashing opaque token secrets.
function sha256Hex(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface AccessTokenPayload {
  userId: string;
  email: string;
}

export interface AdminTokenPayload {
  role: "admin";
  sub: "admin";
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: "15m" });
}

export function signRefreshToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: "30d" });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as AccessTokenPayload;
}

export function signAdminToken(): string {
  return jwt.sign({ role: "admin", sub: "admin" }, env.JWT_ADMIN_SECRET, { expiresIn: "4h" });
}

export function verifyAdminToken(token: string): AdminTokenPayload {
  const payload = jwt.verify(token, env.JWT_ADMIN_SECRET) as AdminTokenPayload;
  if (payload.role !== "admin" || payload.sub !== "admin") throw new Error("Not an admin token");
  return payload;
}

export function hashToken(token: string): Promise<string> {
  return Promise.resolve(sha256Hex(token));
}

export function compareToken(token: string, hash: string): Promise<boolean> {
  const a = Buffer.from(sha256Hex(token), "hex");
  const b = Buffer.from(hash, "hex");
  // Old bcrypt-hashed rows (pre-fix) won't decode to a 32-byte buffer and
  // must not match — also guards timingSafeEqual, which throws on unequal
  // lengths instead of returning false.
  if (a.length !== b.length) return Promise.resolve(false);
  return Promise.resolve(timingSafeEqual(a, b));
}

export function refreshTokenExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d;
}

export const REFRESH_COOKIE = "refreshToken";

export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: (env.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: "/api/auth",
};
