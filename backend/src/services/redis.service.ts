import type { RedisClientType } from "redis";
import { TTL } from "../config/redis.config";

export class RedisService {
  private client: any;

  constructor(client: any) {
    this.client = client;
  }

  // ==================== Session Management ====================

  async setClientSession(clientId: string, session: any): Promise<void> {
    const key = `session:client:${clientId}`;
    await this.client.setEx(key, TTL.CLIENT_SESSION, JSON.stringify(session));
  }

  async getClientSession(clientId: string): Promise<any | null> {
    if (!this.client.isOpen) return null;
    try {
      const key = `session:client:${clientId}`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      return null;
    }
  }

  async deleteClientSession(clientId: string): Promise<void> {
    const key = `session:client:${clientId}`;
    await this.client.del(key);
  }

  async getAllClientSessions(): Promise<Map<string, any>> {
    if (!this.client.isOpen) return new Map();
    
    try {
      const keys = await this.client.keys("session:client:*");
      const sessions = new Map<string, any>();

      if (keys.length > 0) {
        const values = await this.client.mGet(keys);
        keys.forEach((key: string, index: number) => {
          const clientId = key.replace("session:client:", "");
          if (values[index]) {
            sessions.set(clientId, JSON.parse(values[index] as string));
          }
        });
      }

      return sessions;
    } catch (error) {
      console.error("Redis getAllClientSessions error:", error);
      return new Map();
    }
  }



  // ==================== Share Session Management ====================

  async setShareSession(shareId: string, session: any): Promise<void> {
    const key = `session:share:${shareId}`;
    await this.client.setEx(key, TTL.SHARE_SESSION, JSON.stringify(session));
  }

  async getShareSession(shareId: string): Promise<any | null> {
    if (!this.client.isOpen) return null;
    try {
      const key = `session:share:${shareId}`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      return null;
    }
  }

  async deleteShareSession(shareId: string): Promise<void> {
    const key = `session:share:${shareId}`;
    await this.client.del(key);
  }

  async getAllShareSessions(): Promise<Map<string, any>> {
    const keys = await this.client.keys("session:share:*");
    const sessions = new Map<string, any>();

    if (keys.length > 0) {
      const values = await this.client.mGet(keys);
      keys.forEach((key: string, index: number) => {
        const shareId = key.replace("session:share:", "");
        if (values[index]) {
          sessions.set(shareId, JSON.parse(values[index] as string));
        }
      });
    }

    return sessions;
  }

  // ==================== Upload State Management ====================

  async setUploadState(fileId: string, upload: any): Promise<void> {
    const key = `upload:${fileId}`;
    const data = {
      ...upload,
      uploadedChunks: Array.from(upload.uploadedChunks || []),
      chunkChecksums: upload.chunkChecksums ? Array.from(upload.chunkChecksums.entries()) : undefined,
    };
    await this.client.setEx(key, TTL.UPLOAD_STATE, JSON.stringify(data));
  }

  async getUploadState(fileId: string): Promise<any | null> {
    const key = `upload:${fileId}`;
    const data = await this.client.get(key);
    if (!data) return null;

    const upload = JSON.parse(data);
    upload.uploadedChunks = new Set(upload.uploadedChunks || []);
    upload.chunkChecksums = upload.chunkChecksums ? new Map(upload.chunkChecksums) : new Map();
    return upload;
  }

  async deleteUploadState(fileId: string): Promise<void> {
    const key = `upload:${fileId}`;
    await this.client.del(key);
  }

  async getAllUploadStates(): Promise<Map<string, any>> {
    if (!this.client.isOpen) return new Map();

    try {
      const keys = await this.client.keys("upload:*");
      const uploads = new Map<string, any>();

      if (keys.length > 0) {
        const values = await this.client.mGet(keys);
        keys.forEach((key: string, index: number) => {
          // Skip if key is a chunk set (upload:chunks:...)
          if (key.includes(":chunks:")) return;

          const fileId = key.replace("upload:", "");
          if (values[index]) {
            try {
              const upload = JSON.parse(values[index] as string);
              upload.uploadedChunks = new Set(upload.uploadedChunks || []);
              
              // Safely convert chunkChecksums to Map
              if (upload.chunkChecksums && Array.isArray(upload.chunkChecksums)) {
                upload.chunkChecksums = new Map(upload.chunkChecksums);
              } else {
                upload.chunkChecksums = new Map();
              }
              
              uploads.set(fileId, upload);
            } catch (e) {
              // Ignore parse errors
            }
          }
        });
      }

      return uploads;
    } catch (error) {
      console.error("Redis getAllUploadStates error:", error);
      return new Map();
    }
  }



  // ==================== Rate Limiting ====================

  async checkRateLimit(
    identifier: string,
    maxRequests: number,
    windowSeconds: number = TTL.RATE_LIMIT_WINDOW
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const key = `ratelimit:${identifier}`;
    const now = Date.now();

    // Get current count
    const count = await this.client.get(key);
    const currentCount = count ? parseInt(count) : 0;

    if (currentCount >= maxRequests) {
      const ttl = await this.client.ttl(key);
      return {
        allowed: false,
        remaining: 0,
        resetAt: now + ttl * 1000,
      };
    }

    // Increment counter
    const multi = this.client.multi();
    multi.incr(key);
    if (currentCount === 0) {
      multi.expire(key, windowSeconds);
    }
    await multi.exec();

    return {
      allowed: true,
      remaining: maxRequests - currentCount - 1,
      resetAt: now + windowSeconds * 1000,
    };
  }



  // ==================== Cancelled Downloads Tracking ====================

  async addCancelledDownload(fileId: string, clientId: string): Promise<void> {
    const key = `cancelled:${fileId}`;
    await this.client.sAdd(key, clientId);
    await this.client.expire(key, TTL.UPLOAD_STATE);
  }

  async isCancelledDownload(
    fileId: string,
    clientId: string
  ): Promise<boolean> {
    const key = `cancelled:${fileId}`;
    return await this.client.sIsMember(key, clientId);
  }

  async removeCancelledDownloads(fileId: string): Promise<void> {
    const key = `cancelled:${fileId}`;
    await this.client.del(key);
  }

  // ==================== Active Connections ====================

  async setActiveConnection(clientId: string, socketId: string): Promise<void> {
    const key = `connection:${clientId}`;
    await this.client.setEx(key, TTL.CLIENT_SESSION, socketId);
  }

  async getActiveConnection(clientId: string): Promise<string | null> {
    const key = `connection:${clientId}`;
    return await this.client.get(key);
  }

  async deleteActiveConnection(clientId: string): Promise<void> {
    const key = `connection:${clientId}`;
    await this.client.del(key);
  }

  // ==================== Utility Methods ====================



  async disconnect(): Promise<void> {
    await this.client.quit();
  }

  async getStats(): Promise<{
    clientSessions: number;
    shareSessions: number;
    uploads: number;
    activeConnections: number;
  }> {
    const [clientKeys, shareKeys, uploadKeys, connectionKeys] =
      await Promise.all([
        this.client.keys("session:client:*"),
        this.client.keys("session:share:*"),
        this.client.keys("upload:*"),
        this.client.keys("connection:*"),
      ]);

    return {
      clientSessions: clientKeys.length,
      shareSessions: shareKeys.length,
      uploads: uploadKeys.length,
      activeConnections: connectionKeys.length,
    };
  }
}
