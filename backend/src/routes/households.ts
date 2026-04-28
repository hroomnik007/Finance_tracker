import { Router } from "express";
import {
  createHousehold,
  joinHousehold,
  getMyHousehold,
  getHouseholdMembers,
  getMonthlyStats,
  getActivity,
  leaveHousehold,
  toggleHousehold,
} from "../controllers/households.controller";

const router = Router();

router.post("/", createHousehold);
router.post("/join", joinHousehold);
router.get("/me", getMyHousehold);
router.delete("/leave", leaveHousehold);
router.patch("/toggle", toggleHousehold);
router.get("/:id/members", getHouseholdMembers);
router.get("/:id/stats/monthly", getMonthlyStats);
router.get("/:id/activity", getActivity);

export default router;
