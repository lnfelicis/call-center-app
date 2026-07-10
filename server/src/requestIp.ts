import type { Request } from "express";

export function parseTrustProxyHops(value: string | undefined) {
  const normalizedValue = value?.trim() ?? "";

  if (!normalizedValue) {
    return 0;
  }

  if (!/^\d+$/.test(normalizedValue)) {
    throw new Error("TRUST_PROXY_HOPS must be a non-negative integer.");
  }

  const hops = Number(normalizedValue);

  if (!Number.isSafeInteger(hops)) {
    throw new Error("TRUST_PROXY_HOPS must be a safe integer.");
  }

  return hops;
}

export function getClientIp(req: Request) {
  const ipAddress = req.ip ?? req.socket.remoteAddress;

  if (!ipAddress) {
    return null;
  }

  return ipAddress.replace(/^::ffff:/i, "");
}
