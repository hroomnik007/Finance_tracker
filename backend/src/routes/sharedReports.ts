import { Router } from "express";
import rateLimit from "express-rate-limit";
import { createSharedReport, getSharedReport } from "../controllers/sharedReports.controller";
import { authenticateToken } from "../middleware/authenticate";

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

const router = Router();
router.post("/", authenticateToken, limiter, createSharedReport);
router.get("/:token", limiter, getSharedReport);

export default router;
