/**
 * Shared TypeScript types for PeerLink Backend v2.0
 */

// ==================== File Upload Types ====================

export interface FileUpload {
  fileId: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  uploadedChunks: Set<number>;
  clientId: string;
  startTime: number;
  lastUpdate: number;
  status: UploadStatus;
  chunkChecksums?: Map<number, string>; // Optional checksums for integrity verification
  pendingAcks?: Map<number, { timestamp: number; retries: number }>; // Track unacknowledged chunks
  lastAckTime?: number; // Timestamp of most recent acknowledgment
}

export type UploadStatus =
  | "uploading"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";



// ==================== Session Types ====================

export interface ClientSession {
  clientId: string;
  socketId: string;
  nodeId?: string;
  connected: boolean;
  lastHeartbeat: number;
  uploads: string[];
  downloads: string[];
  uploadSpeed: number;
  downloadSpeed: number;
  shareId?: string;
}

export interface ShareSession {
  shareId: string;
  createdAt: number;
  lastActivity: number;
  clients: string[];
  status: ShareSessionStatus;
}

export type ShareSessionStatus = "active" | "inactive";

// ==================== Webhook Types ====================

export interface WebhookEndpoint {
  url: string;
  events: WebhookEvent[];
  active: boolean;
}

export type WebhookEvent =
  | "client-connected"
  | "client-disconnected"
  | "upload-complete"
  | "upload-cancelled"
  | "download-complete"
  | "download-cancelled"
  | "client-status";

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: any;
}

// ==================== Rate Limiting Types ====================

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

// ==================== WebSocket Event Types ====================

export interface RegisterEvent {
  clientId: string;
}

export interface UploadInitEvent {
  clientId: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
}

export interface UploadInitResponse {
  fileId: string;
  message: string;
  resumeFrom: number[];
}

export interface UploadChunkEvent {
  fileId: string;
  chunkIndex: number;
  chunk: Buffer;
  clientId: string;
  checksum?: string;
}

export interface ChunkUploadedEvent {
  fileId: string;
  chunkIndex: number;
  progress: number;
  uploadedChunks: number;
  totalChunks: number;
}

export interface UploadCompleteEvent {
  fileId: string;
  fileName: string;
  fileSize: number;
  duration: number;
}

export interface CancelUploadEvent {
  fileId: string;
  clientId: string;
}

export interface CancelDownloadEvent {
  fileId: string;
  clientId: string;
}



// ==================== API Response Types ====================

export interface HealthResponse {
  status: string;
  message: string;
  version: string;
  timestamp: string;
  features: {
    redis: boolean;
    nativeAddon: boolean;
  };
}

export interface StatsResponse {
  totalUploads: number;
  completedUploads: number;
  activeUploads: number;
  failedUploads: number;
  activeClients: number;
  totalClients: number;
  shareSessions: number;
  webhooks: number;
  redis?: RedisStats;
}

export interface RedisStats {
  clientSessions: number;
  shareSessions: number;
  uploads: number;
  activeConnections: number;
}

export interface UploadStatusResponse {
  fileId: string;
  fileName: string;
  fileSize: number;
  progress: number;
  uploadedChunks: number;
  totalChunks: number;
  missingChunks: number[];
  missingCount: number;
  status: UploadStatus;
  speed: number;
  eta: number;
}

export interface ClientStatusResponse {
  clientId: string;
  socketId: string;
  connected: boolean;
  lastHeartbeat: string;
  uploadSpeed: number;
  downloadSpeed: number;
  activeUploads: number;
  activeDownloads: number;
}

export interface ShareSessionResponse {
  shareId: string;
  createdAt: string;
  lastActivity: string;
  connectedClients: number;
  maxClients: number;
  status: ShareSessionStatus;
  available: boolean;
}

// ==================== Configuration Types ====================

export interface ServerConfig {
  port: number;
  corsOrigin: string;
  maxFileSize: number;
  chunkSize: number;
  rateLimitUploads: number;
  rateLimitDownloads: number;
  rateLimitMessages: number;
  useNativeAddon: boolean;
  useRedis: boolean;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  maxRetriesPerRequest: number;
  retryDelayMs: number;
  connectTimeout: number;
  commandTimeout: number;
}

export interface TTLConfig {
  CLIENT_SESSION: number;
  SHARE_SESSION: number;
  UPLOAD_STATE: number;
  RATE_LIMIT_WINDOW: number;
  HEARTBEAT: number;
}

// ==================== Stream Types ====================

export interface ChunkStreamOptions {
  chunkSize?: number;
  highWaterMark?: number;
  encoding?: BufferEncoding;
}

export interface StreamStats {
  bytesProcessed: number;
  chunksProcessed: number;
  startTime: number;
  endTime?: number;
  speed: number;
}

// ==================== Error Types ====================

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// ==================== Utility Types ====================

export type AsyncHandler<T = any> = (...args: any[]) => Promise<T>;

export type SafeHandler<T = any> = (...args: any[]) => Promise<T | void>;

export interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: any) => void;
}

// ==================== Storage Abstraction Types ====================

export interface StorageAdapter {
  setClientSession(clientId: string, session: ClientSession): Promise<void>;
  getClientSession(clientId: string): Promise<ClientSession | null>;
  getAllClientSessions(): Promise<Map<string, ClientSession>>;
  deleteClientSession(clientId: string): Promise<void>;

  setUploadState(fileId: string, upload: FileUpload): Promise<void>;
  getUploadState(fileId: string): Promise<FileUpload | null>;
  getAllUploadStates(): Promise<Map<string, FileUpload>>;
  deleteUploadState(fileId: string): Promise<void>;

  setShareSession(shareId: string, session: ShareSession): Promise<void>;
  getShareSession(shareId: string): Promise<ShareSession | null>;
  getAllShareSessions(): Promise<Map<string, ShareSession>>;
  deleteShareSession(shareId: string): Promise<void>;

  checkRateLimit(
    identifier: string,
    maxRequests: number
  ): Promise<RateLimitResult>;

  addCancelledDownload(fileId: string, clientId: string): Promise<void>;
  isCancelledDownload(fileId: string, clientId: string): Promise<boolean>;
  removeCancelledDownloads(fileId: string): Promise<void>;
}

// ==================== Native Addon Types ====================

export interface NativeAddon {
  simdChecksum(buffer: Buffer): string;
  xorCipher(buffer: Buffer, key: Buffer): Buffer;
}

// ==================== Type Guards ====================

export function isFileUpload(obj: any): obj is FileUpload {
  return (
    obj &&
    typeof obj.fileId === "string" &&
    typeof obj.fileName === "string" &&
    typeof obj.fileSize === "number" &&
    obj.uploadedChunks instanceof Set
  );
}

export function isClientSession(obj: any): obj is ClientSession {
  return (
    obj &&
    typeof obj.clientId === "string" &&
    typeof obj.socketId === "string" &&
    typeof obj.connected === "boolean"
  );
}

export function isShareSession(obj: any): obj is ShareSession {
  return (
    obj &&
    typeof obj.shareId === "string" &&
    Array.isArray(obj.clients) &&
    ["active", "inactive"].includes(obj.status)
  );
}

// ==================== Constants ====================

export const UPLOAD_STATUSES: UploadStatus[] = [
  "uploading",
  "paused",
  "completed",
  "failed",
  "cancelled",
];

export const WEBHOOK_EVENTS: WebhookEvent[] = [
  "client-connected",
  "client-disconnected",
  "upload-complete",
  "upload-cancelled",
  "download-complete",
  "download-cancelled",
  "client-status",
];

export const SHARE_SESSION_STATUSES: ShareSessionStatus[] = [
  "active",
  "inactive",
];

// ==================== Default Values ====================

export const DEFAULT_CONFIG: Partial<ServerConfig> = {
  port: 5000,
  corsOrigin: "http://localhost:5173",
  maxFileSize: 1073741824, // 1GB
  chunkSize: 16384, // 16KB
  rateLimitUploads: 100,
  rateLimitDownloads: 100,
  rateLimitMessages: 1000,
  useNativeAddon: true,
  useRedis: true,
};

export const DEFAULT_TTL: TTLConfig = {
  CLIENT_SESSION: 3600, // 1 hour
  SHARE_SESSION: 86400, // 24 hours
  UPLOAD_STATE: 7200, // 2 hours
  RATE_LIMIT_WINDOW: 60, // 1 minute
  HEARTBEAT: 300, // 5 minutes
};
