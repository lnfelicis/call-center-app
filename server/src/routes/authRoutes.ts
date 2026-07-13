import { writeAuditLog } from "../audit.js";
import { requireAuth } from "../auth.js";
import { db } from "../db.js";
import { AuthController } from "../modules/auth/controller.js";
import { getClientIp, isClientIpAllowed } from "../modules/auth/request-ip.js";
import { AuthRepository } from "../modules/auth/repository.js";
import { createAuthRoutes } from "../modules/auth/routes.js";
import { signToken, verifyPassword } from "../modules/auth/security.js";
import { AuthService } from "../modules/auth/service.js";
import { readAppSetting } from "../settings.js";

const repository = new AuthRepository(db);
const service = new AuthService({
  repository,
  readSecuritySettings: () => readAppSetting("security_settings"),
  getClientIp,
  isClientIpAllowed,
  verifyPassword,
  signToken,
  writeAuditLog,
});
const controller = new AuthController(service);

export const authRoutes = createAuthRoutes({ controller, requireAuth });
