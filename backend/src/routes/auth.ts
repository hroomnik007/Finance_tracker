import { Router } from "express";
import rateLimit from "express-rate-limit";
import { register, login, refresh, logout, me } from "../controllers/auth.controller";
import { authenticateToken } from "../middleware/authenticate";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

const router = Router();

router.post("/register", authLimiter, register);
router.post("/login",    authLimiter, login);
router.post("/refresh",  authLimiter, refresh);
router.post("/logout",   logout);
router.get("/me",        authenticateToken, me);

export default router;
