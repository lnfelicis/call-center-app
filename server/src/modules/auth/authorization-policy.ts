import type { AuthUser } from "./types.js";

type PermissionHolder = Pick<AuthUser, "permissions"> | null | undefined;

export function hasPermission(user: PermissionHolder, permission: string) {
  return Boolean(user?.permissions.includes(permission));
}

export function hasAnyPermission(user: PermissionHolder, permissions: string[]) {
  const userPermissions = user?.permissions ?? [];
  return permissions.some((permission) => userPermissions.includes(permission));
}
