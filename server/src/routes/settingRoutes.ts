import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { requireAuth, requirePermission } from "../auth.js";
import { writeAuditLog } from "../audit.js";
import { db } from "../db.js";
import { readAppSetting, writeAppSetting } from "../settings.js";

type OptionType =
  | "interaction_type"
  | "issue_category"
  | "status"
  | "priority"
  | "resolution_category";

type OptionRow = RowDataPacket & {
  id: string;
  option_type: OptionType;
  label: string;
  value: string | null;
  is_active: 0 | 1;
  sort_order: number;
};

type FieldRow = RowDataPacket & {
  field_key: string;
  label: string;
  is_active: 0 | 1;
  is_required: 0 | 1;
  is_visible: 0 | 1;
  is_editable: 0 | 1;
  is_masked: 0 | 1;
  sort_order: number;
};

const allowedOptionTypes = [
  "interaction_type",
  "issue_category",
  "status",
  "priority",
  "resolution_category",
] satisfies OptionType[];

export const settingRoutes = Router();

settingRoutes.use(requireAuth);

function serializeOption(row: OptionRow) {
  return {
    id: row.id,
    type: row.option_type,
    label: row.label,
    value: row.value ?? row.label,
    isActive: row.is_active === 1,
    sortOrder: row.sort_order,
  };
}

function serializeField(row: FieldRow) {
  return {
    key: row.field_key,
    label: row.label,
    isActive: row.is_active === 1,
    isRequired: row.is_required === 1,
    isVisible: row.is_visible === 1,
    isEditable: row.is_editable === 1,
    isMasked: row.is_masked === 1,
    sortOrder: row.sort_order,
  };
}

function normalizeOptionType(value: unknown) {
  const type = String(value ?? "") as OptionType;
  return allowedOptionTypes.includes(type) ? type : null;
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function createSystemValue(label: string) {
  return label
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ı", "i")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function createOptionValue(type: OptionType, label: string) {
  if (type === "status" || type === "priority") {
    return createSystemValue(label) || label;
  }

  return label;
}

async function readSettings() {
  const [optionRows] = await db.query<OptionRow[]>(
    `SELECT id, option_type, label, value, is_active, sort_order
    FROM call_form_options
    WHERE option_type <> 'issue_sub_category'
    ORDER BY option_type ASC, sort_order ASC, label ASC`,
  );
  const [fieldRows] = await db.query<FieldRow[]>(
    `SELECT field_key, label, is_active, is_required, is_visible, is_editable, is_masked, sort_order
    FROM call_form_fields
    ORDER BY sort_order ASC, field_key ASC`,
  );

  return {
    options: optionRows.map(serializeOption),
    fields: fieldRows.map(serializeField),
  };
}

settingRoutes.get("/settings", requirePermission("settings.manage"), async (_req, res) => {
  res.json(await readSettings());
});

settingRoutes.get("/settings/security", requirePermission("settings.manage"), async (_req, res) => {
  res.json({
    security: await readAppSetting("security_settings"),
    notifications: await readAppSetting("notification_settings"),
    privacy: await readAppSetting("privacy_settings"),
  });
});

settingRoutes.patch("/settings/security", requirePermission("settings.manage"), async (req, res) => {
  const security = await writeAppSetting("security_settings", {
    sessionDurationMinutes: Math.max(15, Math.min(1440, Number(req.body.security?.sessionDurationMinutes) || 480)),
    failedLoginLimit: Math.max(1, Math.min(20, Number(req.body.security?.failedLoginLimit) || 5)),
    ipAllowlist: Array.isArray(req.body.security?.ipAllowlist)
      ? req.body.security.ipAllowlist.map((value: unknown) => normalizeText(value)).filter(Boolean)
      : [],
  });
  const notifications = await writeAppSetting("notification_settings", {
    panelEnabled: req.body.notifications?.panelEnabled !== false,
    emailEnabled: req.body.notifications?.emailEnabled === true,
    followUpReminderEnabled: req.body.notifications?.followUpReminderEnabled !== false,
    urgentNotificationEnabled: req.body.notifications?.urgentNotificationEnabled !== false,
    staleCallNotificationEnabled: req.body.notifications?.staleCallNotificationEnabled !== false,
    staleCallHours: Math.max(1, Math.min(720, Number(req.body.notifications?.staleCallHours) || 24)),
  });
  const privacy = await writeAppSetting("privacy_settings", {
    retentionDays: Math.max(30, Math.min(3650, Number(req.body.privacy?.retentionDays) || 1095)),
    archiveResolvedAfterDays: Math.max(1, Math.min(3650, Number(req.body.privacy?.archiveResolvedAfterDays) || 180)),
    anonymizeArchivedAfterDays: Math.max(1, Math.min(3650, Number(req.body.privacy?.anonymizeArchivedAfterDays) || 365)),
  });

  await writeAuditLog({
    req,
    action: "settings.security.update",
    entityType: "settings",
    metadata: { security, notifications, privacy },
  });

  res.json({ security, notifications, privacy });
});

settingRoutes.patch("/settings", requirePermission("settings.manage"), async (req, res) => {
  const fields = Array.isArray(req.body.fields) ? req.body.fields : [];
  const options = Array.isArray(req.body.options) ? req.body.options : [];

  if (fields.length === 0 && options.length === 0) {
    res.status(400).json({ message: "Kaydedilecek ayar bulunamadı." });
    return;
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    for (const field of fields) {
      const key = normalizeText(field.key);
      const label = normalizeText(field.label);

      if (!key || !label) {
        res.status(400).json({ message: "Form alanı ayarlarında geçersiz kayıt var." });
        return;
      }

      await connection.query(
        `UPDATE call_form_fields
        SET label = ?, is_active = ?, is_required = ?, is_visible = ?, is_editable = ?, is_masked = ?, sort_order = ?
        WHERE field_key = ?`,
        [
          label,
          field.isActive === true ? 1 : 0,
          field.isRequired === true ? 1 : 0,
          field.isVisible === true ? 1 : 0,
          field.isEditable === true ? 1 : 0,
          field.isMasked === true ? 1 : 0,
          Number(field.sortOrder) || 0,
          key,
        ],
      );
    }

    for (const option of options) {
      const type = normalizeOptionType(option.type);
      const label = normalizeText(option.label);
      const value = type ? normalizeText(option.value) || createOptionValue(type, label) : "";

      if (!option.id || !type || label.length < 2) {
        res.status(400).json({ message: "Seçenek ayarlarında geçersiz kayıt var." });
        return;
      }

      await connection.query(
        `UPDATE call_form_options
        SET label = ?, value = ?, is_active = ?, sort_order = ?
        WHERE id = ? AND option_type = ?`,
        [
          label,
          value,
          option.isActive === true ? 1 : 0,
          Number(option.sortOrder) || 0,
          String(option.id),
          type,
        ],
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  await writeAuditLog({
    req,
    action: "settings.update",
    entityType: "settings",
    metadata: { fieldCount: fields.length, optionCount: options.length },
  });

  res.json(await readSettings());
});

settingRoutes.get(
  "/settings/options/:type",
  requirePermission("settings.manage"),
  async (req, res) => {
    const type = normalizeOptionType(req.params.type);

    if (!type) {
      res.status(400).json({ message: "Geçersiz seçenek türü." });
      return;
    }

    const [rows] = await db.query<OptionRow[]>(
      `SELECT id, option_type, label, value, is_active, sort_order
      FROM call_form_options
      WHERE option_type = ?
      ORDER BY sort_order ASC, label ASC`,
      [type],
    );

    res.json({ options: rows.map(serializeOption) });
  },
);

settingRoutes.post(
  "/settings/options/:type",
  requirePermission("settings.manage"),
  async (req, res) => {
    const type = normalizeOptionType(req.params.type);
    const label = normalizeText(req.body.label);
    const value = type ? normalizeText(req.body.value) || createOptionValue(type, label) : "";
    const sortOrder = Number(req.body.sortOrder) || 0;

    if (!type) {
      res.status(400).json({ message: "Geçersiz seçenek türü." });
      return;
    }

    if (label.length < 2) {
      res.status(400).json({ message: "Seçenek adı en az 2 karakter olmalıdır." });
      return;
    }

    const optionId = randomUUID();
    await db.query(
      `INSERT INTO call_form_options (id, option_type, label, value, is_active, sort_order)
      VALUES (?, ?, ?, ?, 1, ?)`,
      [optionId, type, label, value, sortOrder],
    );
    await writeAuditLog({
      req,
      action: "settings.option.create",
      entityType: "call_form_option",
      entityId: optionId,
      metadata: { type, label, value },
    });

    res.status(201).json({ id: optionId });
  },
);

settingRoutes.patch(
  "/settings/options/:type/:id",
  requirePermission("settings.manage"),
  async (req, res) => {
    const type = normalizeOptionType(req.params.type);
    const optionId = String(req.params.id ?? "");
    const label = normalizeText(req.body.label);
    const value = type ? normalizeText(req.body.value) || createOptionValue(type, label) : "";

    if (!type) {
      res.status(400).json({ message: "Geçersiz seçenek türü." });
      return;
    }

    if (label.length < 2) {
      res.status(400).json({ message: "Seçenek adı en az 2 karakter olmalıdır." });
      return;
    }

    const [result] = await db.query<ResultSetHeader>(
      `UPDATE call_form_options
      SET label = ?, value = ?, is_active = ?, sort_order = ?
      WHERE id = ? AND option_type = ?`,
      [
        label,
        value,
        req.body.isActive === true ? 1 : 0,
        Number(req.body.sortOrder) || 0,
        optionId,
        type,
      ],
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ message: "Seçenek bulunamadı." });
      return;
    }

    await writeAuditLog({
      req,
      action: "settings.option.update",
      entityType: "call_form_option",
      entityId: optionId,
      metadata: { type, label, value },
    });

    res.json({ ok: true });
  },
);
