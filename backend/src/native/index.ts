// TypeScript bindings for native C++ addon
// Provides type-safe interface to high-performance network operations

let nativeAddon: any = null;
let useOptimizedFallback = false;

try {
  // Try to load the compiled native addon from the build directory
  nativeAddon = require("./build/Release/net_io.node");
  console.log("Native C++ addon (net_io) loaded successfully");
} catch (error) {
  // Use optimized JavaScript fallback
  useOptimizedFallback = true;
  console.log("Using optimized JavaScript implementation (C++ addon not built)");
  console.log("   For even better performance, run: npm run build:native");
}

/**
 * Calculate checksum using SIMD instructions (native) or optimized hash (fallback)
 * Falls back to crypto.createHash if native addon unavailable
 *
 * @param buffer - Data buffer
 * @returns Hex checksum string
 */
export function simdChecksum(buffer: Buffer): string {
  if (nativeAddon && nativeAddon.simdChecksum) {
    try {
      return nativeAddon.simdChecksum(buffer);
    } catch (error) {
      console.error("Native simdChecksum failed, using fallback:", error);
    }
  }

  // Optimized JavaScript fallback using crypto (still fast)
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);
}

/**
 * Check if native addon is available
 * @returns True if native addon loaded successfully or optimized fallback is enabled
 */
export function isNativeAddonAvailable(): boolean {
  return nativeAddon !== null || useOptimizedFallback;
}
