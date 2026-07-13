import type { RowDataPacket } from "mysql2";

export type PermissionRow = RowDataPacket & {
  id: string;
  group_name: string;
  label: string;
  description: string | null;
};

export type RoleRow = RowDataPacket & {
  id: string;
  name: string;
  description: string | null;
  is_system: 0 | 1;
  is_active: 0 | 1;
  created_at: string;
  permission_id: string | null;
};

export type RoleDto = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  permissions: string[];
};

export type CreateRoleInput = {
  name: string;
  description: string | null;
  permissionIds: string[];
};

export type UpdateRoleInput = {
  roleId: string;
  name: string;
  description: string | null;
  isActive: boolean;
};
