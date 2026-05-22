import { Router } from "express";
import { authenticateToken } from "../middleware/authenticate";
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  deleteAllCategories,
} from "../controllers/categories.controller";

const router = Router();

router.use(authenticateToken);

router.get("/",       listCategories);
router.post("/",      createCategory);
router.delete("/",    deleteAllCategories);
router.put("/:id",    updateCategory);
router.delete("/:id", deleteCategory);

export default router;
