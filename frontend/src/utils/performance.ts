/**
 * Performance monitoring utilities
 */

interface TransferStats {
  bytesTransferred: number;
  startTime: number;
  lastUpdate: number;
  speed: number; // bytes per second
}

const transferStats = new Map<string, TransferStats>();

export function startTransfer(fileId: string) {
  transferStats.set(fileId, {
    bytesTransferred: 0,
    startTime: Date.now(),
    lastUpdate: Date.now(),
    speed: 0,
  });
}

export function updateTransfer(fileId: string, bytes: number) {
  const stats = transferStats.get(fileId);
  if (!stats) return;

  const now = Date.now();
  stats.bytesTransferred += bytes;
  stats.lastUpdate = now;

  // Calculate speed (bytes per second)
  const elapsed = (now - stats.startTime) / 1000;
  if (elapsed > 0) {
    stats.speed = stats.bytesTransferred / elapsed;
  }

  transferStats.set(fileId, stats);
}

export function getTransferSpeed(fileId: string): number {
  const stats = transferStats.get(fileId);
  return stats ? stats.speed : 0;
}

export function endTransfer(fileId: string) {
  transferStats.delete(fileId);
}

export function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond < 1024) {
    return `${bytesPerSecond.toFixed(0)} B/s`;
  } else if (bytesPerSecond < 1024 * 1024) {
    return `${(bytesPerSecond / 1024).toFixed(2)} KB/s`;
  } else {
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`;
  }
}
