import { Request, Response } from "express";
import { storageRepository } from "../repositories/storage.repository";
import { validateRequired } from "../validators/input.validator";

export class WebhookController {
  async registerWebhook(req: Request, res: Response) {
    validateRequired(req.body, ["url"]);
    const { url, events } = req.body;

    const webhookId = `webhook-${Date.now()}`;
    storageRepository.getWebhookEndpoints().set(webhookId, {
      url,
      events: events || [
        "client-connected",
        "client-disconnected",
        "upload-complete",
        "download-complete",
      ],
      active: true,
    });

    res.json({ success: true, webhookId, message: "Webhook registered" });
  }
}

export const webhookController = new WebhookController();
