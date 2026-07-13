import { describe, expect, it } from "vitest";
import { readAppConfig } from "../../../src/config/app-config.js";

describe("readAppConfig", () => {
  it("preserves runtime defaults and coercion", () => {
    const config = readAppConfig({});

    expect(config.port).toBe(3000);
    expect(config.host).toBe("0.0.0.0");
    expect(config.trustProxy).toBe(false);
    expect(config.database.port).toBeNaN();
    expect(config.database.connectionLimit).toBe(10);
  });

  it("only treats the exact Render string as true", () => {
    expect(readAppConfig({ RENDER: "true" }).trustProxy).toBe(true);
    expect(readAppConfig({ RENDER: "TRUE" }).trustProxy).toBe(false);
    expect(readAppConfig({ RENDER: "1" }).trustProxy).toBe(false);
  });

  it("keeps Number(value) || 3000 port behavior", () => {
    expect(readAppConfig({ PORT: "4200" }).port).toBe(4200);
    expect(readAppConfig({ PORT: "0" }).port).toBe(3000);
    expect(readAppConfig({ PORT: "invalid" }).port).toBe(3000);
  });
});
