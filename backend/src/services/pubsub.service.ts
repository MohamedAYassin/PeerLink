import { createClient, RedisClientType } from "redis";

/**
 * PubSubService - Redis Pub/Sub for cross-node communication
 * Enables real-time event distribution across cluster nodes
 */
export class PubSubService {
  private publisher: RedisClientType | null = null;
  private subscriber: RedisClientType | null = null;
  private handlers: Map<string, Set<(data: any) => void>> = new Map();
  private isConnected = false;

  /**
   * Initialize pub/sub clients
   */
  async initialize(redisUrl?: string): Promise<void> {
    try {
      // Build Redis URL from environment variables
      let url = redisUrl || process.env.REDIS_URL;

      if (!url) {
        const host = process.env.REDIS_HOST || "localhost";
        const port = process.env.REDIS_PORT || "6379";
        const password = process.env.REDIS_PASSWORD;
        const db = process.env.REDIS_DB || "0";

        if (password) {
          url = `redis://:${password}@${host}:${port}/${db}`;
        } else {
          url = `redis://${host}:${port}/${db}`;
        }
      }

      // Create publisher client
      this.publisher = createClient({ url });
      await this.publisher.connect();

      // Create subscriber client (separate connection required for pub/sub)
      this.subscriber = createClient({ url });
      await this.subscriber.connect();

      this.isConnected = true;
      console.log("Redis Pub/Sub initialized");
    } catch (error) {
      console.error("Failed to initialize Redis Pub/Sub:", error);
      throw error;
    }
  }

  /**
   * Serialize data for Redis
   * Optimizes Buffer handling by using Base64 instead of default JSON array
   */
  private serialize(data: any): string {
    return JSON.stringify(data, (key, value) => {
      // Handle Buffer.toJSON() output
      if (value && value.type === 'Buffer' && Array.isArray(value.data)) {
        return { _base64: Buffer.from(value.data).toString('base64') };
      }
      // Handle raw Buffers (if they bypass toJSON somehow)
      if (Buffer.isBuffer(value)) {
        return { _base64: value.toString('base64') };
      }
      return value;
    });
  }

  /**
   * Deserialize data from Redis
   * Restores Base64 strings back to Buffers
   */
  private deserialize(data: string): any {
    return JSON.parse(data, (key, value) => {
      if (value && typeof value === 'object' && value._base64) {
        return Buffer.from(value._base64, 'base64');
      }
      return value;
    });
  }

  /**
   * Handle incoming messages from Redis
   */
  private handleMessage(message: string, channel: string) {
    try {
      const data = this.deserialize(message);
      const handlers = this.handlers.get(channel);

      if (handlers) {
        handlers.forEach((handler) => {
          try {
            handler(data);
          } catch (error) {
            console.error(
              `Error in handler for channel ${channel}:`,
              error
            );
          }
        });
      }
    } catch (error) {
      console.error("Error parsing pub/sub message:", error);
    }
  }

  /**
   * Publish a message to a channel
   */
  async publish(channel: string, data: any): Promise<void> {
    if (!this.publisher || !this.isConnected) {
      console.warn("Pub/Sub not connected, skipping publish");
      throw new Error("Pub/Sub not connected");
    }

    try {
      const message = this.serialize(data);
      
      // Warn if message is large (potential Redis bottleneck)
      if (message.length > 500 * 1024) {
        console.warn(`Large Pub/Sub message on ${channel}: ${(message.length / 1024).toFixed(2)}KB`);
      }

      await this.publisher.publish(channel, message);
    } catch (error) {
      console.error(`Failed to publish to ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to a channel with a handler
   */
  async subscribe(
    channel: string,
    handler: (data: any) => void
  ): Promise<void> {
    if (!this.subscriber || !this.isConnected) {
      throw new Error("Pub/Sub not initialized");
    }

    try {
      // Add handler to map
      if (!this.handlers.has(channel)) {
        this.handlers.set(channel, new Set());
        // Subscribe to channel if first handler
        await this.subscriber.subscribe(channel, (message) => {
          this.handleMessage(message, channel);
        });
        console.log(`Subscribed to channel: ${channel}`);
      }

      this.handlers.get(channel)!.add(handler);
    } catch (error) {
      console.error(`Failed to subscribe to ${channel}:`, error);
      throw error;
    }
  }



  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      if (this.publisher) {
        await this.publisher.quit();
      }
      if (this.subscriber) {
        await this.subscriber.quit();
      }

      this.isConnected = false;
      this.handlers.clear();
      console.log("Redis Pub/Sub disconnected");
    } catch (error) {
      console.error("Error disconnecting Pub/Sub:", error);
    }
  }

  /**
   * Check if pub/sub is connected
   */
  isReady(): boolean {
    return this.isConnected;
  }


}

// Channel names for common events
export const PubSubChannels = {
  // Session events
  SESSION_CREATED: "session:created",
  SESSION_ENDED: "session:ended",

  // Share events
  SHARE_CREATED: "share:created",

  // Node events
  NODE_REGISTERED: "node:registered",
  NODE_DEREGISTERED: "node:deregistered",

  // Message routing
  MESSAGE_ROUTE: "message:route",

  // Routing Requests (Worker -> Master)
  ROUTING_REQUEST: "routing:request",
};
