import type { Pool, PoolConnection } from "mysql2/promise";

export type Database = Pick<Pool, "query" | "getConnection" | "end">;

export type TransactionConnection = Pick<
  PoolConnection,
  "query" | "beginTransaction" | "commit" | "rollback" | "release"
>;
