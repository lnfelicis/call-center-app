import type { Request } from "express";
import type { AuditWriter } from "../audit/types.js";
import type { AuthRepository } from "./repository.js";
import type { AuthTokenPayload } from "./security.js";
import type { AuthUser, SecuritySettings } from "./types.js";

export type LoginResult =
  | { type: "ip-not-allowed" }
  | { type: "invalid-credentials" }
  | { type: "blocked" }
  | { type: "inactive-role" }
  | { type: "success"; token: string; user: AuthUser };

export type AuthServiceDependencies = {
  repository: Pick<
    AuthRepository,
    | "findLoginUser"
    | "incrementFailedLoginAttempts"
    | "recordSuccessfulLogin"
    | "getUserWithPermissions"
  >;
  readSecuritySettings: () => Promise<SecuritySettings>;
  getClientIp: (req: Request) => string | null;
  isClientIpAllowed: (req: Request, ipAllowlist: string[]) => boolean;
  verifyPassword: (password: string, storedHash: string) => Promise<boolean>;
  signToken: (
    userId: string,
    durationMinutes?: number,
    loginIp?: string,
    sessionVersion?: number,
  ) => string;
  writeAuditLog: AuditWriter;
};

export class AuthService {
  constructor(private readonly dependencies: AuthServiceDependencies) {}

  async login(req: Request, username: string, password: string): Promise<LoginResult> {
    const securitySettings = await this.dependencies.readSecuritySettings();
    const requestIp = this.dependencies.getClientIp(req) ?? undefined;

    if (!this.dependencies.isClientIpAllowed(req, securitySettings.ipAllowlist)) {
      return { type: "ip-not-allowed" };
    }

    const user = await this.dependencies.repository.findLoginUser(username);

    if (!user || user.status !== "active") {
      return { type: "invalid-credentials" };
    }

    if (user.failedLoginAttempts >= securitySettings.failedLoginLimit) {
      await this.dependencies.writeAuditLog({
        req,
        action: "auth.login.blocked",
        entityType: "user",
        entityId: user.id,
        metadata: { reason: "failed_login_limit" },
      });
      return { type: "blocked" };
    }

    const passwordMatches = await this.dependencies.verifyPassword(password, user.passwordHash);

    if (!passwordMatches) {
      await this.dependencies.repository.incrementFailedLoginAttempts(user.id);
      return { type: "invalid-credentials" };
    }

    await this.dependencies.repository.recordSuccessfulLogin(user.id);

    const authSessionUser = await this.dependencies.repository.getUserWithPermissions(user.id);

    if (!authSessionUser) {
      return { type: "inactive-role" };
    }

    const { sessionVersion, ...authUser } = authSessionUser;

    await this.dependencies.writeAuditLog({
      req,
      action: "auth.login",
      entityType: "user",
      entityId: user.id,
    });

    return {
      type: "success",
      token: this.dependencies.signToken(
        user.id,
        securitySettings.sessionDurationMinutes,
        requestIp,
        sessionVersion,
      ),
      user: authUser,
    };
  }

  async logout(req: Request, userId: string | undefined) {
    await this.dependencies.writeAuditLog({
      req,
      action: "auth.logout",
      entityType: "user",
      entityId: userId,
    });
  }
}
