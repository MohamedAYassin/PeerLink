import { Router } from "express";
import { uploadController } from "../controllers/upload.controller";
import { asyncHandler } from "../utils/error.utils";

const router = Router();

router.get("/uploads/:fileId", asyncHandler(uploadController.getUploadProgress));

export default router;

