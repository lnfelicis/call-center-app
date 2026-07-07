import { randomUUID } from "node:crypto";
import type { Response } from "express";
import { Router } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import {
  requireAnyPermission,
  requireAuth,
  requirePermission,
  type AuthenticatedRequest,
} from "../auth.js";
import { writeAuditLog } from "../audit.js";
import { db } from "../db.js";
import { notifyUsersWithAnyPermission } from "../notifications.js";
import { readAppSetting } from "../settings.js";

type CallRow = RowDataPacket & {
  id: string;
  record_number: string;
  phone_number: string;
  student_tc: string | null;
  student_name: string | null;
  interaction_type: string;
  category: string;
  sub_category: string | null;
  issue: string;
  initial_note: string | null;
  priority: CallPriority;
  status: CallStatus;
  needs_follow_up: 0 | 1;
  follow_up_at: string | null;
  opened_by_user_id: string;
  opened_by_name: string;
  assigned_to_user_id: string | null;
  assigned_to_name: string | null;
  resolved_by_user_id: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  resolution_description: string | null;
  resolution_category: string | null;
  is_locked: 0 | 1;
  created_at: string;
  updated_at: string;
};

type NoteRow = RowDataPacket & {
  id: string;
  call_id: string;
  author_user_id: string;
  author_name: string;
  note_type: string;
  content: string;
  created_at: string;
};

type EventRow = RowDataPacket & {
  id: string;
  call_id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  event_type: string;
  description: string;
  metadata: unknown;
  created_at: string;
};

type UserOptionRow = RowDataPacket & {
  id: string;
  full_name: string;
  username: string;
};

type CallOptionRow = RowDataPacket & {
  id: string;
  option_type: CallOptionType;
  label: string;
  value: string | null;
  color: string | null;
  is_active: 0 | 1;
  sort_order: number;
};

type CallFormFieldRow = RowDataPacket & {
  field_key: string;
  label: string;
  is_active: 0 | 1;
  is_required: 0 | 1;
  is_visible: 0 | 1;
  is_editable: 0 | 1;
  is_masked: 0 | 1;
  sort_order: number;
};

type CallOptionType =
  | "interaction_type"
  | "issue_category"
  | "issue_sub_category"
  | "status"
  | "priority"
  | "resolution_category";

type CallPriority = string;
type CallStatus = string;

const nonEditableStatuses = ["resolved"] satisfies string[];
const allowedNoteTypes = ["personnel", "follow_up", "assigned_personnel", "internal", "manager"];
const allowedOptionTypes = [
  "interaction_type",
  "issue_category",
  "status",
  "priority",
  "resolution_category",
];

export const callRoutes = Router();

callRoutes.use(requireAuth);

function serializeOption(row: CallOptionRow) {
  return {
    id: row.id,
    type: row.option_type,
    label: row.label,
    value: row.value ?? row.label,
    color: row.color,
    isActive: row.is_active === 1,
    sortOrder: row.sort_order,
  };
}

function serializeField(row: CallFormFieldRow) {
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

function hasPermission(req: AuthenticatedRequest, permission: string) {
  return req.user?.permissions.includes(permission) ?? false;
}

function maskPhone(phone: string) {
  if (phone.length < 6) {
    return "***";
  }

  return `${phone.slice(0, 4)} *** ** ${phone.slice(-2)}`;
}

function maskTc(tc: string | null) {
  if (!tc) {
    return null;
  }

  return `${tc.slice(0, 3)}******${tc.slice(-2)}`;
}

function canViewCall(req: AuthenticatedRequest, call: CallRow) {
  if (hasPermission(req, "calls.view.all")) {
    return true;
  }

  if (hasPermission(req, "calls.view.own") && call.opened_by_user_id === req.user?.id) {
    return true;
  }

  return call.assigned_to_user_id === req.user?.id;
}

async function getFieldSettings() {
  const [rows] = await db.query<CallFormFieldRow[]>(
    `SELECT field_key, label, is_active, is_required, is_visible, is_editable, is_masked, sort_order
    FROM call_form_fields
    ORDER BY sort_order ASC, field_key ASC`,
  );

  return rows;
}

function getFieldSetting(fields: CallFormFieldRow[], key: string) {
  return fields.find((field) => field.field_key === key);
}

function fieldRequiresValue(fields: CallFormFieldRow[], key: string) {
  const field = getFieldSetting(fields, key);

  if (!field) {
    return false;
  }

  return field.is_active === 1 && field.is_visible === 1 && field.is_required === 1;
}

function fieldIsEnabled(fields: CallFormFieldRow[], key: string) {
  const field = getFieldSetting(fields, key);

  if (!field) {
    return true;
  }

  return field.is_active === 1 && field.is_visible === 1;
}

function fieldLabel(fields: CallFormFieldRow[], key: string) {
  return getFieldSetting(fields, key)?.label ?? key;
}

function requiredFieldError(fields: CallFormFieldRow[], values: Record<string, unknown>) {
  const requiredKeys = [
    "phoneNumber",
    "studentTc",
    "studentName",
    "interactionType",
    "category",
    "issue",
    "initialNote",
    "priority",
  ];

  for (const key of requiredKeys) {
    if (fieldRequiresValue(fields, key) && !String(values[key] ?? "").trim()) {
      return `${fieldLabel(fields, key)} zorunludur.`;
    }
  }

  return null;
}

function fieldAllowsEdit(fields: CallFormFieldRow[], key: string) {
  const field = getFieldSetting(fields, key);

  if (!field) {
    return true;
  }

  return field.is_active === 1 && field.is_visible === 1 && field.is_editable === 1;
}

function shouldMaskField(req: AuthenticatedRequest, fields: CallFormFieldRow[], key: string) {
  const field = getFieldSetting(fields, key);

  return field?.is_masked === 1 && !hasPermission(req, "sensitive.view_unmasked");
}

function serializeCall(req: AuthenticatedRequest, call: CallRow, fields: CallFormFieldRow[] = []) {
  const canViewSensitive = hasPermission(req, "sensitive.view_unmasked");
  const maskPhoneNumber = !canViewSensitive && shouldMaskField(req, fields, "phoneNumber");
  const maskStudentTc = !canViewSensitive && shouldMaskField(req, fields, "studentTc");

  return {
    id: call.id,
    recordNumber: call.record_number,
    phoneNumber: maskPhoneNumber ? maskPhone(call.phone_number) : call.phone_number,
    studentTc: maskStudentTc ? maskTc(call.student_tc) : call.student_tc,
    studentName: call.student_name,
    interactionType: call.interaction_type,
    category: call.category,
    subCategory: call.sub_category,
    issue: call.issue,
    initialNote: call.initial_note,
    priority: call.priority,
    status: call.status,
    needsFollowUp: call.needs_follow_up === 1,
    followUpAt: call.follow_up_at,
    openedByUserId: call.opened_by_user_id,
    openedByName: call.opened_by_name,
    assignedToUserId: call.assigned_to_user_id,
    assignedToName: call.assigned_to_name,
    resolvedByUserId: call.resolved_by_user_id,
    resolvedByName: call.resolved_by_name,
    resolvedAt: call.resolved_at,
    resolutionDescription: call.resolution_description,
    resolutionCategory: call.resolution_category,
    isLocked: call.is_locked === 1,
    createdAt: call.created_at,
    updatedAt: call.updated_at,
  };
}

function generateRecordNumber() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const time = now.toTimeString().slice(0, 8).replaceAll(":", "");
  const suffix = randomUUID().slice(0, 6).toUpperCase();

  return `CAG-${date}-${time}-${suffix}`;
}

function normalizeOptionalString(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeRequiredString(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeOptionColor(type: string, value: unknown) {
  if (type !== "status" && type !== "priority") {
    return null;
  }

  const color = normalizeRequiredString(value);

  if (!color) {
    return null;
  }

  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : "";
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

function createOptionValue(type: string, label: string) {
  if (type === "status" || type === "priority") {
    return createSystemValue(label) || label;
  }

  return label;
}

function normalizePhoneForMatch(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

async function normalizeOptionValue(
  type: "priority" | "status",
  value: unknown,
  fallback: string,
) {
  const optionValue = normalizeRequiredString(value);

  if (!optionValue) {
    return fallback;
  }

  const [rows] = await db.query<Array<RowDataPacket & { value: string | null; label: string }>>(
    `SELECT value, label
    FROM call_form_options
    WHERE option_type = ? AND is_active = 1`,
    [type],
  );
  const allowedValues = rows.map((row) => row.value ?? row.label);

  return allowedValues.includes(optionValue) ? optionValue : fallback;
}

function normalizeBoolean(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function phoneMatchSqlExpression(columnName: string) {
  return `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${columnName}, ' ', ''), '+', ''), '-', ''), '(', ''), ')', '')`;
}

function isValidTurkishIdentityNumber(value: string) {
  if (!/^[1-9]\d{10}$/.test(value)) {
    return false;
  }

  const digits = value.split("").map(Number);
  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7];
  const tenthDigit = ((oddSum * 7 - evenSum) % 10 + 10) % 10;
  const eleventhDigit = digits.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10;

  return digits[9] === tenthDigit && digits[10] === eleventhDigit;
}

async function getCallById(callId: string) {
  const [rows] = await db.query<CallRow[]>(
    `SELECT
      call_records.*,
      opened_by.full_name AS opened_by_name,
      assigned_to.full_name AS assigned_to_name,
      resolved_by.full_name AS resolved_by_name
    FROM call_records
    INNER JOIN users opened_by ON opened_by.id = call_records.opened_by_user_id
    LEFT JOIN users assigned_to ON assigned_to.id = call_records.assigned_to_user_id
    LEFT JOIN users resolved_by ON resolved_by.id = call_records.resolved_by_user_id
    WHERE call_records.id = ?
    LIMIT 1`,
    [callId],
  );

  return rows[0] ?? null;
}

async function writeCallEvent(
  req: AuthenticatedRequest,
  callId: string,
  eventType: string,
  description: string,
  metadata: Record<string, unknown> = {},
) {
  await db.query(
    `INSERT INTO call_events
      (id, call_id, actor_user_id, event_type, description, metadata)
    VALUES (?, ?, ?, ?, ?, ?)`,
    [randomUUID(), callId, req.user?.id ?? null, eventType, description, JSON.stringify(metadata)],
  );
}

async function ensureCanViewCall(req: AuthenticatedRequest, callId: string, res: Response) {
  const call = await getCallById(callId);

  if (!call) {
    res.status(404).json({ message: "Çağrı kaydı bulunamadı." });
    return null;
  }

  if (!canViewCall(req, call)) {
    res.status(403).json({ message: "Bu çağrı kaydını görüntüleme yetkiniz yok." });
    return null;
  }

  return call;
}

callRoutes.get(
  "/call-options",
  requireAnyPermission(["calls.create", "calls.edit", "calls.resolve", "settings.manage"]),
  async (_req, res) => {
    const [rows] = await db.query<CallOptionRow[]>(
      `SELECT id, option_type, label, value, color, is_active, sort_order
      FROM call_form_options
      WHERE option_type <> 'issue_sub_category'
      ORDER BY option_type ASC, sort_order ASC, label ASC`,
    );
    const fields = await getFieldSettings();

    res.json({ options: rows.map(serializeOption), fields: fields.map(serializeField) });
  },
);

callRoutes.post("/call-options", requirePermission("settings.manage"), async (req, res) => {
  const type = String(req.body.type ?? "");
  const label = normalizeRequiredString(req.body.label);
  const value = normalizeOptionalString(req.body.value) ?? createOptionValue(type, label);
  const color = normalizeOptionColor(type, req.body.color);
  const sortOrder = Number(req.body.sortOrder) || 0;

  if (!allowedOptionTypes.includes(type)) {
    res.status(400).json({ message: "Geçersiz seçenek türü." });
    return;
  }

  if (label.length < 2) {
    res.status(400).json({ message: "Seçenek adı en az 2 karakter olmalıdır." });
    return;
  }

  if (color === "") {
    res.status(400).json({ message: "Renk değeri #RRGGBB formatında olmalıdır." });
    return;
  }

  await db.query(
    `INSERT INTO call_form_options (id, option_type, label, value, color, is_active, sort_order)
    VALUES (?, ?, ?, ?, ?, 1, ?)`,
    [randomUUID(), type, label, value, color, sortOrder],
  );
  await writeAuditLog({
    req,
    action: "call_option.create",
    entityType: "call_form_option",
    metadata: { type, label, value, color },
  });

  res.status(201).json({ ok: true });
});

callRoutes.patch("/call-options", requirePermission("settings.manage"), async (req, res) => {
  const options = Array.isArray(req.body.options) ? req.body.options : [];

  if (options.length === 0) {
    res.status(400).json({ message: "Kaydedilecek seçenek bulunamadı." });
    return;
  }

  for (const option of options) {
    const label = normalizeRequiredString(option.label);
    const type = String(option.type ?? "");
    const color = normalizeOptionColor(type, option.color);

    if (!option.id || !allowedOptionTypes.includes(type) || label.length < 2) {
      res.status(400).json({ message: "Seçenek listesinde geçersiz kayıt var." });
      return;
    }

    if (color === "") {
      res.status(400).json({ message: "Renk değeri #RRGGBB formatında olmalıdır." });
      return;
    }
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    for (const option of options) {
      const label = normalizeRequiredString(option.label);
      const type = String(option.type ?? "");
      const value = normalizeOptionalString(option.value) ?? createOptionValue(type, label);
      const color = normalizeOptionColor(type, option.color);

      await connection.query(
        `UPDATE call_form_options
        SET label = ?, value = ?, color = ?, is_active = ?, sort_order = ?
        WHERE id = ? AND option_type = ?`,
        [
          label,
          value,
          color,
          Boolean(option.isActive) ? 1 : 0,
          Number(option.sortOrder) || 0,
          String(option.id),
          String(option.type),
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
    action: "call_option.bulk_update",
    entityType: "call_form_option",
    metadata: { count: options.length },
  });

  res.json({ ok: true });
});

callRoutes.patch("/call-options/:id", requirePermission("settings.manage"), async (req, res) => {
  const optionId = String(req.params.id ?? "");
  const label = normalizeRequiredString(req.body.label);
  const type = String(req.body.type ?? "");
  const value = normalizeOptionalString(req.body.value) ?? createOptionValue(type, label);
  const color = normalizeOptionColor(type, req.body.color);
  const isActive = Boolean(req.body.isActive);
  const sortOrder = Number(req.body.sortOrder) || 0;

  if (label.length < 2) {
    res.status(400).json({ message: "Seçenek adı en az 2 karakter olmalıdır." });
    return;
  }

  if (color === "") {
    res.status(400).json({ message: "Renk değeri #RRGGBB formatında olmalıdır." });
    return;
  }

  const [result] = await db.query<ResultSetHeader>(
    `UPDATE call_form_options
    SET label = ?, value = ?, color = ?, is_active = ?, sort_order = ?
    WHERE id = ?`,
    [label, value, color, isActive ? 1 : 0, sortOrder, optionId],
  );

  if (result.affectedRows === 0) {
    res.status(404).json({ message: "Seçenek bulunamadı." });
    return;
  }

  await writeAuditLog({
    req,
    action: "call_option.update",
    entityType: "call_form_option",
    entityId: optionId,
    metadata: { label, value, color, isActive, sortOrder },
  });

  res.json({ ok: true });
});

callRoutes.get(
  "/calls/assignees",
  requireAnyPermission(["calls.assign", "calls.create"]),
  async (_req, res) => {
    const [rows] = await db.query<UserOptionRow[]>(
      `SELECT id, full_name, username
      FROM users
      WHERE status = 'active'
      ORDER BY full_name ASC`,
    );

    res.json({
      users: rows.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        username: row.username,
      })),
    });
  },
);

callRoutes.get(
  "/calls",
  requireAnyPermission(["calls.view.own", "calls.view.all", "calls.create"]),
  async (req: AuthenticatedRequest, res) => {
    const params: string[] = [];
    const conditions: string[] = [];

    if (!hasPermission(req, "calls.view.all")) {
      const scopedConditions: string[] = [];

      if (hasPermission(req, "calls.view.own")) {
        scopedConditions.push("call_records.opened_by_user_id = ?");
        params.push(req.user?.id ?? "");
      }

      scopedConditions.push("call_records.assigned_to_user_id = ?");
      params.push(req.user?.id ?? "");
      conditions.push(`(${scopedConditions.join(" OR ")})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const [rows] = await db.query<CallRow[]>(
      `SELECT
        call_records.*,
        opened_by.full_name AS opened_by_name,
        assigned_to.full_name AS assigned_to_name,
        resolved_by.full_name AS resolved_by_name
      FROM call_records
      INNER JOIN users opened_by ON opened_by.id = call_records.opened_by_user_id
      LEFT JOIN users assigned_to ON assigned_to.id = call_records.assigned_to_user_id
      LEFT JOIN users resolved_by ON resolved_by.id = call_records.resolved_by_user_id
      ${whereClause}
      ORDER BY call_records.created_at DESC
      LIMIT 200`,
      params,
    );

    const fields = await getFieldSettings();

    res.json({ calls: rows.map((call) => serializeCall(req, call, fields)) });
  },
);

callRoutes.post("/calls", requirePermission("calls.create"), async (req: AuthenticatedRequest, res) => {
  const phoneNumber = normalizeRequiredString(req.body.phoneNumber);
  const studentTc = normalizeOptionalString(req.body.studentTc);
  const studentName = normalizeOptionalString(req.body.studentName);
  const interactionType = normalizeRequiredString(req.body.interactionType);
  const category = normalizeRequiredString(req.body.category);
  const issue = normalizeRequiredString(req.body.issue);
  const initialNote = normalizeOptionalString(req.body.initialNote);
  const priority = await normalizeOptionValue("priority", req.body.priority, "normal");
  const needsFollowUp = normalizeBoolean(req.body.needsFollowUp);
  const followUpAt = needsFollowUp ? normalizeRequiredString(req.body.followUpAt) : null;
  const fields = await getFieldSettings();
  const requiredError = requiredFieldError(fields, {
    phoneNumber,
    studentTc,
    studentName,
    interactionType,
    category,
    issue,
    initialNote,
    priority,
  });

  if (requiredError) {
    res.status(400).json({ message: requiredError });
    return;
  }

  if (phoneNumber && !/^[0-9+\s()-]{7,20}$/.test(phoneNumber)) {
    res.status(400).json({ message: "Telefon numarası formatı geçerli değil." });
    return;
  }

  if (studentTc && !isValidTurkishIdentityNumber(studentTc)) {
    res.status(400).json({ message: "Geçerli bir TC Kimlik No girin." });
    return;
  }

  if (needsFollowUp && fieldIsEnabled(fields, "followUpAt") && !followUpAt) {
    res.status(400).json({ message: "Takip gerekiyorsa takip tarihi zorunludur." });
    return;
  }

  const warnings: string[] = [];

  if (phoneNumber) {
    const [recentPhoneRows] = await db.query<RowDataPacket[]>(
      `SELECT id FROM call_records
      WHERE phone_number = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      LIMIT 1`,
      [phoneNumber],
    );

    if (recentPhoneRows.length > 0) {
      warnings.push("Aynı telefon numarasıyla son 7 gün içinde kayıt var.");
    }
  }

  if (studentTc) {
    const [openTcRows] = await db.query<RowDataPacket[]>(
      `SELECT id FROM call_records
      WHERE student_tc = ? AND status NOT IN ('resolved', 'closed', 'archived', 'cancelled')
      LIMIT 1`,
      [studentTc],
    );

    if (openTcRows.length > 0) {
      warnings.push("Aynı TC ile açık kayıt var.");
    }
  }

  const callId = randomUUID();
  const recordNumber = generateRecordNumber();

  await db.query(
    `INSERT INTO call_records
      (id, record_number, phone_number, student_tc, student_name, interaction_type, category,
       sub_category, issue, initial_note, priority, status, needs_follow_up, follow_up_at,
       opened_by_user_id, assigned_to_user_id, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)`,
    [
      callId,
      recordNumber,
      phoneNumber,
      studentTc,
      studentName,
      interactionType,
      category,
      null,
      issue,
      initialNote,
      priority,
      needsFollowUp ? 1 : 0,
      followUpAt,
      req.user?.id,
      null,
      req.ip,
      req.header("user-agent") ?? null,
    ],
  );

  await writeCallEvent(req, callId, "call.created", "Yeni çağrı kaydı oluşturuldu.", {
    recordNumber,
  });
  await writeAuditLog({
    req,
    action: "call.create",
    entityType: "call",
    entityId: callId,
    metadata: { recordNumber, warnings },
  });

  const notificationSettings = await readAppSetting("notification_settings");

  if (priority === "urgent" && notificationSettings.urgentNotificationEnabled) {
    await notifyUsersWithAnyPermission(["calls.view.all", "calls.resolve"], {
      title: "Acil çağrı kaydı açıldı",
      message: `${recordNumber} numaralı çağrı acil öncelikle açıldı.`,
      type: "call.urgent",
      entityType: "call",
      entityId: callId,
      dedupeKey: `urgent-call:${callId}`,
    });
  }

  const call = await getCallById(callId);

  res.status(201).json({
    call: call ? serializeCall(req, call, fields) : null,
    warnings,
  });
});

callRoutes.get(
  "/calls/matches",
  requirePermission("calls.create"),
  async (req: AuthenticatedRequest, res) => {
    const phoneNumber = normalizePhoneForMatch(req.query.phoneNumber);
    const studentTc = normalizeRequiredString(req.query.studentTc);
    const fields = await getFieldSettings();

    const visibilityParams: string[] = [];
    const visibilityConditions: string[] = [];

    if (!hasPermission(req, "calls.view.all")) {
      const scopedConditions: string[] = [];

      if (hasPermission(req, "calls.view.own")) {
        scopedConditions.push("call_records.opened_by_user_id = ?");
        visibilityParams.push(req.user?.id ?? "");
      }

      scopedConditions.push("call_records.assigned_to_user_id = ?");
      visibilityParams.push(req.user?.id ?? "");
      visibilityConditions.push(`(${scopedConditions.join(" OR ")})`);
    }

    const baseWhere = visibilityConditions.length > 0 ? ` AND ${visibilityConditions.join(" AND ")}` : "";
    const phoneExpression = phoneMatchSqlExpression("call_records.phone_number");
    const matchSelect = `SELECT
        call_records.*,
        opened_by.full_name AS opened_by_name,
        assigned_to.full_name AS assigned_to_name,
        resolved_by.full_name AS resolved_by_name
      FROM call_records
      INNER JOIN users opened_by ON opened_by.id = call_records.opened_by_user_id
      LEFT JOIN users assigned_to ON assigned_to.id = call_records.assigned_to_user_id
      LEFT JOIN users resolved_by ON resolved_by.id = call_records.resolved_by_user_id`;

    let phoneMatches: CallRow[] = [];
    let tcMatches: CallRow[] = [];

    const hasPhoneFilter = phoneNumber.length >= 7;
    const hasTcFilter = /^\d{11}$/.test(studentTc);

    if (hasPhoneFilter) {
      const phoneConditions = [`${phoneExpression} = ?`];
      const phoneParams: string[] = [phoneNumber];

      if (phoneNumber.length >= 10) {
        phoneConditions.push(`RIGHT(${phoneExpression}, 10) = ?`);
        phoneParams.push(phoneNumber.slice(-10));
      }

      const [rows] = await db.query<CallRow[]>(
        `${matchSelect}
        WHERE (${phoneConditions.join(" OR ")})${baseWhere}
        ORDER BY call_records.created_at DESC
        LIMIT 5`,
        [...phoneParams, ...visibilityParams],
      );
      phoneMatches = rows;
    }

    if (hasTcFilter) {
      const [rows] = await db.query<CallRow[]>(
        `${matchSelect}
        WHERE call_records.student_tc = ?${baseWhere}
        ORDER BY call_records.created_at DESC
        LIMIT 5`,
        [studentTc, ...visibilityParams],
      );
      tcMatches = rows;
    }

    res.json({
      phoneMatches: phoneMatches.map((call) => serializeCall(req, call, fields)),
      tcMatches: tcMatches.map((call) => serializeCall(req, call, fields)),
    });
  },
);

callRoutes.get("/calls/:id", async (req: AuthenticatedRequest, res) => {
  const call = await ensureCanViewCall(req, String(req.params.id ?? ""), res);

  if (!call) {
    return;
  }

  const [notes] = await db.query<NoteRow[]>(
    `SELECT call_notes.*, users.full_name AS author_name
    FROM call_notes
    INNER JOIN users ON users.id = call_notes.author_user_id
    WHERE call_notes.call_id = ?
    ORDER BY call_notes.created_at ASC`,
    [call.id],
  );
  const [events] = await db.query<EventRow[]>(
    `SELECT call_events.*, users.full_name AS actor_name
    FROM call_events
    LEFT JOIN users ON users.id = call_events.actor_user_id
    WHERE call_events.call_id = ?
    ORDER BY call_events.created_at ASC`,
    [call.id],
  );

  const fields = await getFieldSettings();

  res.json({
    call: serializeCall(req, call, fields),
    notes: notes.map((note) => ({
      id: note.id,
      callId: note.call_id,
      authorUserId: note.author_user_id,
      authorName: note.author_name,
      noteType: note.note_type,
      content: note.content,
      createdAt: note.created_at,
    })),
    events: events.map((event) => ({
      id: event.id,
      callId: event.call_id,
      actorUserId: event.actor_user_id,
      actorName: event.actor_name,
      eventType: event.event_type,
      description: event.description,
      metadata: event.metadata,
      createdAt: event.created_at,
    })),
  });
});

callRoutes.patch("/calls/:id", requirePermission("calls.edit"), async (req: AuthenticatedRequest, res) => {
  const call = await ensureCanViewCall(req, String(req.params.id ?? ""), res);

  if (!call) {
    return;
  }

  if (call.is_locked === 1) {
    res.status(400).json({ message: "Kilitli kayıt düzenlenemez." });
    return;
  }

  const fields = await getFieldSettings();
  const editableValue = (fieldKey: string, value: unknown, fallback: string | null) =>
    fieldAllowsEdit(fields, fieldKey) && Object.hasOwn(req.body, fieldKey) ? normalizeOptionalString(value) : fallback;

  const phoneNumber = editableValue("phoneNumber", req.body.phoneNumber, call.phone_number);
  const studentTc = editableValue("studentTc", req.body.studentTc, call.student_tc);
  const studentName = editableValue("studentName", req.body.studentName, call.student_name);
  const interactionType = editableValue("interactionType", req.body.interactionType, call.interaction_type);
  const category = editableValue("category", req.body.category, call.category);
  const issue = editableValue("issue", req.body.issue, call.issue);
  const initialNote = editableValue("initialNote", req.body.initialNote, call.initial_note);
  const priority =
    fieldAllowsEdit(fields, "priority") && Object.hasOwn(req.body, "priority")
      ? await normalizeOptionValue("priority", req.body.priority, call.priority)
      : call.priority;
  const needsFollowUp = fieldAllowsEdit(fields, "needsFollowUp") && Object.hasOwn(req.body, "needsFollowUp")
    ? normalizeBoolean(req.body.needsFollowUp)
    : call.needs_follow_up === 1;
  const followUpAt = fieldAllowsEdit(fields, "followUpAt") && Object.hasOwn(req.body, "followUpAt")
    ? needsFollowUp
      ? normalizeRequiredString(req.body.followUpAt)
      : null
    : call.follow_up_at;
  const requiredError = requiredFieldError(fields, {
    phoneNumber,
    studentTc,
    studentName,
    interactionType,
    category,
    issue,
    initialNote,
    priority,
  });

  if (requiredError) {
    res.status(400).json({ message: requiredError });
    return;
  }

  if (phoneNumber && !/^[0-9+\s()-]{7,20}$/.test(phoneNumber)) {
    res.status(400).json({ message: "Telefon numarası formatı geçerli değil." });
    return;
  }

  if (studentTc && !isValidTurkishIdentityNumber(studentTc)) {
    res.status(400).json({ message: "Geçerli bir TC Kimlik No girin." });
    return;
  }

  if (needsFollowUp && fieldIsEnabled(fields, "followUpAt") && !followUpAt) {
    res.status(400).json({ message: "Takip gerekiyorsa takip tarihi zorunludur." });
    return;
  }

  await db.query(
    `UPDATE call_records
    SET phone_number = ?,
      student_tc = ?,
      student_name = ?,
      interaction_type = ?,
      category = ?,
      issue = ?,
      initial_note = ?,
      priority = ?,
      needs_follow_up = ?,
      follow_up_at = ?
    WHERE id = ?`,
    [
      phoneNumber,
      studentTc,
      studentName,
      interactionType,
      category,
      issue,
      initialNote,
      priority,
      needsFollowUp ? 1 : 0,
      followUpAt,
      call.id,
    ],
  );

  const updatedFields = [
    call.phone_number !== phoneNumber ? "phoneNumber" : null,
    call.student_tc !== studentTc ? "studentTc" : null,
    call.student_name !== studentName ? "studentName" : null,
    call.interaction_type !== interactionType ? "interactionType" : null,
    call.category !== category ? "category" : null,
    call.issue !== issue ? "issue" : null,
    call.initial_note !== initialNote ? "initialNote" : null,
    call.priority !== priority ? "priority" : null,
    (call.needs_follow_up === 1) !== needsFollowUp ? "needsFollowUp" : null,
    call.follow_up_at !== followUpAt ? "followUpAt" : null,
  ].filter(Boolean);

  await writeCallEvent(req, call.id, "call.updated", "Çağrı kaydı bilgileri güncellendi.", {
    updatedFields,
  });
  await writeAuditLog({
    req,
    action: "call.update",
    entityType: "call",
    entityId: call.id,
    metadata: { recordNumber: call.record_number, updatedFields },
  });

  const notificationSettings = await readAppSetting("notification_settings");

  if (priority === "urgent" && call.priority !== "urgent" && notificationSettings.urgentNotificationEnabled) {
    await notifyUsersWithAnyPermission(["calls.view.all", "calls.resolve"], {
      title: "Çağrı acil önceliğe alındı",
      message: `${call.record_number} numaralı çağrı acil önceliğe yükseltildi.`,
      type: "call.urgent",
      entityType: "call",
      entityId: call.id,
      dedupeKey: `urgent-call:${call.id}`,
    });
  }

  const updatedCall = await getCallById(call.id);

  res.json({ call: updatedCall ? serializeCall(req, updatedCall, fields) : null });
});

callRoutes.post("/calls/:id/notes", async (req: AuthenticatedRequest, res) => {
  const call = await ensureCanViewCall(req, String(req.params.id ?? ""), res);

  if (!call) {
    return;
  }

  if (call.is_locked === 1) {
    res.status(400).json({ message: "Kilitli kayda not eklenemez." });
    return;
  }

  const content = normalizeRequiredString(req.body.content);
  const noteType = allowedNoteTypes.includes(String(req.body.noteType))
    ? String(req.body.noteType)
    : "personnel";
  const isOwner = call.opened_by_user_id === req.user?.id;
  const isAssigned = call.assigned_to_user_id === req.user?.id;
  const canAddOwnNote = isOwner && hasPermission(req, "calls.note.own");
  const canAddAssignedNote = isAssigned && hasPermission(req, "calls.note.assigned");
  const canAddAsManager = hasPermission(req, "calls.edit");

  if (!content) {
    res.status(400).json({ message: "Not içeriği zorunludur." });
    return;
  }

  if (!canAddOwnNote && !canAddAssignedNote && !canAddAsManager) {
    res.status(403).json({ message: "Bu kayda not ekleme yetkiniz yok." });
    return;
  }

  if (noteType === "assigned_personnel" && !isAssigned && !canAddAsManager) {
    res.status(403).json({ message: "Atanan personel notu için kayıt size atanmış olmalıdır." });
    return;
  }

  const noteId = randomUUID();
  await db.query(
    `INSERT INTO call_notes (id, call_id, author_user_id, note_type, content)
    VALUES (?, ?, ?, ?, ?)`,
    [noteId, call.id, req.user?.id, noteType, content],
  );
  await writeCallEvent(req, call.id, "note.created", "Çağrı kaydına not eklendi.", {
    noteType,
  });
  await writeAuditLog({
    req,
    action: "call.note.create",
    entityType: "call",
    entityId: call.id,
    metadata: { noteType },
  });

  res.status(201).json({ id: noteId });
});

callRoutes.patch("/calls/:id/assign", requirePermission("calls.assign"), async (req: AuthenticatedRequest, res) => {
  const call = await ensureCanViewCall(req, String(req.params.id ?? ""), res);

  if (!call) {
    return;
  }

  if (call.is_locked === 1) {
    res.status(400).json({ message: "Kilitli kayıt atanamaz." });
    return;
  }

  const assignedToUserId = normalizeOptionalString(req.body.assignedToUserId);
  await db.query(
    `UPDATE call_records
    SET assigned_to_user_id = ?, status = IF(status = 'open', 'transferred', status)
    WHERE id = ?`,
    [assignedToUserId, call.id],
  );
  await writeCallEvent(req, call.id, "call.assigned", "Çağrı kaydı ataması güncellendi.", {
    assignedToUserId,
  });
  await writeAuditLog({
    req,
    action: "call.assign",
    entityType: "call",
    entityId: call.id,
    metadata: { assignedToUserId },
  });

  res.json({ ok: true });
});

callRoutes.patch("/calls/:id/status", requirePermission("calls.edit"), async (req: AuthenticatedRequest, res) => {
  const call = await ensureCanViewCall(req, String(req.params.id ?? ""), res);

  if (!call) {
    return;
  }

  if (call.is_locked === 1) {
    res.status(400).json({ message: "Kilitli kaydın durumu değiştirilemez." });
    return;
  }

  const status = await normalizeOptionValue("status", req.body.status, "");

  if (!status || nonEditableStatuses.includes(status)) {
    res.status(400).json({ message: "Geçersiz durum seçimi." });
    return;
  }

  await db.query("UPDATE call_records SET status = ? WHERE id = ?", [status, call.id]);
  await writeCallEvent(req, call.id, "call.status.changed", "Çağrı durumu güncellendi.", {
    status,
  });
  await writeAuditLog({
    req,
    action: "call.status.update",
    entityType: "call",
    entityId: call.id,
    metadata: { status },
  });

  res.json({ ok: true });
});

callRoutes.post("/calls/:id/resolve", requirePermission("calls.resolve"), async (req: AuthenticatedRequest, res) => {
  const call = await ensureCanViewCall(req, String(req.params.id ?? ""), res);

  if (!call) {
    return;
  }

  const resolutionDescription = normalizeRequiredString(req.body.resolutionDescription);
  const resolutionCategory = normalizeRequiredString(req.body.resolutionCategory);

  if (!resolutionDescription || !resolutionCategory) {
    res.status(400).json({ message: "Çözüm açıklaması ve çözüm kategorisi zorunludur." });
    return;
  }

  await db.query(
    `UPDATE call_records
    SET status = 'resolved',
      is_locked = 1,
      resolved_by_user_id = ?,
      resolved_at = NOW(),
      resolution_description = ?,
      resolution_category = ?
    WHERE id = ?`,
    [req.user?.id, resolutionDescription, resolutionCategory, call.id],
  );
  await db.query(
    `INSERT INTO call_notes (id, call_id, author_user_id, note_type, content)
    VALUES (?, ?, ?, 'resolution', ?)`,
    [randomUUID(), call.id, req.user?.id, resolutionDescription],
  );
  await writeCallEvent(req, call.id, "call.resolved", "Çağrı kaydı çözüldü yapıldı.", {
    resolutionCategory,
  });
  await writeAuditLog({
    req,
    action: "call.resolve",
    entityType: "call",
    entityId: call.id,
    metadata: { resolutionCategory },
  });

  res.json({ ok: true });
});

callRoutes.post("/calls/:id/reopen", requirePermission("calls.reopen"), async (req: AuthenticatedRequest, res) => {
  const call = await ensureCanViewCall(req, String(req.params.id ?? ""), res);

  if (!call) {
    return;
  }

  await db.query(
    `UPDATE call_records
    SET status = 'open',
      is_locked = 0,
      resolved_by_user_id = NULL,
      resolved_at = NULL
    WHERE id = ?`,
    [call.id],
  );
  await writeCallEvent(req, call.id, "call.reopened", "Çözülen çağrı kaydı yeniden açıldı.");
  await writeAuditLog({
    req,
    action: "call.reopen",
    entityType: "call",
    entityId: call.id,
  });

  res.json({ ok: true });
});
