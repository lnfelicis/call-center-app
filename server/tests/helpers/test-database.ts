import mysql from "mysql2/promise";
import type { ConnectionOptions } from "mysql2";

export function hasTestDatabaseConfig(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(
    env.DB_HOST &&
      env.DB_USER &&
      env.DB_NAME &&
      /^[A-Za-z0-9_]+_test$/.test(env.DB_NAME),
  );
}

export function assertSafeTestDatabaseName(database = process.env.DB_NAME) {
  if (!database?.endsWith("_test")) {
    throw new Error(
      `Destructive test database operation blocked: DB_NAME must end with _test (received ${database ?? "undefined"}).`,
    );
  }

  if (!/^[A-Za-z0-9_]+_test$/.test(database)) {
    throw new Error(
      `Destructive test database operation blocked: DB_NAME contains unsafe characters (received ${database}).`,
    );
  }

  return database;
}

export async function recreateTestDatabase() {
  const database = assertSafeTestDatabaseName();
  const connectionOptions: ConnectionOptions = {
    port: Number(process.env.DB_PORT) || 3306,
    multipleStatements: false,
    ...(process.env.DB_HOST === undefined ? {} : { host: process.env.DB_HOST }),
    ...(process.env.DB_USER === undefined ? {} : { user: process.env.DB_USER }),
    ...(process.env.DB_PASSWORD === undefined
      ? {}
      : { password: process.env.DB_PASSWORD }),
  };
  const connection = await mysql.createConnection(connectionOptions);

  try {
    await connection.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await connection.query(
      `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await connection.end();
  }
}
