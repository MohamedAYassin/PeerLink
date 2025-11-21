import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "5000"),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "1073741824"), // 1GB
  chunkSize: parseInt(process.env.CHUNK_SIZE || "65536"), // 64KB
  rateLimitUploads: parseInt(
    process.env.RATE_LIMIT_UPLOADS_PER_MINUTE || "100"
  ),
  rateLimitDownloads: parseInt(
    process.env.RATE_LIMIT_DOWNLOADS_PER_MINUTE || "100"
  ),
  rateLimitMessages: parseInt(
    process.env.RATE_LIMIT_WEBSOCKET_MESSAGES_PER_MINUTE || "1000"
  ),
  sessionTimeout: parseInt(process.env.SESSION_TIMEOUT_MINUTES || "60") * 60 * 1000,
  shareSessionTimeout: parseInt(process.env.SHARE_SESSION_TIMEOUT_HOURS || "24") * 60 * 60 * 1000,
  cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || "60000"),
  websocketMaxBufferSize: parseInt(process.env.WEBSOCKET_MAX_BUFFER_SIZE || "104857600"),
  wsPingInterval: parseInt(process.env.WS_PING_INTERVAL || "25000"),
  wsPingTimeout: parseInt(process.env.WS_PING_TIMEOUT || "5000"),
  ackTimeout: parseInt(process.env.ACK_TIMEOUT_MS || "10000"),
  maxRetries: parseInt(process.env.MAX_RETRIES || "3"),
  ackCheckInterval: parseInt(process.env.ACK_CHECK_INTERVAL_MS || "2000"),
  maxConcurrentUploads: parseInt(process.env.MAX_CONCURRENT_UPLOADS || "10"),
  maxConcurrentDownloads: parseInt(process.env.MAX_CONCURRENT_DOWNLOADS || "10"),
  maxConcurrentTransfers: parseInt(process.env.MAX_CONCURRENT_TRANSFERS || "5"),
  heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL_SECONDS || "10") * 1000,
  logLevel: process.env.LOG_LEVEL || "warn",
  debugDb: process.env.DEBUG_DB === "true",
  enableMetrics: process.env.ENABLE_METRICS === "true",
  useNativeAddon: process.env.USE_NATIVE_ADDON === "true",
  useRedis: process.env.USE_REDIS === "true",
  useCluster: process.env.USE_CLUSTER === "true",
  enableCompression: process.env.ENABLE_COMPRESSION === "true",
};

// Validate: Clustering requires Redis
if (config.useCluster && !config.useRedis) {
  throw new Error(
    "Clustering requires Redis. Please set USE_REDIS=true when USE_CLUSTER=true"
  );
}
