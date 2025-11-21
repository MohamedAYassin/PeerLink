/**
 * WASM-based compression and decompression utilities
 * Uses fflate for high-performance gzip compression
 */

import { gzipSync, gunzipSync } from 'fflate';

/**
 * Compression configuration
 */
export const COMPRESSION_CONFIG = {
  // Compression level: 0-9 (0 = no compression, 9 = best compression)
  // Level 6 is a good balance between speed and compression ratio
  level: 6,
  // Enable compression for chunks larger than this threshold (in bytes)
  minChunkSize: 1024, // 1KB
  // Chunk types to compress
  enabled: true,
} as const;

/**
 * Compress ArrayBuffer using gzip
 * @param data - ArrayBuffer to compress
 * @returns Compressed Uint8Array
 */
export const compressChunk = (data: ArrayBuffer): Uint8Array => {
  if (!COMPRESSION_CONFIG.enabled || data.byteLength < COMPRESSION_CONFIG.minChunkSize) {
    return new Uint8Array(data);
  }

  try {
    const uint8Array = new Uint8Array(data);
    const compressed = gzipSync(uint8Array, { level: COMPRESSION_CONFIG.level });
    
    // Log compression ratio for monitoring
    const ratio = ((1 - (compressed.length / uint8Array.length)) * 100).toFixed(2);
    if (compressed.length < uint8Array.length) {
      console.log(`Compressed chunk: ${uint8Array.length}B -> ${compressed.length}B (${ratio}% reduction)`);
      return compressed;
    }
    
    // If compressed size is larger, return original
    console.log(`Compression not beneficial for this chunk`);
    return uint8Array;
  } catch (error) {
    console.error('Compression failed:', error);
    return new Uint8Array(data);
  }
};

/**
 * Decompress Uint8Array using gunzip
 * @param compressed - Compressed Uint8Array
 * @returns Decompressed ArrayBuffer
 */
export const decompressChunk = (compressed: Uint8Array | ArrayBuffer): ArrayBuffer => {
  try {
    const uint8Array = compressed instanceof ArrayBuffer 
      ? new Uint8Array(compressed) 
      : compressed;
    
    // Try to decompress - if it fails, data might not be compressed
    try {
      const decompressed = gunzipSync(uint8Array);
      console.log(`Decompressed chunk: ${uint8Array.length}B -> ${decompressed.length}B`);
      return decompressed.buffer as ArrayBuffer;
    } catch {
      // Data might not be compressed, return as-is
      console.log(`Chunk not compressed, using original data`);
      return uint8Array.buffer as ArrayBuffer;
    }
  } catch (error) {
    console.error('Decompression failed:', error);
    // Return original data on error
    return compressed instanceof ArrayBuffer 
      ? compressed 
      : (compressed.buffer as ArrayBuffer);
  }
};

/**
 * Enable or disable compression
 */
export const setCompressionEnabled = (enabled: boolean) => {
  (COMPRESSION_CONFIG as any).enabled = enabled;
  console.log(`Compression ${enabled ? 'enabled' : 'disabled'}`);
};
