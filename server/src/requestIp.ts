import type { Request } from "express";

export function getClientIp(req: Request) {
  const ipAddress = req.ip ?? req.socket.remoteAddress;

  if (!ipAddress) {
    return null;
  }

  return ipAddress.replace(/^::ffff:/i, "");
}

export function isClientIpAllowed(req: Request, ipAllowlist: string[]) {
  if (ipAllowlist.length === 0) {
    return true;
  }

  const clientIp = getClientIp(req);
  return clientIp !== null && ipAllowlist.includes(clientIp);
}
