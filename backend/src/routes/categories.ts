import { Router } from "express";
import { authenticateToken } from "../middleware/authenticate";

const router = Router();

router.use(authenticateToken);

// GET    /api/categories
// POST   /api/categories
// PUT    /api/categories/:id
// DELETE /api/categories/:id

export default router;
