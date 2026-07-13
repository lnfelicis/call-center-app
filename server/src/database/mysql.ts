import mysql, { type Pool } from "mysql2/promise";
import type { DatabaseConfig } from "../config/app-config.js";

export function createPool(config: DatabaseConfig): Pool {
  return mysql.createPool(config);
}
