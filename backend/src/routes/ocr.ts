import { Router } from "express";
import multer from "multer";
import { scanReceipt } from "../controllers/ocr.controller";
import { authenticateToken } from "../middleware/authenticate";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Iba obrázky sú povolené."));
  },
});

const router = Router();
router.post("/scan", authenticateToken, upload.single("image"), scanReceipt);

export default router;
