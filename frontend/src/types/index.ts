export interface FileUpload {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'uploaded' | 'completed' | 'error';
  fileId?: string;
}

export interface BackendFeatures {
  redis: boolean;
  nativeAddon: boolean;
}

export interface ClusterStats {
  nodes?: {
    active: number;
    total: number;
  };
}

// New types for chunk acknowledgment system
export interface TransferFailedEvent {
  fileId: string;
  reason: string;
  failedChunks: number[];
}

export interface ChunkRetryEvent {
  fileId: string;
  chunkIndex: number;
  attempt: number;
}

export interface ChunkAcknowledgedEvent {
  fileId: string;
  chunkIndex: number;
}

export interface MasterNodeInfo {
  masterId: string | null;
  isMe: boolean;
  nodeId: string;
}

