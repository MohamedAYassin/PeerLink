import { RedisService } from "../services/redis.service";
import {
  ClientSession,
  FileUpload as UploadState,
  ShareSession,
  WebhookEndpoint,
  RateLimitResult,
} from "../types";
import { Socket } from "socket.io";
import { config } from "../config/app.config";

export class StorageRepository {
  private redisService: RedisService | null = null;
  private inMemoryStorage = {
    fileUploads: new Map<string, UploadState>(),
    clientSessions: new Map<string, ClientSession>(),
    shareSessions: new Map<string, ShareSession>(),
    activeConnections: new Map<string, Socket>(),
    webhookEndpoints: new Map<string, WebhookEndpoint>(),
    cancelledDownloads: new Map<string, Set<string>>(),
    uploadLocks: new Map<string, Promise<any>>(),
  };

  constructor(redisService?: RedisService) {
    if (redisService) {
      this.redisService = redisService;
    }
  }

  setRedisService(redisService: RedisService) {
    this.redisService = redisService;
  }

  // Client Sessions
  async setClientSession(clientId: string, session: ClientSession) {
    if (this.redisService) {
      await this.redisService.setClientSession(clientId, session);
    } else {
      this.inMemoryStorage.clientSessions.set(clientId, session);
    }
  }

  async getClientSession(clientId: string): Promise<ClientSession | null> {
    if (this.redisService) {
      return await this.redisService.getClientSession(clientId);
    }
    return this.inMemoryStorage.clientSessions.get(clientId) || null;
  }

  async getAllClientSessions(): Promise<Map<string, ClientSession>> {
    if (this.redisService) {
      return await this.redisService.getAllClientSessions();
    }
    return this.inMemoryStorage.clientSessions;
  }

  async deleteClientSession(clientId: string) {
    if (this.redisService) {
      await this.redisService.deleteClientSession(clientId);
    } else {
      this.inMemoryStorage.clientSessions.delete(clientId);
    }
  }

  // Upload States
  async setUploadState(fileId: string, upload: UploadState) {
    if (this.redisService) {
      try {
        await this.redisService.setUploadState(fileId, upload);
      } catch (err) {
        console.error(
          `Failed to persist upload state to Redis: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    // Always keep in memory for fast access
    this.inMemoryStorage.fileUploads.set(fileId, upload);
  }

  async getUploadState(fileId: string): Promise<UploadState | null> {
    let upload = this.inMemoryStorage.fileUploads.get(fileId);

    if (!upload && this.redisService) {
      upload = await this.redisService.getUploadState(fileId);
      if (upload) {
        this.inMemoryStorage.fileUploads.set(fileId, upload);
      }
    }

    return upload || null;
  }

  async getAllUploadStates(): Promise<Map<string, UploadState>> {
    if (this.redisService) {
      return await this.redisService.getAllUploadStates();
    }
    return this.inMemoryStorage.fileUploads;
  }

  async deleteUploadState(fileId: string) {
    if (this.redisService) {
      await this.redisService.deleteUploadState(fileId);
    }
    this.inMemoryStorage.fileUploads.delete(fileId);
  }

  // Share Sessions
  async setShareSession(shareId: string, session: ShareSession) {
    if (this.redisService) {
      await this.redisService.setShareSession(shareId, session);
    } else {
      this.inMemoryStorage.shareSessions.set(shareId, session);
    }
  }

  async getShareSession(shareId: string): Promise<ShareSession | null> {
    if (this.redisService) {
      return await this.redisService.getShareSession(shareId);
    }
    return this.inMemoryStorage.shareSessions.get(shareId) || null;
  }

  async getAllShareSessions(): Promise<Map<string, ShareSession>> {
    if (this.redisService) {
      return await this.redisService.getAllShareSessions();
    }
    return this.inMemoryStorage.shareSessions;
  }

  async deleteShareSession(shareId: string) {
    if (this.redisService) {
      await this.redisService.deleteShareSession(shareId);
    } else {
      this.inMemoryStorage.shareSessions.delete(shareId);
    }
  }

  // Rate Limits
  async checkRateLimit(
    identifier: string,
    maxRequests: number
  ): Promise<RateLimitResult> {
    if (this.redisService) {
      return await this.redisService.checkRateLimit(identifier, maxRequests);
    }
    // Simple in-memory rate limiting (not persistent)
    // This logic was in the original code but incomplete.
    // Assuming it always allows if not redis, or we can implement a simple one.
    // The original code returned allowed: true always for in-memory.
    return {
      allowed: true,
      remaining: maxRequests,
      resetAt: Date.now() + 60000,
    };
  }

  // Cancelled Downloads
  async addCancelledDownload(fileId: string, clientId: string) {
    if (this.redisService) {
      await this.redisService.addCancelledDownload(fileId, clientId);
    } else {
      if (!this.inMemoryStorage.cancelledDownloads.has(fileId)) {
        this.inMemoryStorage.cancelledDownloads.set(fileId, new Set());
      }
      this.inMemoryStorage.cancelledDownloads.get(fileId)!.add(clientId);
    }
  }

  async isCancelledDownload(
    fileId: string,
    clientId: string
  ): Promise<boolean> {
    if (this.redisService) {
      return await this.redisService.isCancelledDownload(fileId, clientId);
    }
    const set = this.inMemoryStorage.cancelledDownloads.get(fileId);
    return set ? set.has(clientId) : false;
  }

  async removeCancelledDownloads(fileId: string) {
    if (this.redisService) {
      await this.redisService.removeCancelledDownloads(fileId);
    } else {
      this.inMemoryStorage.cancelledDownloads.delete(fileId);
    }
  }

  // Webhooks
  getWebhookEndpoints(): Map<string, WebhookEndpoint> {
    return this.inMemoryStorage.webhookEndpoints;
  }

  // Active Connections (Socket)
  getActiveConnection(clientId: string): Socket | undefined {
    return this.inMemoryStorage.activeConnections.get(clientId);
  }

  setActiveConnection(clientId: string, socket: Socket) {
    this.inMemoryStorage.activeConnections.set(clientId, socket);
  }

  deleteActiveConnection(clientId: string) {
    this.inMemoryStorage.activeConnections.delete(clientId);
  }

  async getStats() {
    if (this.redisService) {
      return await this.redisService.getStats();
    }
    return null;
  }
}

export const storageRepository = new StorageRepository();
