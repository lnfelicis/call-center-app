import type { Request } from "express";

export function getClientIp(req: Request) {
  const ipAddress = req.ip ?? req.socket.remoteAddress;

  if (!ipAddress) {
    return null;
  }

  return ipAddress.replace(/^::ffff:/i, "");
}
