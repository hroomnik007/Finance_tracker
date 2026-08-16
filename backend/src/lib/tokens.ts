import jwt from "jsonwebtoken";
import { createHash, timingSafeEqual, randomBytes } from "crypto";
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

export const ADMIN_COOKIE = "adminToken";

export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: (env.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
  maxAge: 4 * 60 * 60 * 1000,
  path: "/api/admin",
};

// sameSite: "none" is required because the admin UI (finvu.pedani.eu) and
// API (api.pedani.eu) are different subdomains — but that also means the
// browser attaches ADMIN_COOKIE on cross-site requests, opening a CSRF hole
// on any mutating /api/admin route. This second cookie is deliberately NOT
// httpOnly so frontend JS can read it and echo it back as a header
// (double-submit pattern) — requireAdminCsrf in routes/admin.ts rejects any
// non-GET request where the header doesn't match this cookie, which a
// cross-site attacker cannot forge since they can't read our cookies.
export const ADMIN_CSRF_COOKIE = "adminCsrf";
export const ADMIN_CSRF_HEADER = "x-admin-csrf-token";

export const ADMIN_CSRF_COOKIE_OPTIONS = {
  httpOnly: false,
  secure: env.NODE_ENV === "production",
  sameSite: (env.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
  maxAge: 4 * 60 * 60 * 1000,
  path: "/api/admin",
};

// ── PIN device binding ──────────────────────────────────────────────────────
// PIN login is a full-strength remote credential (same privilege as password
// login), so a bare email+PIN must not be enough from an arbitrary browser —
// it must also present a token proving it's a device the PIN was actually set
// up on. Issued by updatePin, verified (and slid forward) by pinLogin, wiped
// by updatePin/removePin/changePassword/resetPassword. Same opaque-token +
// SHA-256-hash-at-rest pattern as REFRESH_COOKIE (see hashToken/compareToken
// above) — never stored or logged in plaintext.
export const PIN_DEVICE_COOKIE = "pinDevice";

export function generatePinDeviceToken(): string {
  return randomBytes(32).toString("hex");
}

export function pinDeviceTokenExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  return d;
}

// sameSite: "none" (prod) matches REFRESH_COOKIE/ADMIN_COOKIE in this file —
// the frontend and API are served from different subdomains, and a stricter
// SameSite value is silently never sent cross-site, which would make PIN
// login appear to work in local dev (same-origin) and then fail for every
// user in production. httpOnly + a dedicated, narrowly-scoped, short-lived
// (relative to the refresh cookie) opaque token is the actual defense here,
// not the SameSite attribute.
export const PIN_DEVICE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: (env.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
  maxAge: 90 * 24 * 60 * 60 * 1000,
  path: "/api/auth",
};
