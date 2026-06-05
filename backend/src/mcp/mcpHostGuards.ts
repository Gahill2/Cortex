/**
 * Host header / Origin checks for MCP over HTTP on Tailscale.
 * Tailscale IPv4 addresses live in 100.64.0.0/10 (RFC 6598 CGNAT space used by Tailscale).
 */

/** True if hostname is an IPv4 address in 100.64.0.0 – 100.127.255.255 */
export function isTailscaleCgnatIpv4(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4) return false;
  if (!parts.every((p) => /^\d{1,3}$/.test(p))) return false;
  const [a, b] = parts.map(Number);
  if (a !== 100) return false;
  if (Number.isNaN(b)) return false;
  return b >= 64 && b <= 127;
}

export function isTailscaleMagicDns(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h.endsWith(".ts.net") || h.endsWith(".tailscale.net");
}

export function isLoopbackHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}
