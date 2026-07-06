/**
 * One-off migration: move base64 avatars out of the users table onto disk.
 * Run inside the backend container:
 *   docker exec finance-tracker-repo-backend-1 node dist/scripts/migrate-avatars.js
 */
import { like, eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { parseImageDataUrl, saveAvatarFile } from "../lib/avatarStorage";

async function main() {
  const rows = await db
    .select({ id: users.id, avatarUrl: users.avatarUrl })
    .from(users)
    .where(like(users.avatarUrl, "data:image/%"));

  console.log(`Found ${rows.length} base64 avatar(s) to migrate`);

  let migrated = 0;
  let failed = 0;
  for (const row of rows) {
    const parsed = parseImageDataUrl(row.avatarUrl!);
    if (!parsed) {
      console.warn(`- user ${row.id}: unparseable avatar, clearing`);
      await db.update(users).set({ avatarUrl: null }).where(eq(users.id, row.id));
      failed++;
      continue;
    }
    const publicUrl = await saveAvatarFile(row.id, parsed.buffer, parsed.ext);
    await db.update(users).set({ avatarUrl: publicUrl }).where(eq(users.id, row.id));
    migrated++;
    console.log(`- user ${row.id}: → ${publicUrl.split("?")[0]}`);
  }

  console.log(`Done: ${migrated} migrated, ${failed} cleared`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Avatar migration failed:", err);
  process.exit(1);
});
