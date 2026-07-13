import { readAppConfig } from "./config/app-config.js";
import { createPool } from "./database/mysql.js";

export const db = createPool(readAppConfig().database);

export { createPool } from "./database/mysql.js";
export type { Database, TransactionConnection } from "./database/database.js";
