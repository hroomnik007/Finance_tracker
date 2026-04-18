import { Router } from "express";
import { authenticate } from "../middleware/authenticate";

const router = Router();

router.use(authenticate);

// GET    /api/categories
// POST   /api/categories
// PUT    /api/categories/:id
// DELETE /api/categories/:id

export default router;
