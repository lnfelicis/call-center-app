import type { ResultSetHeader } from "mysql2";
import type { Pool } from "mysql2/promise";
import type { CreateUserInput, UpdateUserInput, UserRow } from "./types.js";

export type UserDatabase = Pick<Pool, "query">;

export class UserRepository {
  constructor(private readonly database: UserDatabase) {}

  async listActive() {
    const [rows] = await this.database.query<UserRow[]>(
      `SELECT
        users.id,
        users.username,
        users.full_name,
        users.email,
        users.status,
        users.role_id,
        roles.name AS role_name,
        users.created_at,
        users.last_login_at
      FROM users
      INNER JOIN roles ON roles.id = users.role_id
      WHERE users.status = 'active'
      ORDER BY users.full_name ASC`,
    );
    return rows;
  }

  async listAll() {
    const [rows] = await this.database.query<UserRow[]>(
      `SELECT
        users.id,
        users.username,
        users.full_name,
        users.email,
        users.status,
        users.role_id,
        roles.name AS role_name,
        users.created_at,
        users.last_login_at
      FROM users
      INNER JOIN roles ON roles.id = users.role_id
      ORDER BY users.created_at ASC`,
    );
    return rows;
  }

  async create(userId: string, input: CreateUserInput, passwordHash: string) {
    await this.database.query(
      `INSERT INTO users
        (id, username, full_name, email, password_hash, role_id, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      [userId, input.username, input.fullName, input.email, passwordHash, input.roleId],
    );
  }

  async update(input: UpdateUserInput) {
    const [result] = await this.database.query<ResultSetHeader>(
      `UPDATE users
      SET full_name = ?, email = ?, role_id = ?, status = ?
      WHERE id = ?`,
      [input.fullName, input.email, input.roleId, input.status, input.userId],
    );
    return result.affectedRows;
  }
}
