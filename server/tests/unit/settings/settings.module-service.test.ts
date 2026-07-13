import type { Request } from "express";
import { describe, expect, it, vi } from "vitest";
import type { SettingsRepository } from "../../../src/modules/settings/repository.js";
import { SettingsService } from "../../../src/modules/settings/service.js";
import type { FieldRow, OptionRow } from "../../../src/modules/settings/types.js";

function createService() {
  const repository = {
    readOptions: vi.fn().mockResolvedValue([]),
    readFields: vi.fn().mockResolvedValue([]),
    readOptionsByType: vi.fn().mockResolvedValue([]),
    createOption: vi.fn().mockResolvedValue(undefined),
    updateOption: vi.fn().mockResolvedValue(1),
    persist: vi.fn().mockResolvedValue(undefined),
  } as unknown as SettingsRepository;
  const audit = vi.fn().mockResolvedValue(undefined);
  const readSetting = vi.fn();
  const writeSetting = vi.fn(async (_key: string, value: unknown) => value);
  const service = new SettingsService({
    repository,
    readSetting: readSetting as never,
    writeSetting: writeSetting as never,
    audit,
    generateId: () => "option-id",
  });
  return { repository, service, audit, readSetting, writeSetting };
}

describe("SettingsService", () => {
  it("reads and serializes options before fields", async () => {
    const { repository, service } = createService();
    vi.mocked(repository.readOptions).mockResolvedValueOnce([
      {
        id: "status-id",
        option_type: "status",
        label: "Açık",
        value: null,
        color: "#2563eb",
        is_active: 1,
        sort_order: 1,
      } as OptionRow,
    ]);
    vi.mocked(repository.readFields).mockResolvedValueOnce([
      {
        field_key: "phone",
        label: "Telefon",
        is_active: 1,
        is_required: 0,
        is_visible: 1,
        is_editable: 1,
        is_masked: 0,
        sort_order: 2,
      } as FieldRow,
    ]);

    await expect(service.readSettings()).resolves.toStrictEqual({
      options: [
        {
          id: "status-id",
          type: "status",
          label: "Açık",
          value: "Açık",
          color: "#2563eb",
          isActive: true,
          sortOrder: 1,
        },
      ],
      fields: [
        {
          key: "phone",
          label: "Telefon",
          isActive: true,
          isRequired: false,
          isVisible: true,
          isEditable: true,
          isMasked: false,
          sortOrder: 2,
        },
      ],
    });
    expect(vi.mocked(repository.readOptions).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(repository.readFields).mock.invocationCallOrder[0]!,
    );
  });

  it("reads security, notification, and privacy settings in response order", async () => {
    const { service, readSetting } = createService();
    readSetting
      .mockResolvedValueOnce({ sessionDurationMinutes: 60 })
      .mockResolvedValueOnce({ panelEnabled: false })
      .mockResolvedValueOnce({ retentionDays: 30 });

    await expect(service.readSecuritySettings()).resolves.toStrictEqual({
      security: { sessionDurationMinutes: 60 },
      notifications: { panelEnabled: false },
      privacy: { retentionDays: 30 },
    });
    expect(readSetting.mock.calls.map(([key]) => key)).toStrictEqual([
      "security_settings",
      "notification_settings",
      "privacy_settings",
    ]);
  });

  it("normalizes and clamps every security-settings section before auditing", async () => {
    const { service, writeSetting, audit } = createService();
    const req = {
      body: {
        security: {
          sessionDurationMinutes: -1,
          failedLoginLimit: 99,
          ipAllowlist: [" 127.0.0.1 ", "", null],
        },
        notifications: {
          panelEnabled: false,
          emailEnabled: true,
          followUpReminderEnabled: false,
          urgentNotificationEnabled: false,
          staleCallNotificationEnabled: false,
          staleCallHours: 999,
        },
        privacy: {
          retentionDays: 1,
          archiveResolvedAfterDays: 9999,
          anonymizeArchivedAfterDays: -1,
        },
      },
    } as Request;

    const result = await service.updateSecuritySettings(req);

    expect(writeSetting).toHaveBeenNthCalledWith(1, "security_settings", {
      sessionDurationMinutes: 15,
      failedLoginLimit: 20,
      ipAllowlist: ["127.0.0.1"],
    });
    expect(writeSetting).toHaveBeenNthCalledWith(2, "notification_settings", {
      panelEnabled: false,
      emailEnabled: true,
      followUpReminderEnabled: false,
      urgentNotificationEnabled: false,
      staleCallNotificationEnabled: false,
      staleCallHours: 720,
    });
    expect(writeSetting).toHaveBeenNthCalledWith(3, "privacy_settings", {
      retentionDays: 30,
      archiveResolvedAfterDays: 3650,
      anonymizeArchivedAfterDays: 1,
    });
    expect(result).toStrictEqual({
      security: {
        sessionDurationMinutes: 15,
        failedLoginLimit: 20,
        ipAllowlist: ["127.0.0.1"],
      },
      notifications: {
        panelEnabled: false,
        emailEnabled: true,
        followUpReminderEnabled: false,
        urgentNotificationEnabled: false,
        staleCallNotificationEnabled: false,
        staleCallHours: 720,
      },
      privacy: {
        retentionDays: 30,
        archiveResolvedAfterDays: 3650,
        anonymizeArchivedAfterDays: 1,
      },
    });
    expect(audit).toHaveBeenCalledWith({
      req,
      action: "settings.security.update",
      entityType: "settings",
      metadata: result,
    });
    expect(writeSetting.mock.invocationCallOrder[2]).toBeLessThan(
      audit.mock.invocationCallOrder[0]!,
    );
  });

  it("keeps all security-setting defaults for omitted request sections", async () => {
    const { service, writeSetting } = createService();

    await service.updateSecuritySettings({ body: {} } as Request);

    expect(writeSetting).toHaveBeenNthCalledWith(1, "security_settings", {
      sessionDurationMinutes: 480,
      failedLoginLimit: 5,
      ipAllowlist: [],
    });
    expect(writeSetting).toHaveBeenNthCalledWith(2, "notification_settings", {
      panelEnabled: true,
      emailEnabled: false,
      followUpReminderEnabled: true,
      urgentNotificationEnabled: true,
      staleCallNotificationEnabled: true,
      staleCallHours: 24,
    });
    expect(writeSetting).toHaveBeenNthCalledWith(3, "privacy_settings", {
      retentionDays: 1095,
      archiveResolvedAfterDays: 180,
      anonymizeArchivedAfterDays: 365,
    });
  });

  it("returns the exact empty-update validation without persistence", async () => {
    const { repository, service, audit } = createService();

    await expect(
      service.updateSettings({ body: { fields: {}, options: "invalid" } } as Request),
    ).resolves.toStrictEqual({
      status: 400,
      body: { message: "Kaydedilecek ayar bulunamadı." },
    });
    expect(repository.persist).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("does not open repository transaction work for invalid settings", async () => {
    const { repository, service, audit } = createService();
    const req = {
      body: { fields: [{ key: "", label: "" }], options: [] },
    } as Request;

    const result = await service.updateSettings(req);

    expect(result).toStrictEqual({
      status: 400,
      body: { message: "Form alanı ayarlarında geçersiz kayıt var." },
    });
    expect(repository.persist).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("keeps persistence, audit, then response-read ordering", async () => {
    const { repository, service, audit } = createService();
    const req = {
      body: {
        fields: [{ key: "phone", label: "Telefon" }],
        options: [],
      },
    } as Request;

    await service.updateSettings(req);

    expect(repository.persist).toHaveBeenCalledOnce();
    expect(audit).toHaveBeenCalledOnce();
    expect(vi.mocked(repository.persist).mock.invocationCallOrder[0]).toBeLessThan(
      audit.mock.invocationCallOrder[0]!,
    );
    expect(audit.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(repository.readOptions).mock.invocationCallOrder[0]!,
    );
  });

  it("does not audit or read a response when settings persistence fails", async () => {
    const { repository, service, audit } = createService();
    const failure = new Error("persist failed");
    vi.mocked(repository.persist).mockRejectedValueOnce(failure);

    await expect(
      service.updateSettings({
        body: { fields: [{ key: "phone", label: "Telefon" }], options: [] },
      } as Request),
    ).rejects.toBe(failure);

    expect(audit).not.toHaveBeenCalled();
    expect(repository.readOptions).not.toHaveBeenCalled();
    expect(repository.readFields).not.toHaveBeenCalled();
  });

  it("returns options for a valid type and rejects an unknown type", async () => {
    const { repository, service } = createService();
    vi.mocked(repository.readOptionsByType).mockResolvedValueOnce([
      {
        id: "option-id",
        option_type: "status",
        label: "Açık",
        value: "open",
        color: null,
        is_active: 0,
        sort_order: 2,
      } as OptionRow,
    ]);

    await expect(service.getOptions("issue_sub_category")).resolves.toStrictEqual({
      status: 400,
      body: { message: "Geçersiz seçenek türü." },
    });
    await expect(service.getOptions("status")).resolves.toStrictEqual({
      body: {
        options: [
          {
            id: "option-id",
            type: "status",
            label: "Açık",
            value: "open",
            color: null,
            isActive: false,
            sortOrder: 2,
          },
        ],
      },
    });
    expect(repository.readOptionsByType).toHaveBeenCalledOnce();
    expect(repository.readOptionsByType).toHaveBeenCalledWith("status");
  });

  it.each([
    [
      { params: { type: "invalid" }, body: { label: "Seçenek" } },
      "Geçersiz seçenek türü.",
    ],
    [
      { params: { type: "status" }, body: { label: "A" } },
      "Seçenek adı en az 2 karakter olmalıdır.",
    ],
    [
      { params: { type: "status" }, body: { label: "Açık", color: "blue" } },
      "Renk değeri #RRGGBB formatında olmalıdır.",
    ],
  ])("rejects invalid create-option input %#", async (request, message) => {
    const { repository, service, audit } = createService();

    await expect(service.createOption(request as unknown as Request)).resolves.toStrictEqual({
      status: 400,
      body: { message },
    });
    expect(repository.createOption).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("creates a normalized option before writing its exact audit record", async () => {
    const { repository, service, audit } = createService();
    const req = {
      params: { type: "priority" },
      body: { label: " Yüksek ", value: "", color: "#EA580C", sortOrder: "7" },
    } as unknown as Request;

    await expect(service.createOption(req)).resolves.toStrictEqual({
      status: 201,
      body: { id: "option-id" },
    });
    expect(repository.createOption).toHaveBeenCalledWith({
      id: "option-id",
      type: "priority",
      label: "Yüksek",
      value: "yuksek",
      color: "#ea580c",
      sortOrder: 7,
    });
    expect(audit).toHaveBeenCalledWith({
      req,
      action: "settings.option.create",
      entityType: "call_form_option",
      entityId: "option-id",
      metadata: {
        type: "priority",
        label: "Yüksek",
        value: "yuksek",
        color: "#ea580c",
      },
    });
    expect(vi.mocked(repository.createOption).mock.invocationCallOrder[0]).toBeLessThan(
      audit.mock.invocationCallOrder[0]!,
    );
  });

  it("does not audit when option creation persistence fails", async () => {
    const { repository, service, audit } = createService();
    const failure = new Error("insert failed");
    vi.mocked(repository.createOption).mockRejectedValueOnce(failure);

    await expect(
      service.createOption({
        params: { type: "issue_category" },
        body: { label: "Teknik", value: "custom", sortOrder: 0 },
      } as unknown as Request),
    ).rejects.toBe(failure);
    expect(audit).not.toHaveBeenCalled();
  });

  it.each([
    [
      { params: { type: "invalid", id: "id" }, body: { label: "Seçenek" } },
      "Geçersiz seçenek türü.",
    ],
    [
      { params: { type: "status", id: "id" }, body: { label: "A" } },
      "Seçenek adı en az 2 karakter olmalıdır.",
    ],
    [
      {
        params: { type: "status", id: "id" },
        body: { label: "Açık", color: "invalid" },
      },
      "Renk değeri #RRGGBB formatında olmalıdır.",
    ],
  ])("rejects invalid update-option input %#", async (request, message) => {
    const { repository, service, audit } = createService();

    await expect(service.updateOption(request as unknown as Request)).resolves.toStrictEqual({
      status: 400,
      body: { message },
    });
    expect(repository.updateOption).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("returns 404 without auditing when an option update affects no rows", async () => {
    const { repository, service, audit } = createService();
    vi.mocked(repository.updateOption).mockResolvedValueOnce(0);

    await expect(
      service.updateOption({
        params: { type: "status", id: undefined },
        body: { label: "Açık" },
      } as unknown as Request),
    ).resolves.toStrictEqual({
      status: 404,
      body: { message: "Seçenek bulunamadı." },
    });
    expect(repository.updateOption).toHaveBeenCalledWith({
      id: "",
      type: "status",
      label: "Açık",
      value: "acik",
      color: null,
      isActive: 0,
      sortOrder: 0,
    });
    expect(audit).not.toHaveBeenCalled();
  });

  it("updates an active option before writing its exact audit record", async () => {
    const { repository, service, audit } = createService();
    const req = {
      params: { type: "status", id: "status-id" },
      body: {
        label: " Devam Ediyor ",
        value: "in_progress",
        color: "#7C3AED",
        isActive: true,
        sortOrder: "9",
      },
    } as unknown as Request;

    await expect(service.updateOption(req)).resolves.toStrictEqual({ body: { ok: true } });
    expect(repository.updateOption).toHaveBeenCalledWith({
      id: "status-id",
      type: "status",
      label: "Devam Ediyor",
      value: "in_progress",
      color: "#7c3aed",
      isActive: 1,
      sortOrder: 9,
    });
    expect(audit).toHaveBeenCalledWith({
      req,
      action: "settings.option.update",
      entityType: "call_form_option",
      entityId: "status-id",
      metadata: {
        type: "status",
        label: "Devam Ediyor",
        value: "in_progress",
        color: "#7c3aed",
      },
    });
    expect(vi.mocked(repository.updateOption).mock.invocationCallOrder[0]).toBeLessThan(
      audit.mock.invocationCallOrder[0]!,
    );
  });
});
