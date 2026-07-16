import type { Response } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { AuthenticatedRequest } from "../auth/types.js";
import {
  serializeCall,
  serializeEvent,
  serializeField,
  serializeNote,
  serializeOption,
  serializeUserOption,
} from "./call.mapper.js";
import {
  allowedNoteTypes,
  allowedOptionTypes,
  buildCallVisibilityScope,
  canViewCall,
  fieldAllowsEdit,
  fieldIsEnabled,
  getNoteAccess,
  hasPermission,
  isValidPhoneNumber,
  isValidTurkishIdentityNumber,
  nonEditableStatuses,
  requiredFieldError,
} from "./call.policy.js";
import type { CallRepository } from "./call.repository.js";
import {
  buildPhoneMatchFilter,
  createOptionValue,
  editableOptionalValue,
  generateRecordNumber as createRecordNumber,
  normalizeBoolean,
  normalizeOptionColor,
  normalizeOptionValue as normalizeStoredOptionValue,
  normalizeOptionalString,
  normalizePhoneForMatch,
  normalizeRequiredString,
} from "./call.service.js";
import type {
  AuditWriter,
  CallOptionRow,
  CallRow,
  ClientIpReader,
  Clock,
  EventRow,
  IdGenerator,
  NoteRow,
  NotificationPublisher,
  NotificationSettingsReader,
  UserOptionRow,
} from "./call.types.js";

export type CallControllerDependencies = {
  repository: CallRepository;
  auditWriter: AuditWriter;
  notificationPublisher: NotificationPublisher;
  notificationSettingsReader: NotificationSettingsReader;
  clientIpReader: ClientIpReader;
  idGenerator: IdGenerator;
  clock: Clock;
};

export function createCallController(dependencies: CallControllerDependencies) {
  const {
    repository,
    auditWriter: writeAuditLog,
    notificationPublisher: notifyUsersWithAnyPermission,
    notificationSettingsReader: readAppSetting,
    clientIpReader: getClientIp,
    idGenerator,
    clock,
  } = dependencies;
  const db = repository.database;
  const getFieldSettings = () => repository.getFieldSettings();
  const getCallById = (callId: string) => repository.getCallById(callId);
  const writeCallEvent = repository.writeCallEvent.bind(repository);
  const generateRecordNumber = () => createRecordNumber(clock, idGenerator);
  const normalizeOptionValue = (
    type: "priority" | "status",
    value: unknown,
    fallback: string,
  ) => normalizeStoredOptionValue(repository, type, value, fallback);

  async function getAssignableUser(userId: string) {
    const [rows] = await db.query<UserOptionRow[]>(
      `SELECT DISTINCT users.id, users.full_name, users.username
      FROM users
      INNER JOIN roles ON roles.id = users.role_id
      INNER JOIN role_permissions ON role_permissions.role_id = roles.id
      WHERE users.id = ?
        AND users.status = 'active'
        AND roles.is_active = 1
        AND role_permissions.permission_id IN ('calls.view.own', 'calls.view.all', 'calls.create')
      LIMIT 1`,
      [userId],
    );

    return rows[0] ?? null;
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

async function getCallOptions(_req: AuthenticatedRequest, res: Response) {
    const [rows] = await db.query<CallOptionRow[]>(
      `SELECT id, option_type, label, value, color, is_active, sort_order
      FROM call_form_options
      WHERE option_type <> 'issue_sub_category'
      ORDER BY option_type ASC, sort_order ASC, label ASC`,
    );
    const fields = await getFieldSettings();

    res.json({ options: rows.map(serializeOption), fields: fields.map(serializeField) });
}

async function createCallOption(req: AuthenticatedRequest, res: Response) {
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
    [idGenerator(), type, label, value, color, sortOrder],
  );
  await writeAuditLog({
    req,
    action: "call_option.create",
    entityType: "call_form_option",
    metadata: { type, label, value, color },
  });

  res.status(201).json({ ok: true });
}

async function bulkUpdateCallOptions(req: AuthenticatedRequest, res: Response) {
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
}

async function updateCallOption(req: AuthenticatedRequest, res: Response) {
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
}

async function getAssignees(_req: AuthenticatedRequest, res: Response) {
    const [rows] = await db.query<UserOptionRow[]>(
      `SELECT DISTINCT users.id, users.full_name, users.username
      FROM users
      INNER JOIN roles ON roles.id = users.role_id
      INNER JOIN role_permissions ON role_permissions.role_id = roles.id
      WHERE users.status = 'active'
        AND roles.is_active = 1
        AND role_permissions.permission_id IN ('calls.view.own', 'calls.view.all', 'calls.create')
      ORDER BY users.full_name ASC`,
    );

    res.json({
      users: rows.map(serializeUserOption),
    });
}

async function listCalls(req: AuthenticatedRequest, res: Response) {
    const { params, conditions } = buildCallVisibilityScope(req);

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
}

async function createCall(req: AuthenticatedRequest, res: Response) {
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
  const assignedToUserId = normalizeOptionalString(req.body.assignedToUserId);

  if (assignedToUserId && !hasPermission(req, "calls.assign")) {
    res.status(403).json({ message: "Çağrı ataması yapma yetkiniz yok." });
    return;
  }

  const assignedToUser = assignedToUserId
    ? await getAssignableUser(assignedToUserId)
    : null;

  if (assignedToUserId && !assignedToUser) {
    res.status(400).json({ message: "Seçilen kullanıcıya çağrı atanamaz." });
    return;
  }

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

  if (!isValidPhoneNumber(phoneNumber)) {
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

  const callId = idGenerator();
  const recordNumber = generateRecordNumber();
  const initialStatus = assignedToUser ? "transferred" : "open";

  await db.query(
    `INSERT INTO call_records
      (id, record_number, phone_number, student_tc, student_name, interaction_type, category,
       sub_category, issue, initial_note, priority, status, needs_follow_up, follow_up_at,
       opened_by_user_id, assigned_to_user_id, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      initialStatus,
      needsFollowUp ? 1 : 0,
      followUpAt,
      req.user?.id,
      assignedToUser?.id ?? null,
      getClientIp(req),
      req.header("user-agent") ?? null,
    ],
  );

  await writeCallEvent(req, callId, "call.created", "Yeni çağrı kaydı oluşturuldu.", {
    recordNumber,
    assignedToUserId: assignedToUser?.id ?? null,
    assignedToName: assignedToUser?.full_name ?? null,
  });

  if (assignedToUser) {
    await writeCallEvent(req, callId, "call.assigned", "Çağrı kaydı personele atandı.", {
      assignedToUserId: assignedToUser.id,
      assignedToName: assignedToUser.full_name,
    });
  }

  await writeAuditLog({
    req,
    action: "call.create",
    entityType: "call",
    entityId: callId,
    metadata: {
      recordNumber,
      warnings,
      assignedToUserId: assignedToUser?.id ?? null,
      assignedToName: assignedToUser?.full_name ?? null,
    },
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
}

async function matchCalls(req: AuthenticatedRequest, res: Response) {
    const phoneNumber = normalizePhoneForMatch(req.query.phoneNumber);
    const studentTc = normalizeRequiredString(req.query.studentTc);
    const fields = await getFieldSettings();

    const {
      params: visibilityParams,
      conditions: visibilityConditions,
    } = buildCallVisibilityScope(req);

    const baseWhere = visibilityConditions.length > 0 ? ` AND ${visibilityConditions.join(" AND ")}` : "";
    const matchSelect = `SELECT
        call_records.*,
        opened_by.full_name AS opened_by_name,
        assigned_to.full_name AS assigned_to_name,
        resolved_by.full_name AS resolved_by_name
      FROM call_records
      INNER JOIN users opened_by ON opened_by.id = call_records.opened_by_user_id
      LEFT JOIN users assigned_to ON assigned_to.id = call_records.assigned_to_user_id
      LEFT JOIN users resolved_by ON resolved_by.id = call_records.resolved_by_user_id`;

    let matches: CallRow[] = [];
    let matchedBy: "phone-and-tc" | "tc" | "phone" | null = null;

    const hasPhoneFilter = phoneNumber.length >= 7;
    const hasTcFilter = /^\d{11}$/.test(studentTc);

    const { conditions: phoneConditions, params: phoneParams } = buildPhoneMatchFilter(
      "call_records.phone_number",
      phoneNumber,
    );

    if (hasPhoneFilter && hasTcFilter) {
      const [rows] = await db.query<CallRow[]>(
        `${matchSelect}
        WHERE (${phoneConditions.join(" OR ")}) AND call_records.student_tc = ?${baseWhere}
        ORDER BY call_records.created_at DESC
        LIMIT 5`,
        [...phoneParams, studentTc, ...visibilityParams],
      );
      matches = rows;
      matchedBy = rows.length > 0 ? "phone-and-tc" : null;
    }

    if (matches.length === 0 && hasTcFilter) {
      const [rows] = await db.query<CallRow[]>(
        `${matchSelect}
        WHERE call_records.student_tc = ?${baseWhere}
        ORDER BY call_records.created_at DESC
        LIMIT 5`,
        [studentTc, ...visibilityParams],
      );
      matches = rows;
      matchedBy = rows.length > 0 ? "tc" : null;
    }

    if (matches.length === 0 && hasPhoneFilter) {
      const [rows] = await db.query<CallRow[]>(
        `${matchSelect}
        WHERE (${phoneConditions.join(" OR ")})${baseWhere}
        ORDER BY call_records.created_at DESC
        LIMIT 5`,
        [...phoneParams, ...visibilityParams],
      );
      matches = rows;
      matchedBy = rows.length > 0 ? "phone" : null;
    }

    res.json({
      matches: matches.map((call) => serializeCall(req, call, fields)),
      matchedBy,
    });
}

async function getCall(req: AuthenticatedRequest, res: Response) {
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
    notes: notes.map(serializeNote),
    events: events.map(serializeEvent),
  });
}

async function updateCall(req: AuthenticatedRequest, res: Response) {
  const call = await ensureCanViewCall(req, String(req.params.id ?? ""), res);

  if (!call) {
    return;
  }

  if (call.is_locked === 1) {
    res.status(400).json({ message: "Kilitli kayıt düzenlenemez." });
    return;
  }

  const fields = await getFieldSettings();
  const phoneNumber = editableOptionalValue(fields, req.body, "phoneNumber", req.body.phoneNumber, call.phone_number);
  const studentTc = editableOptionalValue(fields, req.body, "studentTc", req.body.studentTc, call.student_tc);
  const studentName = editableOptionalValue(fields, req.body, "studentName", req.body.studentName, call.student_name);
  const interactionType = editableOptionalValue(fields, req.body, "interactionType", req.body.interactionType, call.interaction_type);
  const category = editableOptionalValue(fields, req.body, "category", req.body.category, call.category);
  const issue = editableOptionalValue(fields, req.body, "issue", req.body.issue, call.issue);
  const initialNote = editableOptionalValue(fields, req.body, "initialNote", req.body.initialNote, call.initial_note);
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

  if (!isValidPhoneNumber(phoneNumber)) {
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
}

async function addNote(req: AuthenticatedRequest, res: Response) {
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
  const { isAssigned, canAddAsManager, canAddNote } = getNoteAccess(req, call);

  if (!content) {
    res.status(400).json({ message: "Not içeriği zorunludur." });
    return;
  }

  if (!canAddNote) {
    res.status(403).json({ message: "Bu kayda not ekleme yetkiniz yok." });
    return;
  }

  if (noteType === "assigned_personnel" && !isAssigned && !canAddAsManager) {
    res.status(403).json({ message: "Atanan personel notu için kayıt size atanmış olmalıdır." });
    return;
  }

  const noteId = idGenerator();
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
}

async function assignCall(req: AuthenticatedRequest, res: Response) {
  const call = await ensureCanViewCall(req, String(req.params.id ?? ""), res);

  if (!call) {
    return;
  }

  if (call.is_locked === 1) {
    res.status(400).json({ message: "Kilitli kayıt atanamaz." });
    return;
  }

  const assignedToUserId = normalizeOptionalString(req.body.assignedToUserId);
  const assignedToUser = assignedToUserId
    ? await getAssignableUser(assignedToUserId)
    : null;

  if (assignedToUserId && !assignedToUser) {
    res.status(400).json({ message: "Seçilen kullanıcıya çağrı atanamaz." });
    return;
  }

  await db.query(
    `UPDATE call_records
    SET assigned_to_user_id = ?,
      status = CASE
        WHEN ? IS NOT NULL AND status = 'open' THEN 'transferred'
        WHEN ? IS NULL AND status = 'transferred' THEN 'open'
        ELSE status
      END
    WHERE id = ?`,
    [assignedToUserId, assignedToUserId, assignedToUserId, call.id],
  );
  await writeCallEvent(
    req,
    call.id,
    "call.assigned",
    assignedToUser ? "Çağrı kaydı ataması güncellendi." : "Çağrı kaydı ataması kaldırıldı.",
    {
      previousAssignedToUserId: call.assigned_to_user_id,
      previousAssignedToName: call.assigned_to_name,
      assignedToUserId: assignedToUser?.id ?? null,
      assignedToName: assignedToUser?.full_name ?? null,
    },
  );
  await writeAuditLog({
    req,
    action: "call.assign",
    entityType: "call",
    entityId: call.id,
    metadata: {
      previousAssignedToUserId: call.assigned_to_user_id,
      previousAssignedToName: call.assigned_to_name,
      assignedToUserId: assignedToUser?.id ?? null,
      assignedToName: assignedToUser?.full_name ?? null,
    },
  });

  res.json({ ok: true });
}

async function updateCallStatus(req: AuthenticatedRequest, res: Response) {
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
}

async function resolveCall(req: AuthenticatedRequest, res: Response) {
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
    [idGenerator(), call.id, req.user?.id, resolutionDescription],
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
}

async function reopenCall(req: AuthenticatedRequest, res: Response) {
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
}

return {
  getCallOptions,
  createCallOption,
  bulkUpdateCallOptions,
  updateCallOption,
  getAssignees,
  listCalls,
  createCall,
  matchCalls,
  getCall,
  updateCall,
  addNote,
  assignCall,
  updateCallStatus,
  resolveCall,
  reopenCall,
};
}
