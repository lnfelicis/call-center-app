import { db } from "./db.js";
import {
  createRequireAuth,
  requireAnyPermission,
  requirePermission,
} from "./modules/auth/middleware.js";
import { isSessionIpAllowed } from "./modules/auth/request-ip.js";
import { AuthRepository } from "./modules/auth/repository.js";
import { verifyToken } from "./modules/auth/security.js";
import { readAppSetting } from "./settings.js";

export type { AuthenticatedRequest, AuthUser } from "./modules/auth/types.js";
export { requireAnyPermission, requirePermission };

const authRepository = new AuthRepository(db);

export const getUserWithPermissions = (userId: string) =>
  authRepository.getUserWithPermissions(userId);

export const requireAuth = createRequireAuth({
  verifyToken,
  readSecuritySettings: () => readAppSetting("security_settings"),
  isSessionIpAllowed,
  getUserWithPermissions,
});
