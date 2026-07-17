import type { RowDataPacket } from "mysql2";

export type UserStatus = "active" | "passive";
export type PermissionOverrideEffect = "allow" | "deny";
export type UserListScope = "current" | "archived" | "all";

export type PermissionOverride = {
  permissionId: string;
  effect: PermissionOverrideEffect;
};

export type UserRow = RowDataPacket & {
  id: string;
  username: string;
  full_name: string;
  email: string;
  status: UserStatus;
  role_id: string;
  role_name: string;
  created_at: string;
  last_login_at: string | null;
  archived_at: string | null;
  permission_overrides: unknown;
  permissions: unknown;
};

export type UserDto = {
  id: string;
  username: string;
  fullName: string;
  email: string;
  status: UserStatus;
  roleId: string;
  roleName: string;
  createdAt: string;
  lastLoginAt: string | null;
  archivedAt: string | null;
  permissionOverrides: PermissionOverride[];
  permissions: string[];
};

export type CreateUserInput = {
  username: string;
  fullName: string;
  email: string;
  password: string;
  roleId: string;
  permissionOverrides: PermissionOverride[];
};

export type UpdateUserInput = {
  userId: string;
  fullName: string;
  email: string;
  roleId: string;
  status: UserStatus;
  permissionOverrides?: PermissionOverride[];
};
