import type { Request } from "express";
import type { AuditWriter } from "../audit/types.js";
import { serializeField, serializeOption } from "./mapper.js";
import {
  createOptionValue,
  normalizeColor,
  normalizeOptionType,
  normalizeText,
  prepareSettingsUpdate,
} from "./settings.policy.js";
import type { SettingsRepository } from "./repository.js";
import type { readAppSetting, writeAppSetting } from "../../settings.js";

export type SettingsServiceDependencies = {
  repository: SettingsRepository;
  readSetting: typeof readAppSetting;
  writeSetting: typeof writeAppSetting;
  audit: AuditWriter;
  generateId: () => string;
};

type ServiceResult = { status?: number; body: unknown };

export class SettingsService {
  constructor(private readonly dependencies: SettingsServiceDependencies) {}

  async readSettings() {
    const optionRows = await this.dependencies.repository.readOptions();
    const fieldRows = await this.dependencies.repository.readFields();

    return {
      options: optionRows.map(serializeOption),
      fields: fieldRows.map(serializeField),
    };
  }

  async readSecuritySettings() {
    return {
      security: await this.dependencies.readSetting("security_settings"),
      notifications: await this.dependencies.readSetting("notification_settings"),
      privacy: await this.dependencies.readSetting("privacy_settings"),
    };
  }

  async updateSecuritySettings(req: Request) {
    const security = await this.dependencies.writeSetting("security_settings", {
      sessionDurationMinutes: Math.max(
        15,
        Math.min(1440, Number(req.body.security?.sessionDurationMinutes) || 480),
      ),
      failedLoginLimit: Math.max(
        1,
        Math.min(20, Number(req.body.security?.failedLoginLimit) || 5),
      ),
      ipAllowlist: Array.isArray(req.body.security?.ipAllowlist)
        ? req.body.security.ipAllowlist
            .map((value: unknown) => normalizeText(value))
            .filter(Boolean)
        : [],
    });
    const notifications = await this.dependencies.writeSetting("notification_settings", {
      panelEnabled: req.body.notifications?.panelEnabled !== false,
      emailEnabled: req.body.notifications?.emailEnabled === true,
      followUpReminderEnabled: req.body.notifications?.followUpReminderEnabled !== false,
      urgentNotificationEnabled: req.body.notifications?.urgentNotificationEnabled !== false,
      staleCallNotificationEnabled:
        req.body.notifications?.staleCallNotificationEnabled !== false,
      staleCallHours: Math.max(
        1,
        Math.min(720, Number(req.body.notifications?.staleCallHours) || 24),
      ),
    });
    const privacy = await this.dependencies.writeSetting("privacy_settings", {
      retentionDays: Math.max(
        30,
        Math.min(3650, Number(req.body.privacy?.retentionDays) || 1095),
      ),
      archiveResolvedAfterDays: Math.max(
        1,
        Math.min(3650, Number(req.body.privacy?.archiveResolvedAfterDays) || 180),
      ),
      anonymizeArchivedAfterDays: Math.max(
        1,
        Math.min(3650, Number(req.body.privacy?.anonymizeArchivedAfterDays) || 365),
      ),
    });

    await this.dependencies.audit({
      req,
      action: "settings.security.update",
      entityType: "settings",
      metadata: { security, notifications, privacy },
    });

    return { security, notifications, privacy };
  }

  async updateSettings(req: Request): Promise<ServiceResult> {
    const fields = Array.isArray(req.body.fields) ? req.body.fields : [];
    const options = Array.isArray(req.body.options) ? req.body.options : [];

    if (fields.length === 0 && options.length === 0) {
      return { status: 400, body: { message: "Kaydedilecek ayar bulunamadı." } };
    }

    const preparedUpdate = prepareSettingsUpdate(fields, options);

    if ("error" in preparedUpdate) {
      return { status: 400, body: { message: preparedUpdate.error } };
    }

    await this.dependencies.repository.persist(preparedUpdate.value);
    await this.dependencies.audit({
      req,
      action: "settings.update",
      entityType: "settings",
      metadata: { fieldCount: fields.length, optionCount: options.length },
    });

    return { body: await this.readSettings() };
  }

  async getOptions(typeValue: unknown): Promise<ServiceResult> {
    const type = normalizeOptionType(typeValue);

    if (!type) {
      return { status: 400, body: { message: "Geçersiz seçenek türü." } };
    }

    const rows = await this.dependencies.repository.readOptionsByType(type);
    return { body: { options: rows.map(serializeOption) } };
  }

  async createOption(req: Request): Promise<ServiceResult> {
    const type = normalizeOptionType(req.params.type);
    const label = normalizeText(req.body.label);
    const value = type ? normalizeText(req.body.value) || createOptionValue(type, label) : "";
    const color = type ? normalizeColor(type, req.body.color) : null;
    const sortOrder = Number(req.body.sortOrder) || 0;

    if (!type) {
      return { status: 400, body: { message: "Geçersiz seçenek türü." } };
    }
    if (label.length < 2) {
      return { status: 400, body: { message: "Seçenek adı en az 2 karakter olmalıdır." } };
    }
    if (color === "") {
      return { status: 400, body: { message: "Renk değeri #RRGGBB formatında olmalıdır." } };
    }

    const optionId = this.dependencies.generateId();
    await this.dependencies.repository.createOption({
      id: optionId,
      type,
      label,
      value,
      color,
      sortOrder,
    });
    await this.dependencies.audit({
      req,
      action: "settings.option.create",
      entityType: "call_form_option",
      entityId: optionId,
      metadata: { type, label, value, color },
    });

    return { status: 201, body: { id: optionId } };
  }

  async updateOption(req: Request): Promise<ServiceResult> {
    const type = normalizeOptionType(req.params.type);
    const optionId = String(req.params.id ?? "");
    const label = normalizeText(req.body.label);
    const value = type ? normalizeText(req.body.value) || createOptionValue(type, label) : "";
    const color = type ? normalizeColor(type, req.body.color) : null;

    if (!type) {
      return { status: 400, body: { message: "Geçersiz seçenek türü." } };
    }
    if (label.length < 2) {
      return { status: 400, body: { message: "Seçenek adı en az 2 karakter olmalıdır." } };
    }
    if (color === "") {
      return { status: 400, body: { message: "Renk değeri #RRGGBB formatında olmalıdır." } };
    }

    const affectedRows = await this.dependencies.repository.updateOption({
      id: optionId,
      type,
      label,
      value,
      color,
      isActive: req.body.isActive === true ? 1 : 0,
      sortOrder: Number(req.body.sortOrder) || 0,
    });

    if (affectedRows === 0) {
      return { status: 404, body: { message: "Seçenek bulunamadı." } };
    }

    await this.dependencies.audit({
      req,
      action: "settings.option.update",
      entityType: "call_form_option",
      entityId: optionId,
      metadata: { type, label, value, color },
    });

    return { body: { ok: true } };
  }
}
