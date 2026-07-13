import type { Request } from "express";

export type AuthUser = {
  id: string;
  username: string;
  fullName: string;
  email: string;
  roleId: string;
  roleName: string;
  permissions: string[];
};

export type AuthenticatedRequest = Request & {
  user?: AuthUser;
};

export type SecuritySettings = {
  failedLoginLimit: number;
  sessionDurationMinutes: number;
  ipAllowlist: string[];
};

export type TokenService = {
  sign(userId: string, durationMinutes?: number, loginIp?: string): string;
  verify(token: string): { sub: string; exp: number; loginIp?: string | undefined } | null;
};
