import { URL } from "url";
import { lookup } from "dns/promises";
import { isIP } from "net";
import { ErrorFactory } from "../utils/error.utils";

const PRIVATE_RANGES = [
  // IPv4
  { ip: 0x00000000, mask: 8 },   // 0.0.0.0/8 (current network)
  { ip: 0x0a000000, mask: 8 },   // 10.0.0.0/8 (private)
  { ip: 0x7f000000, mask: 8 },   // 127.0.0.0/8 (loopback)
  { ip: 0x64400000, mask: 10 },  // 100.64.0.0/10 (CGNAT)
  { ip: 0xa9fe0000, mask: 16 },  // 169.254.0.0/16 (link-local)
  { ip: 0xac100000, mask: 12 },  // 172.16.0.0/12 (private)
  { ip: 0xc0a80000, mask: 16 },  // 192.168.0.0/16 (private)
  { ip: 0xc0000200, mask: 24 },  // 192.0.2.0/24 (TEST-NET-1)
  { ip: 0xc0586300, mask: 24 },  // 192.88.99.0/24 (6to4 anycast)
  { ip: 0xcb007100, mask: 24 },  // 203.0.113.0/24 (TEST-NET-3)
];

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  const addr = ipv4ToInt(ip);
  return PRIVATE_RANGES.some(({ ip: base, mask }) => {
    const masked = (base >>> 0) >>> (32 - mask);
    return (addr >>> (32 - mask)) === masked;
  });
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  // ::1 or expanded ::1 loopback
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;
  // IPv4-mapped IPv6: ::ffff:x.x.x.x
  const ipv4Mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (ipv4Mapped) return isPrivateIPv4(ipv4Mapped[1]);
  // fc00::/7 unique local
  const segments = normalized.split(":");
  const first = parseInt(segments[0] || "0", 16);
  if ((first & 0xfe00) === 0xfc00) return true;
  // fe80::/10 link-local
  if ((first & 0xffc0) === 0xfe80) return true;
  return false;
}

async function isInternalHost(hostname: string): Promise<boolean> {
  if (hostname === "localhost" || hostname === "localhost.localdomain") return true;
  if (isIP(hostname)) {
    if (isIP(hostname) === 4) return isPrivateIPv4(hostname);
    if (isIP(hostname) === 6) return isPrivateIPv6(hostname);
    return true;
  }
  // Resolve hostname to check all A/AAAA records
  try {
    const addresses = await lookup(hostname, { all: true });
    return addresses.some((addr) => {
      if (isIP(addr.address) === 4) return isPrivateIPv4(addr.address);
      if (isIP(addr.address) === 6) return isPrivateIPv6(addr.address);
      return false;
    });
  } catch {
    // DNS resolution failed — reject to be safe
    return true;
  }
}

export async function validateWebhookUrl(urlStr: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw ErrorFactory.badRequest("Invalid webhook URL format");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw ErrorFactory.badRequest("Webhook URL must use http or https scheme");
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block exact metadata IPs and common internal hostnames
  if (
    hostname === "169.254.169.254" ||
    hostname === "metadata.google.internal" ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".local") ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0"
  ) {
    throw ErrorFactory.badRequest("Webhook URL must point to a public endpoint");
  }

  const internal = await isInternalHost(hostname);
  if (internal) {
    throw ErrorFactory.badRequest("Webhook URL must point to a public endpoint");
  }
}
