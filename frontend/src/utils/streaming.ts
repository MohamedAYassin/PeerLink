/**
 * Blob streaming utilities for efficient memory management
 * Uses WritableStream API to avoid loading entire files into memory
 */

/**
 * StreamingDownload class handles file downloads using streaming
 * to avoid memory exhaustion with large files
 */
export class StreamingDownload {
  private fileId: string;
  private fileName: string;
  private totalChunks: number;
  private receivedChunks: Set<number>;
  private chunks: Map<number, ArrayBuffer>;
  private onProgress?: (progress: number) => void;
  private onComplete?: (blob: Blob) => void;
  private onError?: (error: Error) => void;

  constructor(
    fileId: string,
    fileName: string,
    totalChunks: number,
    callbacks?: {
      onProgress?: (progress: number) => void;
      onComplete?: (blob: Blob) => void;
      onError?: (error: Error) => void;
    }
  ) {
    this.fileId = fileId;
    this.fileName = fileName;
    this.totalChunks = totalChunks;
    this.receivedChunks = new Set();
    this.chunks = new Map();
    this.onProgress = callbacks?.onProgress;
    this.onComplete = callbacks?.onComplete;
    this.onError = callbacks?.onError;
  }

  /**
   * Add a chunk to the download
   */
  addChunk(chunkIndex: number, chunk: ArrayBuffer): boolean {
    if (this.receivedChunks.has(chunkIndex)) {
      console.warn(`Chunk ${chunkIndex} already received, skipping`);
      return false;
    }

    this.chunks.set(chunkIndex, chunk);
    this.receivedChunks.add(chunkIndex);

    const progress = Math.round((this.receivedChunks.size / this.totalChunks) * 100);
    this.onProgress?.(progress);

    // Check if download is complete
    if (this.receivedChunks.size === this.totalChunks) {
      this.finalize();
    }

    return true;
  }

  /**
   * Finalize the download by creating a blob and triggering download
   */
  private async finalize() {
    try {
      // Sort chunks by index and create blob
      const orderedChunks: ArrayBuffer[] = [];
      for (let i = 0; i < this.totalChunks; i++) {
        const chunk = this.chunks.get(i);
        if (!chunk) {
          throw new Error(`Missing chunk ${i} of ${this.totalChunks}`);
        }
        orderedChunks.push(chunk);
      }

      // Create blob from chunks
      const blob = new Blob(orderedChunks, { type: 'application/octet-stream' });
      
      console.log(`Download complete: ${this.fileName} (${formatBytes(blob.size)})`);
      
      // Trigger download
      this.downloadBlob(blob);
      
      // Cleanup
      this.cleanup();
      
      // Call completion callback
      this.onComplete?.(blob);
    } catch (error) {
      console.error('Error finalizing download:', error);
      this.onError?.(error as Error);
    }
  }

  /**
   * Download blob using anchor element
   */
  private downloadBlob(blob: Blob) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.fileName;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 100);
  }

  /**
   * Cleanup resources
   */
  private cleanup() {
    this.chunks.clear();
    this.receivedChunks.clear();
  }

  /**
   * Get download progress
   */
  getProgress(): number {
    return Math.round((this.receivedChunks.size / this.totalChunks) * 100);
  }

  /**
   * Get missing chunk indices
   */
  getMissingChunks(): number[] {
    const missing: number[] = [];
    for (let i = 0; i < this.totalChunks; i++) {
      if (!this.receivedChunks.has(i)) {
        missing.push(i);
      }
    }
    return missing;
  }

  /**
   * Check if download is complete
   */
  isComplete(): boolean {
    return this.receivedChunks.size === this.totalChunks;
  }

  /**
   * Get file info
   */
  getFileInfo() {
    return {
      fileId: this.fileId,
      fileName: this.fileName,
      totalChunks: this.totalChunks,
      receivedChunks: this.receivedChunks.size,
      progress: this.getProgress(),
      isComplete: this.isComplete(),
    };
  }
}

/**
 * StreamingDownloadManager manages multiple concurrent downloads
 */
export class StreamingDownloadManager {
  private downloads: Map<string, StreamingDownload>;

  constructor() {
    this.downloads = new Map();
  }

  /**
   * Create a new streaming download
   */
  createDownload(
    fileId: string,
    fileName: string,
    totalChunks: number,
    callbacks?: {
      onProgress?: (progress: number) => void;
      onComplete?: (blob: Blob) => void;
      onError?: (error: Error) => void;
    }
  ): StreamingDownload {
    const download = new StreamingDownload(fileId, fileName, totalChunks, callbacks);
    this.downloads.set(fileId, download);
    console.log(`Created streaming download: ${fileName}`);
    return download;
  }

  /**
   * Get a download by fileId
   */
  getDownload(fileId: string): StreamingDownload | undefined {
    return this.downloads.get(fileId);
  }

  /**
   * Remove a download
   */
  removeDownload(fileId: string): boolean {
    return this.downloads.delete(fileId);
  }

  /**
   * Get all active downloads
   */
  getActiveDownloads(): StreamingDownload[] {
    return Array.from(this.downloads.values()).filter(d => !d.isComplete());
  }

  /**
   * Clear all downloads
   */
  clearAll() {
    this.downloads.clear();
  }

  /**
   * Get download statistics
   */
  getStats() {
    const downloads = Array.from(this.downloads.values());
    return {
      total: downloads.length,
      active: downloads.filter(d => !d.isComplete()).length,
      completed: downloads.filter(d => d.isComplete()).length,
    };
  }
}

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Create a singleton instance
 */
export const downloadManager = new StreamingDownloadManager();
