import { randomBytes } from "crypto";

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const NUMERIC = "0123456789";

function randomFrom(alphabet: string, length: number): string {
  const bytes = randomBytes(length);
  return Array.from(bytes)
    .map((b) => alphabet[b % alphabet.length])
    .join("");
}

export function generateInviteCode(): string {
  return `${randomFrom(ALPHA, 4)}-${randomFrom(NUMERIC, 4)}`;
}
