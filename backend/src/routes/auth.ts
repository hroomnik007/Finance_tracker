import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  register, login, refresh, logout, me,
  verifyEmail, forgotPassword, resetPassword, deleteAccount,
  updateAvatar, demoLogin, adminLogin, updateWeeklyEmail, googleAuth, updateUserSettings,
  pinLogin, updatePin, removePin,
} from "../controllers/auth.controller";
import {
  webauthnRegisterOptions, webauthnRegisterVerify,
  webauthnAuthenticateOptions, webauthnAuthenticateVerify,
} from "../controllers/webauthn.controller";
import { authenticateToken } from "../middleware/authenticate";

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Príliš veľa pokusov. Skúste neskôr." },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Príliš veľa pokusov. Skúste neskôr." },
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Príliš veľa pokusov. Skúste neskôr." },
});

const router = Router();

router.post("/register",        registerLimiter, register);
router.post("/login",           loginLimiter,    login);
router.post("/refresh",         generalLimiter,  refresh);
router.post("/logout",          logout);
router.get("/me",               authenticateToken, me);
router.get("/verify-email",     generalLimiter, verifyEmail);
router.post("/forgot-password", generalLimiter, forgotPassword);
router.post("/reset-password",  generalLimiter, resetPassword);
router.delete("/account",       authenticateToken, deleteAccount);
router.patch("/avatar",         authenticateToken, updateAvatar);
router.patch("/weekly-email",   authenticateToken, updateWeeklyEmail);
router.patch("/settings",       authenticateToken, updateUserSettings);
router.get("/demo-login",       demoLogin);
router.post("/admin-login",     loginLimiter, adminLogin);
router.post("/google",          loginLimiter, googleAuth);
router.post("/pin-login",       loginLimiter, pinLogin);
router.patch("/pin",            authenticateToken, updatePin);
router.delete("/pin",           authenticateToken, removePin);

// WebAuthn
router.get("/webauthn/register-options",      authenticateToken, webauthnRegisterOptions);
router.post("/webauthn/register-verify",      authenticateToken, webauthnRegisterVerify);
router.get("/webauthn/authenticate-options",  webauthnAuthenticateOptions);
router.post("/webauthn/authenticate-verify",  webauthnAuthenticateVerify);

export default router;
