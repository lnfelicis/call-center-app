export type DatabaseConfig = {
  host?: string;
  port: number;
  user?: string;
  password?: string;
  database?: string;
  charset: "utf8mb4";
  waitForConnections: true;
  connectionLimit: 10;
  queueLimit: 0;
};

export type AppConfig = {
  port: number;
  host: "0.0.0.0";
  trustProxy: boolean;
  shutdownTimeoutMs: number;
  logLevel: string;
  database: DatabaseConfig;
};

export function readAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const database: DatabaseConfig = {
    port: Number(env.DB_PORT),
    charset: "utf8mb4",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ...(env.DB_HOST === undefined ? {} : { host: env.DB_HOST }),
    ...(env.DB_USER === undefined ? {} : { user: env.DB_USER }),
    ...(env.DB_PASSWORD === undefined ? {} : { password: env.DB_PASSWORD }),
    ...(env.DB_NAME === undefined ? {} : { database: env.DB_NAME }),
  };

  return {
    port: Number(env.PORT) || 3000,
    host: "0.0.0.0",
    trustProxy: env.RENDER === "true",
    shutdownTimeoutMs: 10_000,
    logLevel: env.LOG_LEVEL || (env.NODE_ENV === "test" ? "silent" : "info"),
    database,
  };
}
