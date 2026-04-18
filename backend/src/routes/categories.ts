import { Router } from "express";
import { authenticateToken } from "../middleware/authenticate";
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/categories.controller";

const router = Router();

router.use(authenticateToken);

router.get("/",    listCategories);
router.post("/",   createCategory);
router.put("/:id", updateCategory);
router.delete("/:id", deleteCategory);

export default router;
