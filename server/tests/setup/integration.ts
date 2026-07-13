import { config } from "dotenv";
import { resolve } from "node:path";

config({
  path: resolve(process.cwd(), ".env.test"),
  override: true,
  quiet: true,
});

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
