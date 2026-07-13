import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { Pool } from "mysql2/promise";
import type { CreateRoleInput, PermissionRow, RoleRow, UpdateRoleInput } from "./types.js";

export type RoleDatabase = Pick<Pool, "query" | "getConnection">;

export class RoleRepository {
  constructor(private readonly database: RoleDatabase) {}

  async listPermissions() {
    const [rows] = await this.database.query<PermissionRow[]>(
      `SELECT id, group_name, label, description
      FROM permissions
      ORDER BY group_name, label`,
    );
    return rows;
  }

  async listRoles() {
    const [rows] = await this.database.query<RoleRow[]>(
      `SELECT
        roles.id,
        roles.name,
        roles.description,
        roles.is_system,
        roles.is_active,
        roles.created_at,
        role_permissions.permission_id
      FROM roles
      LEFT JOIN role_permissions ON role_permissions.role_id = roles.id
      ORDER BY roles.created_at ASC, roles.name ASC`,
    );
    return rows;
  }

  async permissionIdsExist(permissionIds: string[]) {
    if (permissionIds.length === 0) {
      return true;
    }

    const [rows] = await this.database.query<RowDataPacket[]>(
      `SELECT id FROM permissions WHERE id IN (${permissionIds.map(() => "?").join(",")})`,
      permissionIds,
    );
    return rows.length === permissionIds.length;
  }

  async create(roleId: string, input: CreateRoleInput) {
    const connection = await this.database.getConnection();

    try {
      await connection.beginTransaction();
      await connection.query(
        "INSERT INTO roles (id, name, description, is_system, is_active) VALUES (?, ?, ?, 0, 1)",
        [roleId, input.name, input.description],
      );

      for (const permissionId of input.permissionIds) {
        await connection.query(
          "INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
          [roleId, permissionId],
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async update(input: UpdateRoleInput) {
    const [result] = await this.database.query<ResultSetHeader>(
      "UPDATE roles SET name = ?, description = ?, is_active = ? WHERE id = ?",
      [input.name, input.description, input.isActive ? 1 : 0, input.roleId],
    );
    return result.affectedRows;
  }

  async replacePermissions(roleId: string, permissionIds: string[]) {
    const connection = await this.database.getConnection();

    try {
      await connection.beginTransaction();
      await connection.query("DELETE FROM role_permissions WHERE role_id = ?", [roleId]);

      for (const permissionId of permissionIds) {
        await connection.query(
          "INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
          [roleId, permissionId],
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
