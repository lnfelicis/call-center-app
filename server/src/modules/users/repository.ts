import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { Pool } from "mysql2/promise";
import type {
  CreateUserInput,
  PermissionOverride,
  UpdateUserInput,
  UserRow,
  UserListScope,
} from "./types.js";

export type UserDatabase = Pick<Pool, "query" | "getConnection">;

const userSelect = `SELECT
  users.id,
  users.username,
  users.full_name,
  users.email,
  users.status,
  users.role_id,
  roles.name AS role_name,
  users.created_at,
  users.last_login_at,
  users.archived_at,
  COALESCE((
    SELECT JSON_ARRAYAGG(JSON_OBJECT(
      'permissionId', user_permission_overrides.permission_id,
      'effect', user_permission_overrides.effect
    ))
    FROM user_permission_overrides
    WHERE user_permission_overrides.user_id = users.id
  ), JSON_ARRAY()) AS permission_overrides,
  COALESCE((
    SELECT JSON_ARRAYAGG(effective_user_permissions.permission_id)
    FROM effective_user_permissions
    WHERE effective_user_permissions.user_id = users.id
  ), JSON_ARRAY()) AS permissions
FROM users
INNER JOIN roles ON roles.id = users.role_id`;

async function replaceOverrides(
  connection: Awaited<ReturnType<Pool["getConnection"]>>,
  userId: string,
  overrides: PermissionOverride[],
) {
  await connection.query("DELETE FROM user_permission_overrides WHERE user_id = ?", [userId]);

  for (const override of overrides) {
    await connection.query(
      `INSERT INTO user_permission_overrides (user_id, permission_id, effect)
      VALUES (?, ?, ?)`,
      [userId, override.permissionId, override.effect],
    );
  }
}

export class UserRepository {
  constructor(private readonly database: UserDatabase) {}

  async listActive() {
    const [rows] = await this.database.query<UserRow[]>(
      `${userSelect}
      WHERE users.status = 'active' AND users.archived_at IS NULL
      ORDER BY users.full_name ASC`,
    );
    return rows;
  }

  async listAll(scope: UserListScope = "current") {
    const scopeClause = scope === "all"
      ? ""
      : scope === "archived"
        ? "WHERE users.archived_at IS NOT NULL"
        : "WHERE users.archived_at IS NULL";
    const [rows] = await this.database.query<UserRow[]>(
      `${userSelect}
      ${scopeClause}
      ORDER BY users.created_at ASC`,
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

  async create(userId: string, input: CreateUserInput, passwordHash: string) {
    const connection = await this.database.getConnection();

    try {
      await connection.beginTransaction();
      await connection.query(
        `INSERT INTO users
          (id, username, full_name, email, password_hash, role_id, status)
        VALUES (?, ?, ?, ?, ?, ?, 'active')`,
        [userId, input.username, input.fullName, input.email, passwordHash, input.roleId],
      );
      await replaceOverrides(connection, userId, input.permissionOverrides);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async update(input: UpdateUserInput) {
    const connection = await this.database.getConnection();

    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<Array<RowDataPacket & { role_id: string }>>(
        "SELECT role_id FROM users WHERE id = ? AND archived_at IS NULL FOR UPDATE",
        [input.userId],
      );
      const current = rows[0];

      if (!current) {
        await connection.rollback();
        return { affectedRows: 0, roleChanged: false };
      }

      const roleChanged = current.role_id !== input.roleId;
      const [result] = await connection.query<ResultSetHeader>(
        `UPDATE users
        SET full_name = ?, email = ?, role_id = ?, status = ?
        WHERE id = ?`,
        [input.fullName, input.email, input.roleId, input.status, input.userId],
      );

      if (input.permissionOverrides !== undefined) {
        await replaceOverrides(connection, input.userId, input.permissionOverrides);
      } else if (roleChanged) {
        await replaceOverrides(connection, input.userId, []);
      }

      await connection.commit();
      return { affectedRows: result.affectedRows, roleChanged };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async archive(userId: string) {
    const [result] = await this.database.query<ResultSetHeader>(
      `UPDATE users
      SET archived_at = CURRENT_TIMESTAMP
      WHERE id = ? AND archived_at IS NULL`,
      [userId],
    );
    return result.affectedRows;
  }

  async restore(userId: string) {
    const [result] = await this.database.query<ResultSetHeader>(
      `UPDATE users
      SET archived_at = NULL
      WHERE id = ? AND archived_at IS NOT NULL`,
      [userId],
    );
    return result.affectedRows;
  }
}
