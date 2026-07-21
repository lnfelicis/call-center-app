import type { NextFunction, RequestHandler, Response } from "express";
import { hasAnyPermission, hasPermission } from "./authorization-policy.js";
import type { AuthenticatedRequest, AuthSessionUser, SecuritySettings } from "./types.js";
import type { AuthTokenPayload } from "./security.js";

export type AuthMiddlewareDependencies = {
  verifyToken: (token: string) => AuthTokenPayload | null;
  readSecuritySettings: () => Promise<SecuritySettings>;
  isSessionIpAllowed: (
    req: AuthenticatedRequest,
    ipAllowlist: string[],
    loginIp: string | undefined,
  ) => boolean;
  getUserWithPermissions: (userId: string) => Promise<AuthSessionUser | null>;
};

export function createRequireAuth({
  verifyToken,
  readSecuritySettings,
  isSessionIpAllowed,
  getUserWithPermissions,
}: AuthMiddlewareDependencies): RequestHandler {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const header = req.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

    if (!token) {
      res.status(401).json({ message: "Oturum gerekli." });
      return;
    }

    const payload = verifyToken(token);

    if (!payload) {
      res.status(401).json({ message: "Oturum geçersiz veya süresi dolmuş." });
      return;
    }

    const securitySettings = await readSecuritySettings();

    if (!isSessionIpAllowed(req, securitySettings.ipAllowlist, payload.loginIp)) {
      res.status(401).json({
        code: "IP_NOT_ALLOWED",
        message: "Bu IP adresinden oturuma izin verilmiyor.",
      });
      return;
    }

    const sessionUser = await getUserWithPermissions(payload.sub);

    if (!sessionUser) {
      res.status(401).json({ message: "Kullanıcı aktif değil veya bulunamadı." });
      return;
    }

    if ((payload.sv ?? 0) !== sessionUser.sessionVersion) {
      res.status(401).json({
        message: "Oturumunuz geçersiz kılındı. Lütfen tekrar giriş yapın.",
      });
      return;
    }

    const { sessionVersion: _sessionVersion, ...user } = sessionUser;
    req.user = user;
    next();
  };
}

export function requirePermission(permission: string): RequestHandler {
  return (req: AuthenticatedRequest, res, next) => {
    if (!hasPermission(req.user, permission)) {
      res.status(403).json({ message: "Bu işlem için yetkiniz yok." });
      return;
    }

    next();
  };
}

export function requireAnyPermission(permissions: string[]): RequestHandler {
  return (req: AuthenticatedRequest, res, next) => {
    if (!hasAnyPermission(req.user, permissions)) {
      res.status(403).json({ message: "Bu işlem için yetkiniz yok." });
      return;
    }

    next();
  };
}
