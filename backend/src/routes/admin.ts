import { Router, Response, NextFunction } from "express";
import { authenticateToken, AuthRequest } from "../middleware/authenticate";
import { getStats, getUserList } from "../controllers/admin.controller";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, req.userId!)).limit(1);
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

const router = Router();

router.use(authenticateToken, requireAdmin);
router.get("/stats", getStats);
router.get("/users", getUserList);

export default router;
