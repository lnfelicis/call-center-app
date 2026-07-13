import type { Connection, Pool } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../../src/database/database.js";
import { readSetupConfig, runSetup } from "../../../src/setup.js";

describe("setup orchestration", () => {
  it("preserves setup defaults", () => {
    const config = readSetupConfig({ DB_NAME: "app_test" });

    expect(config.databaseName).toBe("app_test");
    expect(config.databaseServer.port).toBe(3306);
    expect(config.superAdmin).toStrictEqual({
      username: "superadmin",
      fullName: "Süper Admin",
      email: "superadmin@example.com",
      password: "Admin12345!",
    });
  });

  it("rejects missing database name before schema work", async () => {
    const query = vi.fn();
    const createServerConnection = vi.fn();

    await expect(
      runSetup(readSetupConfig({}), {
        database: { query } as unknown as Database,
        createServerConnection,
        hashPassword: vi.fn(),
        generateId: vi.fn(),
        output: { log: vi.fn() },
      }),
    ).rejects.toThrow("DB_NAME .env içinde tanımlı olmalıdır.");

    expect(createServerConnection).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it("runs the existing schema and seed sequence without ending the injected pool", async () => {
    const databaseQuery = vi.fn().mockResolvedValue([{}, []]);
    const databaseEnd = vi.fn();
    const serverQuery = vi.fn().mockResolvedValue([{}, []]);
    const serverEnd = vi.fn().mockResolvedValue(undefined);
    const output = { log: vi.fn() };
    const database = {
      query: databaseQuery,
      end: databaseEnd,
    } as unknown as Pool;

    const admin = await runSetup(readSetupConfig({ DB_NAME: "app_test" }), {
      database,
      createServerConnection: vi.fn().mockResolvedValue({
        query: serverQuery,
        end: serverEnd,
      } as unknown as Connection),
      hashPassword: vi.fn().mockResolvedValue("hashed-password"),
      generateId: vi.fn().mockReturnValue("audit-id"),
      output,
    });

    expect(admin).toStrictEqual({
      username: "superadmin",
      email: "superadmin@example.com",
      password: "Admin12345!",
    });
    expect(serverQuery).toHaveBeenCalledWith(
      "CREATE DATABASE IF NOT EXISTS `app_test` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
    );
    expect(serverEnd).toHaveBeenCalledOnce();
    expect(databaseQuery).toHaveBeenCalled();
    expect(databaseEnd).not.toHaveBeenCalled();
    expect(output.log).toHaveBeenCalledTimes(5);
  });
});
