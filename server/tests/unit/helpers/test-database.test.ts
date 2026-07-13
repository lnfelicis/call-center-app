import { describe, expect, it } from "vitest";
import {
  assertSafeTestDatabaseName,
  hasTestDatabaseConfig,
} from "../../helpers/test-database.js";

describe("test database safety guard", () => {
  it("accepts only names ending in _test", () => {
    expect(assertSafeTestDatabaseName("call_center_app_test")).toBe("call_center_app_test");
    expect(() => assertSafeTestDatabaseName("call_center_app")).toThrow("must end with _test");
    expect(() => assertSafeTestDatabaseName(undefined)).toThrow("must end with _test");
  });

  it("requires host, user, and a safe database name", () => {
    expect(
      hasTestDatabaseConfig({ DB_HOST: "localhost", DB_USER: "root", DB_NAME: "app_test" }),
    ).toBe(true);
    expect(hasTestDatabaseConfig({ DB_HOST: "localhost", DB_USER: "root", DB_NAME: "app" })).toBe(
      false,
    );
  });
});
