import type { Pool } from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import type { AuthUser } from "./types.js";

export type AuthDatabase = Pick<Pool, "query">;

export type LoginUser = {
  id: string;
  passwordHash: string;
  status: "active" | "passive";
  failedLoginAttempts: number;
};

type LoginUserRow = RowDataPacket & {
  id: string;
  password_hash: string;
  status: "active" | "passive";
  failed_login_attempts: number;
};

type UserPermissionRow = RowDataPacket & {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role_id: string;
  role_name: string;
  permission_id: string | null;
};

export class AuthRepository {
  constructor(private readonly database: AuthDatabase) {}

  async findLoginUser(username: string): Promise<LoginUser | null> {
    const [rows] = await this.database.query<LoginUserRow[]>(
      "SELECT id, password_hash, status, failed_login_attempts FROM users WHERE username = ? OR email = ? LIMIT 1",
      [username, username],
    );
    const row = rows[0];

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      passwordHash: row.password_hash,
      status: row.status,
      failedLoginAttempts: row.failed_login_attempts,
    };
  }

  async incrementFailedLoginAttempts(userId: string) {
    await this.database.query(
      "UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = ?",
      [userId],
    );
  }

  async recordSuccessfulLogin(userId: string) {
    await this.database.query(
      "UPDATE users SET failed_login_attempts = 0, last_login_at = CURRENT_TIMESTAMP WHERE id = ?",
      [userId],
    );
  }

  async getUserWithPermissions(userId: string): Promise<AuthUser | null> {
    const [rows] = await this.database.query<UserPermissionRow[]>(
      `SELECT
        users.id,
        users.username,
        users.full_name,
        users.email,
        users.role_id,
        roles.name AS role_name,
        role_permissions.permission_id
      FROM users
      INNER JOIN roles ON roles.id = users.role_id
      LEFT JOIN role_permissions ON role_permissions.role_id = roles.id
      WHERE users.id = ? AND users.status = 'active' AND roles.is_active = 1`,
      [userId],
    );

    if (rows.length === 0) {
      return null;
    }

    const first = rows[0]!;

    return {
      id: first.id,
      username: first.username,
      fullName: first.full_name,
      email: first.email,
      roleId: first.role_id,
      roleName: first.role_name,
      permissions: rows.flatMap((row) => (row.permission_id ? [row.permission_id] : [])),
    } satisfies AuthUser;
  }
}
