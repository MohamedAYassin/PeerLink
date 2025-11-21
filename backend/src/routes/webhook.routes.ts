import { Router } from "express";
import { webhookController } from "../controllers/webhook.controller";
import { asyncHandler } from "../utils/error.utils";

const router = Router();

router.post("/webhooks", asyncHandler(webhookController.registerWebhook));

export default router;

