import { Request, Response } from "express";
import { storageRepository } from "../repositories/storage.repository";
import { ClusterManager } from "../services/cluster.service";
import { ErrorFactory } from "../utils/error.utils";
import { validateRequired } from "../validators/input.validator";
import { webhookService } from "../services/webhook.service";

export class ShareController {
  private clusterManager = ClusterManager.getInstance();

  async createShare(req: Request, res: Response) {
    validateRequired(req.body, ["clientId"]);
    const { clientId, shareId: customShareId } = req.body;

    let shareId: string;

    if (customShareId) {
      const existing = await storageRepository.getShareSession(customShareId);
      if (existing) {
        throw ErrorFactory.conflict("Share ID already exists");
      }
      shareId = customShareId;
    } else {
      shareId = `share-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;
    }

    // Create session object (will be stored in Redis/Memory)
    const shareSession = {
      shareId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      clients: [clientId],
      status: "active" as const,
    };

    await storageRepository.setShareSession(shareId, shareSession);

    const clientSession = await storageRepository.getClientSession(clientId);
    if (clientSession) {
      clientSession.shareId = shareId;
      await storageRepository.setClientSession(clientId, clientSession);

      // Notify cluster about share creation
      try {
        await this.clusterManager.handleShareCreate(clientId, shareId, {
          clients: [clientId],
          createdAt: Date.now(),
        });
      } catch (error) {
        console.warn("Failed to publish share creation:", error);
      }
    }

    // Notify the creator (and potential receiver if already present in share)
    // Usually createShare only has 1 client, but if we're recreating/updating:
    for (const cid of shareSession.clients) {
      console.log(`Sending connection-ready to ${cid} via cluster`);
      await this.clusterManager.routeMessageToClient(cid, "connection-ready", {
        shareId,
        connectedClients: shareSession.clients.length,
        message: "Share session created - Waiting for others to join",
      });
    }

    res.json({ success: true, shareId, message: "Share session created" });
  }

  async joinShare(req: Request, res: Response) {
    validateRequired(req.body, ["shareId", "clientId"]);
    const { shareId, clientId } = req.body;

    const shareSession = await storageRepository.getShareSession(shareId);

    if (!shareSession) {
      throw ErrorFactory.notFound("Share session not found");
    }

    if (shareSession.status === "inactive") {
      throw ErrorFactory.badRequest("Share session is inactive");
    }

    if (shareSession.clients.length >= 2) {
      throw ErrorFactory.shareSessionFull(shareId);
    }

    shareSession.clients.push(clientId);
    shareSession.lastActivity = Date.now();
    await storageRepository.setShareSession(shareId, shareSession);

    const clientSession = await storageRepository.getClientSession(clientId);
    if (clientSession) {
      clientSession.shareId = shareId;
      await storageRepository.setClientSession(clientId, clientSession);
    }

    // Notify all clients in the share session (including the one joining)
    console.log(
      `Notifying ${shareSession.clients.length} clients about join:`,
      shareSession.clients
    );
    for (const cid of shareSession.clients) {
      console.log(
        `Sending connection-ready to ${cid} (${shareSession.clients.length} clients)`
      );
      // Always use cluster manager to route messages via database
      await this.clusterManager.routeMessageToClient(cid, "connection-ready", {
        shareId,
        connectedClients: shareSession.clients.length,
        message: "Connection ready - Ready to share files!",
      });

      // Also emit client-joined-share to all clients (including self) to ensure UI sync
      console.log(`Sending client-joined-share to ${cid}`);
      await this.clusterManager.routeMessageToClient(
        cid,
        "client-joined-share",
        {
          clientId,
          shareId,
        }
      );
    }
    console.log(`Notified all clients in share ${shareId}`);

    await webhookService.triggerWebhook("share-joined", {
      shareId,
      clientId,
      connectedClients: shareSession.clients.length,
    });

    res.json({
      success: true,
      shareId,
      connectedClients: shareSession.clients.length,
      message: "Joined share session",
    });
  }
}

export const shareController = new ShareController();
