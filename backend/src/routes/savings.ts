import { Router } from "express";
import { authenticateToken } from "../middleware/authenticate";
import {
  listSavingsGoals,
  createSavingsGoal,
  updateSavingsGoal,
  deleteSavingsGoal,
  pauseSavingsGoal,
  resumeSavingsGoal,
} from "../controllers/savings.controller";

const router = Router();

router.use(authenticateToken);

router.get("/",     listSavingsGoals);
router.post("/",    createSavingsGoal);
router.patch("/:id", updateSavingsGoal);
router.patch("/:id/pause", pauseSavingsGoal);
router.patch("/:id/resume", resumeSavingsGoal);
router.delete("/:id", deleteSavingsGoal);

export default router;
