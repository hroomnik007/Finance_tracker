import { Router } from "express";
import { authenticate } from "../middleware/authenticate";

const router = Router();

router.use(authenticate);

// GET    /api/transactions
// POST   /api/transactions
// GET    /api/transactions/:id
// PUT    /api/transactions/:id
// DELETE /api/transactions/:id

export default router;
