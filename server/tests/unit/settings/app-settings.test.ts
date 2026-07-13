import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../../src/database/database.js";
import { AppSettingsRepository } from "../../../src/modules/settings/app-settings.repository.js";
import { AppSettingsService } from "../../../src/modules/settings/app-settings.service.js";

function createService(rawValue: unknown) {
  const repository = {
    readRaw: vi.fn().mockResolvedValue(rawValue),
    writeRaw: vi.fn().mockResolvedValue(undefined),
  } as unknown as AppSettingsRepository;

  return { repository, service: new AppSettingsService(repository) };
}

describe("AppSettingsService", () => {
  it("merges a stored JSON string over the existing defaults", async () => {
    const { service } = createService('{"failedLoginLimit":9}');

    await expect(service.read("security_settings")).resolves.toStrictEqual({
      sessionDurationMinutes: 480,
      failedLoginLimit: 9,
      ipAllowlist: [],
    });
  });

  it("falls back to defaults for missing and parsed-null values", async () => {
    const missing = createService(undefined).service;
    const parsedNull = createService("null").service;

    await expect(missing.read("security_settings")).resolves.toStrictEqual({
      sessionDurationMinutes: 480,
      failedLoginLimit: 5,
      ipAllowlist: [],
    });
    await expect(parsedNull.read("privacy_settings")).resolves.toStrictEqual({
      retentionDays: 1095,
      archiveResolvedAfterDays: 180,
      anonymizeArchivedAfterDays: 365,
    });
  });

  it("keeps object values and ignores primitive values", async () => {
    const objectService = createService({ panelEnabled: false }).service;
    const primitiveService = createService(42).service;

    expect(await objectService.read("notification_settings")).toMatchObject({ panelEnabled: false });
    expect(await primitiveService.read("notification_settings")).toMatchObject({
      panelEnabled: true,
      emailEnabled: false,
    });
  });

  it("continues to propagate malformed stored JSON", async () => {
    const { service } = createService("{invalid");

    await expect(service.read("security_settings")).rejects.toBeInstanceOf(SyntaxError);
  });

  it("writes defaults merged with only the supplied value", async () => {
    const { repository, service } = createService(undefined);

    const result = await service.write("privacy_settings", { retentionDays: 30 });

    expect(result).toStrictEqual({
      retentionDays: 30,
      archiveResolvedAfterDays: 180,
      anonymizeArchivedAfterDays: 365,
    });
    expect(repository.writeRaw).toHaveBeenCalledWith(
      "privacy_settings",
      JSON.stringify(result),
    );
  });
});

describe("AppSettingsRepository", () => {
  it("reads the raw JSON column with the exact key parameter", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([[{ setting_value: '{"failedLoginLimit":8}' }], []])
      .mockResolvedValueOnce([[], []]);
    const repository = new AppSettingsRepository({ query } as unknown as Database);

    await expect(repository.readRaw("security_settings")).resolves.toBe(
      '{"failedLoginLimit":8}',
    );
    await expect(repository.readRaw("privacy_settings")).resolves.toBeUndefined();

    expect(query).toHaveBeenNthCalledWith(
      1,
      "SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1",
      ["security_settings"],
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      "SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1",
      ["privacy_settings"],
    );
  });

  it("upserts serialized settings without changing SQL parameter order", async () => {
    const query = vi.fn().mockResolvedValue([{}, []]);
    const repository = new AppSettingsRepository({ query } as unknown as Database);

    await repository.writeRaw("notification_settings", '{"panelEnabled":false}');

    expect(String(query.mock.calls[0]?.[0]).replace(/\s+/g, " ").trim()).toBe(
      "INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
    );
    expect(query.mock.calls[0]?.[1]).toStrictEqual([
      "notification_settings",
      '{"panelEnabled":false}',
    ]);
  });
});
