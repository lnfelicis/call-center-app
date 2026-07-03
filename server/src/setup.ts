import mysql from "mysql2/promise";
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { db } from "./db.js";
import { defaultCallFormOptions, permissions, schemaStatements } from "./schema.js";
import { hashPassword } from "./security.js";

const superAdminRoleId = "00000000-0000-4000-8000-000000000001";
const superAdminUserId = "00000000-0000-4000-8000-000000000002";

async function ensureDatabaseExists() {
  const database = process.env.DB_NAME;

  if (!database) {
    throw new Error("DB_NAME .env içinde tanımlı olmalıdır.");
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: false,
  });

  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } finally {
    await connection.end();
  }
}

async function runSchema() {
  for (const statement of schemaStatements) {
    await db.query(statement);
  }
}

async function seedPermissions() {
  for (const permission of permissions) {
    await db.query(
      `INSERT INTO permissions (id, group_name, label, description)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        group_name = VALUES(group_name),
        label = VALUES(label),
        description = VALUES(description)`,
      [permission.id, permission.groupName, permission.label, permission.description],
    );
  }
}

async function seedSuperAdminRole() {
  await db.query(
    `INSERT INTO roles (id, name, description, is_system, is_active)
    VALUES (?, 'Süper Admin', 'Sistemdeki tüm yetkilere sahip ana yönetici rolü.', 1, 1)
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      description = VALUES(description),
      is_system = 1,
      is_active = 1`,
    [superAdminRoleId],
  );

  await db.query("DELETE FROM role_permissions WHERE role_id = ?", [superAdminRoleId]);

  for (const permission of permissions) {
    await db.query("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)", [
      superAdminRoleId,
      permission.id,
    ]);
  }
}

async function seedCallFormOptions() {
  for (const option of defaultCallFormOptions) {
    await db.query(
      `INSERT INTO call_form_options (id, option_type, label, is_active, sort_order)
      VALUES (UUID(), ?, ?, 1, ?)
      ON DUPLICATE KEY UPDATE
        is_active = 1,
        sort_order = VALUES(sort_order)`,
      [option.type, option.label, option.sortOrder],
    );
  }
}

async function seedSuperAdminUser() {
  const username = process.env.SUPER_ADMIN_USERNAME || "superadmin";
  const fullName = process.env.SUPER_ADMIN_FULL_NAME || "Süper Admin";
  const email = process.env.SUPER_ADMIN_EMAIL || "superadmin@example.com";
  const password = process.env.SUPER_ADMIN_PASSWORD || "Admin12345!";

  await db.query(
    `INSERT INTO users
      (id, username, full_name, email, password_hash, role_id, status)
    VALUES (?, ?, ?, ?, ?, ?, 'active')
    ON DUPLICATE KEY UPDATE
      full_name = VALUES(full_name),
      email = VALUES(email),
      role_id = VALUES(role_id),
      status = 'active'`,
    [
      superAdminUserId,
      username,
      fullName,
      email,
      await hashPassword(password),
      superAdminRoleId,
    ],
  );

  await db.query(
    `INSERT INTO audit_logs
      (id, actor_user_id, action, entity_type, entity_id, metadata)
    VALUES (?, ?, 'seed.super_admin', 'user', ?, ?)`,
    [
      randomUUID(),
      superAdminUserId,
      superAdminUserId,
      JSON.stringify({ username, role: "Süper Admin" }),
    ],
  );

  return { username, email, password };
}

async function main() {
  await ensureDatabaseExists();
  await runSchema();
  await seedPermissions();
  await seedCallFormOptions();
  await seedSuperAdminRole();
  const admin = await seedSuperAdminUser();

  console.log("Setup tamamlandı.");
  console.log(`Süper Admin kullanıcı adı: ${admin.username}`);
  console.log(`Süper Admin e-posta: ${admin.email}`);
  console.log(`Geçici şifre: ${admin.password}`);
  console.log("İlk girişten sonra SUPER_ADMIN_PASSWORD env değeriyle şifreyi değiştirmeniz önerilir.");

  await db.end();
}

main().catch(async (error: unknown) => {
  console.error(error);
  await db.end();
  process.exit(1);
});
