import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env";

const AVATAR_DIR = path.resolve(env.UPLOAD_DIR, "avatars");

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function parseImageDataUrl(dataUrl: string): { buffer: Buffer; ext: string } | null {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) return null;
  const header = dataUrl.slice(0, comma);
  const match = /^data:(image\/[a-z+.-]+);base64$/.exec(header);
  if (!match) return null;
  const ext = MIME_EXT[match[1]];
  if (!ext) return null;
  try {
    const buffer = Buffer.from(dataUrl.slice(comma + 1), "base64");
    if (buffer.length === 0) return null;
    return { buffer, ext };
  } catch {
    return null;
  }
}

/** Persist the avatar to disk and return the public URL path (with cache-buster). */
export async function saveAvatarFile(userId: string, buffer: Buffer, ext: string): Promise<string> {
  await fs.mkdir(AVATAR_DIR, { recursive: true });
  // Drop stale files with a different extension so only one avatar remains
  await Promise.all(
    Object.values(MIME_EXT)
      .filter((e) => e !== ext)
      .map((e) => fs.rm(path.join(AVATAR_DIR, `${userId}.${e}`), { force: true }))
  );
  await fs.writeFile(path.join(AVATAR_DIR, `${userId}.${ext}`), buffer);
  return `/uploads/avatars/${userId}.${ext}?v=${Date.now()}`;
}

export async function deleteAvatarFiles(userId: string): Promise<void> {
  await Promise.all(
    Object.values(MIME_EXT).map((e) =>
      fs.rm(path.join(AVATAR_DIR, `${userId}.${e}`), { force: true })
    )
  );
}
