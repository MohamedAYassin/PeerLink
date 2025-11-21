import { Router } from "express";
import { shareController } from "../controllers/share.controller";
import { asyncHandler } from "../utils/error.utils";

const router = Router();

router.post(
  "/share/create",
  asyncHandler(shareController.createShare.bind(shareController))
);
router.post(
  "/share/join",
  asyncHandler(shareController.joinShare.bind(shareController))
);

export default router;
