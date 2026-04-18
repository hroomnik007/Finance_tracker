import { Router } from "express";
import { authenticateToken } from "../middleware/authenticate";
import {
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getSummary,
} from "../controllers/transactions.controller";

const router = Router();

router.use(authenticateToken);

router.get("/summary", getSummary);
router.get("/",        listTransactions);
router.post("/",       createTransaction);
router.put("/:id",     updateTransaction);
router.delete("/:id",  deleteTransaction);

export default router;
