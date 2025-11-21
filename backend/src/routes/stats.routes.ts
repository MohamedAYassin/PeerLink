import { Router } from "express";
import { statsController } from "../controllers/stats.controller";
import { asyncHandler } from "../utils/error.utils";

const router = Router();

router.get("/stats", asyncHandler(statsController.getStats));

export default router;

