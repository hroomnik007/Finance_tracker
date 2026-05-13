import { Router, Request, Response, NextFunction } from "express";
import { verifyAdminToken } from "../lib/tokens";
import { getStats, getUserList } from "../controllers/admin.controller";

function authenticateAdmin(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Admin token required" });
    return;
  }
  const token = header.slice(7);
  try {
    verifyAdminToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired admin token" });
  }
}

const router = Router();

router.use(authenticateAdmin);
router.get("/stats", getStats);
router.get("/users", getUserList);

export default router;
