import { createServer } from "http";
import { Server } from "socket.io";
import { createApp } from "./app";
import { config } from "./config/app.config";
import { storageRepository } from "./repositories/storage.repository";
import { RedisService } from "./services/redis.service";
import { createRedisClient } from "./config/redis.config";
import { retry } from "./utils/error.utils";
import { ClusterManager } from "./services/cluster.service";
import { isNativeAddonAvailable } from "./native";
import { SocketHandler } from "./socket/socket.handler";
import { Logger } from "./utils/logger.utils";

// Initialize Redis
async function initializeRedis() {
  if (!config.useRedis) {
    console.log("Redis disabled, using in-memory storage");
    return;
  }

  try {
    const client = await retry(() => createRedisClient(), {
      maxRetries: 3,
      delayMs: 2000,
      onRetry: (attempt, error) => {
        console.log(
          `Retrying Redis connection (attempt ${attempt}):`,
          error.message
        );
      },
    });

    const redisService = new RedisService(client);
    storageRepository.setRedisService(redisService);
    console.log("Redis initialized successfully");

    return redisService; // Return for cleanup
  } catch (error) {
    Logger.error(error, "Failed to initialize Redis");
    
    if (config.useCluster) {
      console.error("CRITICAL ERROR: Redis connection failed but is required for Cluster Mode.");
      throw error;
    }

    console.log("Falling back to in-memory storage");
  }
}

// Cleanup inactive sessions
function startCleanupInterval() {
  setInterval(async () => {
    const now = Date.now();
    const sessionTimeout = config.sessionTimeout;
    const uploadTimeout = config.shareSessionTimeout; // Use share timeout for uploads too

    try {
      const sessions = await storageRepository.getAllClientSessions();
      for (const [clientId, session] of sessions) {
        if (!session.connected && now - session.lastHeartbeat > sessionTimeout) {
          await storageRepository.deleteClientSession(clientId);
          console.log(`Removed inactive session: ${clientId}`);
        }
      }

      const uploads = await storageRepository.getAllUploadStates();
      for (const [fileId, upload] of uploads) {
        // Cleanup completed uploads after 5 minutes
        if (
          upload.status === "completed" &&
          now - upload.lastUpdate > 5 * 60 * 1000
        ) {
          await storageRepository.deleteUploadState(fileId);
          console.log(
            `Removed completed upload: ${upload.fileName} (5m retention expired)`
          );
          continue;
        }

        // Only cleanup uploads that haven't had ANY activity for 24 hours
        // This allows large file uploads that take hours to complete
        if (
          upload.status === "uploading" &&
          now - upload.lastUpdate > uploadTimeout
        ) {
          await storageRepository.deleteUploadState(fileId);
          console.log(
            `Removed abandoned upload: ${upload.fileName} (no activity for 24h)`
          );
        }
      }
    } catch (error) {
      Logger.error(error, "Cleanup error");
    }
  }, config.cleanupInterval);
}

async function startServer() {
  try {
    const redisService = await initializeRedis();
    const clusterManager = ClusterManager.getInstance();

    const app = createApp();
    const httpServer = createServer(app);
    const io = new Server(httpServer, {
      cors: {
        origin: config.corsOrigin,
        methods: ["GET", "POST"],
      },
      maxHttpBufferSize: config.websocketMaxBufferSize,
      pingInterval: config.wsPingInterval,
      pingTimeout: config.wsPingTimeout,
      perMessageDeflate: config.enableCompression ? {
        threshold: 1024, // Only compress data above 1KB
      } : false,
    });

    // Initialize Socket Handler
    new SocketHandler(io);

    // Initialize cluster manager (Always required for Node/Session management)
    const hostname = process.env.NODE_HOSTNAME || "localhost";
    const port = config.port;

    try {
      await clusterManager.initialize(hostname, port, io);
      if (config.useCluster) {
        console.log("Cluster mode enabled");
      } else {
        console.log("Standalone mode enabled");
      }
    } catch (error) {
      console.error("Cluster Manager initialization failed:", error);
      process.exit(1);
    }

    startCleanupInterval();

    httpServer.listen(config.port, () => {
      console.log("\n" + "=".repeat(60));
      console.log(
        `PeerLink Backend v2.0 - ${config.useCluster ? "CLUSTER MODE" : "STANDALONE MODE"
        }`
      );
      console.log("=".repeat(60));
      console.log(`Server: http://localhost:${config.port}`);
      console.log(`WebSocket: ws://localhost:${config.port}`);
      console.log(`Health: GET /api/health`);
      console.log(`Stats: GET /api/stats`);
      if (config.useCluster) {
        console.log(`Cluster: GET /api/cluster/stats`);
        console.log(`Nodes: GET /api/cluster/nodes`);
      }
      console.log("\nFeatures:");
      console.log(
        `   Redis: ${config.useRedis && redisService ? "Enabled" : "Disabled"}`
      );
      console.log(
        `   Native Addon: ${config.useNativeAddon && isNativeAddonAvailable() ? "Enabled" : "Disabled"
        }`
      );
      console.log(
        `   Cluster: ${config.useCluster && clusterManager.getNodeId() ? "Enabled" : "Disabled"
        }`
      );
      if (config.useCluster) {
        console.log(`   Node ID: ${clusterManager.getNodeId() || "N/A"}`);
        console.log(
          `   Role: ${clusterManager.getIsMaster() ? "Master" : "Worker"}`
        );
      }
      console.log("=".repeat(60) + "\n");
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log("\nShutting down gracefully...");

      // Shutdown cluster manager (if enabled)
      if (config.useCluster) {
        await clusterManager.shutdown();
      }

      if (redisService) {
        await redisService.disconnect();
      }

      httpServer.close(() => {
        console.log("Server closed");
        process.exit(0);
      });
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);

  } catch (error) {
    Logger.error(error, "Failed to start server");
    process.exit(1);
  }
}

startServer();

