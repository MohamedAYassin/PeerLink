import axios from "axios";
import { storageRepository } from "../repositories/storage.repository";

export class WebhookService {
  async triggerWebhook(event: string, data: any) {
    const webhooks = storageRepository.getWebhookEndpoints();
    console.log(
      `Triggering webhook: ${event} (${webhooks.size} registered)`
    );

    for (const [webhookId, webhook] of webhooks) {
      if (!webhook.active || !webhook.events.includes(event as any)) {
        continue;
      }

      try {
        await axios.post(webhook.url, {
          event,
          timestamp: new Date().toISOString(),
          data,
        });
        console.log(`Webhook ${webhookId} delivered`);
      } catch (error) {
        console.error(`Webhook ${webhookId} failed:`, error);
      }
    }
  }
}

export const webhookService = new WebhookService();
