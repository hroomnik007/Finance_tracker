import { Router } from "express";
import { authenticateToken } from "../middleware/authenticate";
import { getAchievements } from "../controllers/achievements.controller";

const router = Router();

router.use(authenticateToken);
router.get("/", getAchievements);

export default router;
