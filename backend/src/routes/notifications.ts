import { Router } from "express";
import { authenticateToken } from "../middleware/authenticate";
import { getDismissed, dismissNotification } from "../controllers/notifications.controller";

const router = Router();

router.use(authenticateToken);
router.get("/dismissed", getDismissed);
router.post("/dismiss", dismissNotification);

export default router;
