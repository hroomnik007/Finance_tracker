import { Router } from "express";
import { authenticateToken } from "../middleware/authenticate";
import {
  listSavingsGoals,
  createSavingsGoal,
  updateSavingsGoal,
  deleteSavingsGoal,
} from "../controllers/savings.controller";

const router = Router();

router.use(authenticateToken);

router.get("/",     listSavingsGoals);
router.post("/",    createSavingsGoal);
router.patch("/:id", updateSavingsGoal);
router.delete("/:id", deleteSavingsGoal);

export default router;
