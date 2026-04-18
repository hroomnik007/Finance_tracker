import { Router } from "express";
import { authenticateToken } from "../middleware/authenticate";

const router = Router();

router.use(authenticateToken);

// GET    /api/transactions
// POST   /api/transactions
// GET    /api/transactions/:id
// PUT    /api/transactions/:id
// DELETE /api/transactions/:id

export default router;
