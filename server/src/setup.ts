import type { ConnectionOptions } from "mysql2";
import mysql, { type Connection } from "mysql2/promise";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readAppConfig } from "./config/app-config.js";
import type { Database } from "./database/database.js";
import { createPool } from "./database/mysql.js";
import {
  defaultCallFormFields,
  defaultCallFormOptions,
  extendedCallFormOptions,
  permissions,
  schemaStatements,
} from "./database/schema.js";
import { SUPER_ADMIN_ROLE_ID, SUPER_ADMIN_USER_ID } from "./database/system-identities.js";
import { hashPassword } from "./modules/auth/security.js";
import {
  defaultNotificationSettings,
  defaultPrivacySettings,
  defaultSecuritySettings,
} from "./modules/settings/app-settings.types.js";

const defaultOptionColors: Record<string, string> = {
  open: "#2563eb",
  in_progress: "#7c3aed",
  waiting: "#d97706",
  follow_up: "#0891b2",
  transferred: "#4f46e5",
  resolved: "#16a34a",
  closed: "#64748b",
  cancelled: "#dc2626",
  duplicate: "#9333ea",
  archived: "#475569",
  low: "#16a34a",
  normal: "#2563eb",
  high: "#ea580c",
  urgent: "#dc2626",
};

export type SetupConfig = {
  databaseName: string | undefined;
  databaseServer: ConnectionOptions;
  superAdmin: {
    username: string;
    fullName: string;
    email: string;
    password: string;
  };
};

type SetupConnection = Pick<Connection, "query" | "end">;

export type SetupDependencies = {
  database: Database;
  createServerConnection: (config: ConnectionOptions) => Promise<SetupConnection>;
  hashPassword: (password: string) => Promise<string>;
  generateId: () => string;
  output: Pick<Console, "log">;
};

export type SetupCliOptions = {
  environmentFile?: string;
  requireTestDatabase?: boolean;
};

export function readSetupCliOptions(args: string[] = process.argv.slice(2)): SetupCliOptions {
  if (args.includes("--test")) {
    return {
      environmentFile: ".env.test",
      requireTestDatabase: true,
    };
  }

  return {};
}

export function assertSafeSetupTestDatabaseName(database: string | undefined) {
  if (!database?.endsWith("_test")) {
    throw new Error(
      `Test database setup blocked: DB_NAME must end with _test (received ${database ?? "undefined"}).`,
    );
  }

  if (!/^[A-Za-z0-9_]+_test$/.test(database)) {
    throw new Error(
      `Test database setup blocked: DB_NAME contains unsafe characters (received ${database}).`,
    );
  }

  return database;
}

export function readSetupConfig(env: NodeJS.ProcessEnv = process.env): SetupConfig {
  const databaseServer: ConnectionOptions = {
    port: Number(env.DB_PORT) || 3306,
    multipleStatements: false,
    ...(env.DB_HOST === undefined ? {} : { host: env.DB_HOST }),
    ...(env.DB_USER === undefined ? {} : { user: env.DB_USER }),
    ...(env.DB_PASSWORD === undefined ? {} : { password: env.DB_PASSWORD }),
  };

  return {
    databaseName: env.DB_NAME,
    databaseServer,
    superAdmin: {
      username: env.SUPER_ADMIN_USERNAME || "superadmin",
      fullName: env.SUPER_ADMIN_FULL_NAME || "Süper Admin",
      email: env.SUPER_ADMIN_EMAIL || "superadmin@example.com",
      password: env.SUPER_ADMIN_PASSWORD || "Admin12345!",
    },
  };
}

async function ensureDatabaseExists(
  config: SetupConfig,
  createServerConnection: SetupDependencies["createServerConnection"],
) {
  if (!config.databaseName) {
    throw new Error("DB_NAME .env içinde tanımlı olmalıdır.");
  }

  const connection = await createServerConnection(config.databaseServer);

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await connection.end();
  }
}

async function runSchema(database: Database) {
  for (const statement of schemaStatements) {
    await database.query(statement);
  }

  await database.query(
    `ALTER TABLE call_form_options
    MODIFY option_type ENUM('interaction_type', 'issue_category', 'issue_sub_category', 'status', 'priority', 'resolution_category') NOT NULL`,
  );

  await database.query(
    "ALTER TABLE call_records MODIFY priority VARCHAR(80) NOT NULL DEFAULT 'normal'",
  );
  await database.query(
    "ALTER TABLE call_records MODIFY status VARCHAR(80) NOT NULL DEFAULT 'open'",
  );

  try {
    await database.query("ALTER TABLE users ADD COLUMN archived_at TIMESTAMP NULL AFTER last_login_at");
  } catch (error) {
    const code = (error as { code?: string }).code;

    if (code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }

  try {
    await database.query(
      "ALTER TABLE users ADD COLUMN session_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER failed_login_attempts",
    );
  } catch (error) {
    const code = (error as { code?: string }).code;

    if (code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }

  try {
    await database.query("ALTER TABLE call_form_options ADD COLUMN value VARCHAR(80) NULL AFTER label");
  } catch (error) {
    const code = (error as { code?: string }).code;

    if (code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }

  try {
    await database.query("ALTER TABLE call_form_options ADD COLUMN color VARCHAR(16) NULL AFTER value");
  } catch (error) {
    const code = (error as { code?: string }).code;

    if (code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }

  for (const statement of [
    "ALTER TABLE notifications ADD COLUMN entity_label VARCHAR(255) NULL AFTER entity_id",
    "ALTER TABLE audit_logs ADD COLUMN entity_label VARCHAR(255) NULL AFTER entity_id",
  ]) {
    try {
      await database.query(statement);
    } catch (error) {
      const code = (error as { code?: string }).code;

      if (code !== "ER_DUP_FIELDNAME") {
        throw error;
      }
    }
  }
}

async function seedPermissions(database: Database) {
  for (const permission of permissions) {
    await database.query(
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

async function seedSuperAdminRole(database: Database) {
  await database.query(
    `INSERT INTO roles (id, name, description, is_system, is_active)
    VALUES (?, 'Süper Admin', 'Sistemdeki tüm yetkilere sahip ana yönetici rolü.', 1, 1)
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      description = VALUES(description),
      is_system = 1,
      is_active = 1`,
    [SUPER_ADMIN_ROLE_ID],
  );

  await database.query("DELETE FROM role_permissions WHERE role_id = ?", [SUPER_ADMIN_ROLE_ID]);

  for (const permission of permissions) {
    await database.query("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)", [
      SUPER_ADMIN_ROLE_ID,
      permission.id,
    ]);
  }
}

async function seedCallFormOptions(database: Database) {
  for (const option of [...defaultCallFormOptions, ...extendedCallFormOptions]) {
    const value = "value" in option && typeof option.value === "string" ? option.value : option.label;
    const color = defaultOptionColors[value] ?? null;

    await database.query(
      `INSERT INTO call_form_options (id, option_type, label, value, color, is_active, sort_order)
      VALUES (UUID(), ?, ?, ?, ?, 1, ?)
      ON DUPLICATE KEY UPDATE
        value = VALUES(value),
        color = COALESCE(call_form_options.color, VALUES(color)),
        is_active = 1,
        sort_order = VALUES(sort_order)`,
      [option.type, option.label, value, color, option.sortOrder],
    );
  }
}

async function seedCallFormFields(database: Database) {
  for (const field of defaultCallFormFields) {
    await database.query(
      `INSERT INTO call_form_fields
        (field_key, label, is_active, is_required, is_visible, is_editable, is_masked, sort_order)
      VALUES (?, ?, 1, ?, 1, 1, ?, ?)
      ON DUPLICATE KEY UPDATE
        label = VALUES(label),
        sort_order = VALUES(sort_order)`,
      [field.key, field.label, field.required ? 1 : 0, field.masked ? 1 : 0, field.sortOrder],
    );
  }
}

async function seedAppSettings(database: Database) {
  await database.query(
    "INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES (?, ?)",
    ["notification_settings", JSON.stringify(defaultNotificationSettings)],
  );
  await database.query(
    "INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES (?, ?)",
    ["security_settings", JSON.stringify(defaultSecuritySettings)],
  );
  await database.query(
    "INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES (?, ?)",
    ["privacy_settings", JSON.stringify(defaultPrivacySettings)],
  );
}

async function seedSuperAdminUser(
  database: Database,
  config: SetupConfig,
  dependencies: Pick<SetupDependencies, "hashPassword" | "generateId">,
) {
  const { username, fullName, email, password } = config.superAdmin;

  await database.query(
    `INSERT INTO users
      (id, username, full_name, email, password_hash, role_id, status)
    VALUES (?, ?, ?, ?, ?, ?, 'active')
    ON DUPLICATE KEY UPDATE
      full_name = VALUES(full_name),
      email = VALUES(email),
      role_id = VALUES(role_id),
      status = 'active'`,
    [
      SUPER_ADMIN_USER_ID,
      username,
      fullName,
      email,
      await dependencies.hashPassword(password),
      SUPER_ADMIN_ROLE_ID,
    ],
  );

  await database.query(
    `INSERT INTO audit_logs
      (id, actor_user_id, action, entity_type, entity_id, entity_label, metadata)
    VALUES (?, ?, 'seed.super_admin', 'user', ?, ?, ?)`,
    [
      dependencies.generateId(),
      SUPER_ADMIN_USER_ID,
      SUPER_ADMIN_USER_ID,
      email,
      JSON.stringify({ username, role: "Süper Admin" }),
    ],
  );

  return { username, email, password };
}

export async function runSetup(config: SetupConfig, dependencies: SetupDependencies) {
  await ensureDatabaseExists(config, dependencies.createServerConnection);
  await runSchema(dependencies.database);
  await seedPermissions(dependencies.database);
  await seedCallFormOptions(dependencies.database);
  await seedCallFormFields(dependencies.database);
  await seedAppSettings(dependencies.database);
  await seedSuperAdminRole(dependencies.database);
  const admin = await seedSuperAdminUser(dependencies.database, config, dependencies);

  dependencies.output.log("Setup tamamlandı.");
  dependencies.output.log(`Süper Admin kullanıcı adı: ${admin.username}`);
  dependencies.output.log(`Süper Admin e-posta: ${admin.email}`);
  dependencies.output.log(`Geçici şifre: ${admin.password}`);
  dependencies.output.log(
    "İlk girişten sonra SUPER_ADMIN_PASSWORD env değeriyle şifreyi değiştirmeniz önerilir.",
  );

  return admin;
}

export async function runSetupCli(options: SetupCliOptions = {}) {
  const { config: loadEnvironment } = await import("dotenv");
  let environment = process.env;

  if (options.environmentFile) {
    environment = {};
    const result = loadEnvironment({
      path: resolve(process.cwd(), options.environmentFile),
      override: true,
      quiet: true,
      processEnv: environment,
    });

    if (result.error) {
      throw new Error(
        `Environment file could not be loaded: ${options.environmentFile} (${result.error.message})`,
      );
    }
  } else {
    loadEnvironment();
  }

  const setupConfig = readSetupConfig(environment);
  if (options.requireTestDatabase) {
    assertSafeSetupTestDatabaseName(setupConfig.databaseName);
  }

  const database = createPool(readAppConfig(environment).database);

  try {
    await runSetup(setupConfig, {
      database,
      createServerConnection: (connectionConfig) => mysql.createConnection(connectionConfig),
      hashPassword,
      generateId: randomUUID,
      output: console,
    });
  } finally {
    await database.end();
  }
}

const executedDirectly = Boolean(
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url,
);

if (executedDirectly) {
  runSetupCli(readSetupCliOptions()).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
