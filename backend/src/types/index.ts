// File Upload Types

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
  chunkChecksums?: Map<number, string>;
  pendingAcks?: Map<number, { timestamp: number; retries: number }>;
  lastAckTime?: number;
}

export type UploadStatus =
  | "uploading"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

// Session Types

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

// Webhook Types

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

// Rate Limiting Types

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}
