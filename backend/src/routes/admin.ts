import { Router, Request, Response, NextFunction } from "express";
import { verifyAdminToken, ADMIN_COOKIE } from "../lib/tokens";
import { getStats, getUserList } from "../controllers/admin.controller";
import { adminLogout } from "../controllers/auth.controller";

function authenticateAdmin(req: Request, res: Response, next: NextFunction): void {
  const token: string | undefined = req.cookies?.[ADMIN_COOKIE];
  if (!token) {
    res.status(401).json({ error: "Admin token required" });
    return;
  }
  try {
    verifyAdminToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired admin token" });
  }
}

const router = Router();

router.post("/logout", adminLogout);

router.use(authenticateAdmin);
router.get("/session", (_req, res) => res.json({ ok: true }));
router.get("/stats", getStats);
router.get("/users", getUserList);

export default router;
