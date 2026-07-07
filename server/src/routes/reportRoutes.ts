import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import { requireAnyPermission, requireAuth, requirePermission, type AuthenticatedRequest } from "../auth.js";
import { writeAuditLog } from "../audit.js";
import { db } from "../db.js";

type CallSearchRow = RowDataPacket & {
  id: string;
  record_number: string;
  phone_number: string;
  student_tc: string | null;
  student_name: string | null;
  interaction_type: string;
  category: string;
  priority: string;
  status: string;
  needs_follow_up: 0 | 1;
  follow_up_at: string | null;
  opened_by_user_id: string;
  opened_by_name: string;
  assigned_to_user_id: string | null;
  assigned_to_name: string | null;
  resolved_by_user_id: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

type SummaryRow = RowDataPacket & {
  total: number;
  open_total: number;
  resolved_total: number;
  follow_up_total: number;
  urgent_total: number;
};

type BreakdownRow = RowDataPacket & {
  label: string;
  total: number;
};

type ReportFilterOptionRow = RowDataPacket & {
  id: string;
  option_type: "issue_category" | "status" | "priority";
  label: string;
  value: string | null;
  sort_order: number;
};

export const reportRoutes = Router();

reportRoutes.use(requireAuth);

function hasPermission(req: AuthenticatedRequest, permission: string) {
  return req.user?.permissions.includes(permission) ?? false;
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeDate(value: unknown) {
  const text = normalizeText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function normalizePhone(value: unknown) {
  return normalizeText(value).replace(/\D/g, "");
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

function serializeSearchRow(req: AuthenticatedRequest, row: CallSearchRow) {
  const canViewSensitive = hasPermission(req, "sensitive.view_unmasked");

  return {
    id: row.id,
    recordNumber: row.record_number,
    phoneNumber: canViewSensitive ? row.phone_number : maskPhone(row.phone_number),
    studentTc: canViewSensitive ? row.student_tc : maskTc(row.student_tc),
    studentName: row.student_name,
    interactionType: row.interaction_type,
    category: row.category,
    priority: row.priority,
    status: row.status,
    needsFollowUp: row.needs_follow_up === 1,
    followUpAt: row.follow_up_at,
    openedByUserId: row.opened_by_user_id,
    openedByName: row.opened_by_name,
    assignedToUserId: row.assigned_to_user_id,
    assignedToName: row.assigned_to_name,
    resolvedByUserId: row.resolved_by_user_id,
    resolvedByName: row.resolved_by_name,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

reportRoutes.get(
  "/reports/filters",
  requireAnyPermission(["reports.view", "reports.export"]),
  async (_req, res) => {
    const [rows] = await db.query<ReportFilterOptionRow[]>(
      `SELECT id, option_type, label, value, sort_order
      FROM call_form_options
      WHERE is_active = 1 AND option_type IN ('issue_category', 'status', 'priority')
      ORDER BY option_type ASC, sort_order ASC, label ASC`,
    );

    res.json({
      options: rows.map((row) => ({
        id: row.id,
        type: row.option_type,
        label: row.label,
        value: row.value ?? row.label,
        isActive: true,
        sortOrder: row.sort_order,
      })),
    });
  },
);

function buildSearchQuery(req: AuthenticatedRequest) {
  const params: Array<string | number> = [];
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

  const phone = normalizePhone(req.query.phoneNumber);
  const studentTc = normalizeText(req.query.studentTc);
  const studentName = normalizeText(req.query.studentName);
  const recordNumber = normalizeText(req.query.recordNumber);
  const category = normalizeText(req.query.category);
  const status = normalizeText(req.query.status);
  const priority = normalizeText(req.query.priority);
  const openedByUserId = normalizeText(req.query.openedByUserId);
  const assignedToUserId = normalizeText(req.query.assignedToUserId);
  const resolvedByUserId = normalizeText(req.query.resolvedByUserId);
  const dateFrom = normalizeDate(req.query.dateFrom);
  const dateTo = normalizeDate(req.query.dateTo);
  const followUpFrom = normalizeDate(req.query.followUpFrom);
  const followUpTo = normalizeDate(req.query.followUpTo);
  const slaStatus = normalizeText(req.query.slaStatus);

  if (phone) {
    conditions.push("REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(call_records.phone_number, ' ', ''), '+', ''), '-', ''), '(', ''), ')', '') LIKE ?");
    params.push(`%${phone}%`);
  }

  if (studentTc) {
    conditions.push("call_records.student_tc LIKE ?");
    params.push(`%${studentTc}%`);
  }

  if (studentName) {
    conditions.push("call_records.student_name LIKE ?");
    params.push(`%${studentName}%`);
  }

  if (recordNumber) {
    conditions.push("call_records.record_number LIKE ?");
    params.push(`%${recordNumber}%`);
  }

  if (category && category !== "all") {
    conditions.push("call_records.category = ?");
    params.push(category);
  }

  if (status && status !== "all") {
    conditions.push("call_records.status = ?");
    params.push(status);
  }

  if (priority && priority !== "all") {
    conditions.push("call_records.priority = ?");
    params.push(priority);
  }

  if (hasPermission(req, "calls.view.all")) {
    if (openedByUserId) {
      conditions.push("call_records.opened_by_user_id = ?");
      params.push(openedByUserId);
    }

    if (assignedToUserId) {
      conditions.push("call_records.assigned_to_user_id = ?");
      params.push(assignedToUserId);
    }

    if (resolvedByUserId) {
      conditions.push("call_records.resolved_by_user_id = ?");
      params.push(resolvedByUserId);
    }
  }

  if (dateFrom) {
    conditions.push("DATE(call_records.created_at) >= ?");
    params.push(dateFrom);
  }

  if (dateTo) {
    conditions.push("DATE(call_records.created_at) <= ?");
    params.push(dateTo);
  }

  if (followUpFrom) {
    conditions.push("DATE(call_records.follow_up_at) >= ?");
    params.push(followUpFrom);
  }

  if (followUpTo) {
    conditions.push("DATE(call_records.follow_up_at) <= ?");
    params.push(followUpTo);
  }

  if (slaStatus === "overdue") {
    conditions.push("call_records.follow_up_at IS NOT NULL AND call_records.follow_up_at < NOW() AND call_records.status NOT IN ('resolved', 'closed', 'archived', 'cancelled')");
  } else if (slaStatus === "resolved") {
    conditions.push("call_records.status IN ('resolved', 'closed')");
  } else if (slaStatus === "active") {
    conditions.push("call_records.status NOT IN ('resolved', 'closed', 'archived', 'cancelled')");
  }

  return {
    params,
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
  };
}

async function searchCalls(req: AuthenticatedRequest, limit = 200) {
  const { whereClause, params } = buildSearchQuery(req);
  const [rows] = await db.query<CallSearchRow[]>(
    `SELECT
      call_records.id,
      call_records.record_number,
      call_records.phone_number,
      call_records.student_tc,
      call_records.student_name,
      call_records.interaction_type,
      call_records.category,
      call_records.priority,
      call_records.status,
      call_records.needs_follow_up,
      call_records.follow_up_at,
      call_records.opened_by_user_id,
      opened_by.full_name AS opened_by_name,
      call_records.assigned_to_user_id,
      assigned_to.full_name AS assigned_to_name,
      call_records.resolved_by_user_id,
      resolved_by.full_name AS resolved_by_name,
      call_records.resolved_at,
      call_records.created_at,
      call_records.updated_at
    FROM call_records
    INNER JOIN users opened_by ON opened_by.id = call_records.opened_by_user_id
    LEFT JOIN users assigned_to ON assigned_to.id = call_records.assigned_to_user_id
    LEFT JOIN users resolved_by ON resolved_by.id = call_records.resolved_by_user_id
    ${whereClause}
    ORDER BY call_records.created_at DESC
    LIMIT ?`,
    [...params, limit],
  );

  return rows;
}

reportRoutes.get(
  "/calls/search",
  requireAnyPermission(["calls.view.own", "calls.view.all"]),
  async (req: AuthenticatedRequest, res) => {
    const rows = await searchCalls(req);

    res.json({ calls: rows.map((row) => serializeSearchRow(req, row)) });
  },
);

reportRoutes.get("/reports/summary", requirePermission("reports.view"), async (_req, res) => {
  const [[summaryRows], [statusRows], [priorityRows]] = await Promise.all([
    db.query<SummaryRow[]>(
      `SELECT
        COUNT(*) AS total,
        SUM(status NOT IN ('resolved', 'closed', 'archived', 'cancelled')) AS open_total,
        SUM(status IN ('resolved', 'closed')) AS resolved_total,
        SUM(needs_follow_up = 1 AND status NOT IN ('resolved', 'closed', 'archived', 'cancelled')) AS follow_up_total,
        SUM(priority = 'urgent') AS urgent_total
      FROM call_records`,
    ),
    db.query<BreakdownRow[]>(
      "SELECT status AS label, COUNT(*) AS total FROM call_records GROUP BY status ORDER BY total DESC",
    ),
    db.query<BreakdownRow[]>(
      "SELECT priority AS label, COUNT(*) AS total FROM call_records GROUP BY priority ORDER BY total DESC",
    ),
  ]);

  const summary = summaryRows[0] ?? {
    total: 0,
    open_total: 0,
    resolved_total: 0,
    follow_up_total: 0,
    urgent_total: 0,
  };

  res.json({
    summary: {
      total: Number(summary.total ?? 0),
      open: Number(summary.open_total ?? 0),
      resolved: Number(summary.resolved_total ?? 0),
      followUp: Number(summary.follow_up_total ?? 0),
      urgent: Number(summary.urgent_total ?? 0),
    },
    byStatus: statusRows,
    byPriority: priorityRows,
  });
});

reportRoutes.get("/reports/staff", requirePermission("reports.view"), async (_req, res) => {
  const [rows] = await db.query<Array<RowDataPacket & {
    user_id: string;
    full_name: string;
    opened_total: number;
    resolved_total: number;
  }>>(
    `SELECT
      users.id AS user_id,
      users.full_name,
      COUNT(call_records.id) AS opened_total,
      SUM(call_records.status IN ('resolved', 'closed')) AS resolved_total
    FROM users
    LEFT JOIN call_records ON call_records.opened_by_user_id = users.id
    GROUP BY users.id, users.full_name
    ORDER BY opened_total DESC, users.full_name ASC`,
  );

  res.json({
    staff: rows.map((row) => ({
      userId: row.user_id,
      fullName: row.full_name,
      openedTotal: Number(row.opened_total ?? 0),
      resolvedTotal: Number(row.resolved_total ?? 0),
    })),
  });
});

reportRoutes.get("/reports/categories", requirePermission("reports.view"), async (_req, res) => {
  const [rows] = await db.query<Array<RowDataPacket & {
    category: string;
    total: number;
    open_total: number;
    resolved_total: number;
  }>>(
    `SELECT
      category,
      COUNT(*) AS total,
      SUM(status NOT IN ('resolved', 'closed', 'archived', 'cancelled')) AS open_total,
      SUM(status IN ('resolved', 'closed')) AS resolved_total
    FROM call_records
    GROUP BY category
    ORDER BY total DESC`,
  );

  res.json({
    categories: rows.map((row) => ({
      category: row.category,
      total: Number(row.total ?? 0),
      openTotal: Number(row.open_total ?? 0),
      resolvedTotal: Number(row.resolved_total ?? 0),
    })),
  });
});

reportRoutes.get(
  "/reports/export",
  requirePermission("reports.export"),
  async (req: AuthenticatedRequest, res) => {
    const format = normalizeText(req.query.format) === "pdf" ? "pdf" : "excel";
    const rows = (await searchCalls(req, 1000)).map((row) => serializeSearchRow(req, row));
    const fileName = `cagri-raporu-${new Date().toISOString().slice(0, 10)}.${format === "pdf" ? "pdf" : "csv"}`;
    const content = format === "pdf" ? createPdf(rows) : Buffer.from(createCsv(rows), "utf8");

    await writeAuditLog({
      req,
      action: "reports.export",
      entityType: "report",
      metadata: { format, rowCount: rows.length },
    });

    res.json({
      fileName,
      mimeType: format === "pdf" ? "application/pdf" : "text/csv;charset=utf-8",
      content: content.toString("base64"),
    });
  },
);

function createCsv(rows: ReturnType<typeof serializeSearchRow>[]) {
  const headers = [
    "Kayit No",
    "Telefon",
    "TC",
    "Ogrenci",
    "Kategori",
    "Durum",
    "Oncelik",
    "Acan",
    "Atanan",
    "Cozum Yetkilisi",
    "Kayit Tarihi",
  ];
  const body = rows.map((row) => [
    row.recordNumber,
    row.phoneNumber,
    row.studentTc ?? "",
    row.studentName ?? "",
    row.category,
    row.status,
    row.priority,
    row.openedByName,
    row.assignedToName ?? "",
    row.resolvedByName ?? "",
    row.createdAt,
  ]);

  return [headers, ...body]
    .map((line) => line.map((value) => `"${String(value).replaceAll("\"", "\"\"")}"`).join(","))
    .join("\n");
}

function createPdf(rows: ReturnType<typeof serializeSearchRow>[]) {
  const lines = [
    "Call Center Cagri Raporu",
    `Olusturma: ${new Date().toLocaleString("tr-TR")}`,
    `Kayit sayisi: ${rows.length}`,
    "",
    ...rows.slice(0, 120).map((row) => `${row.recordNumber} | ${row.status} | ${row.category} | ${row.openedByName}`),
  ];
  const escapedText = lines
    .map((line, index) => `BT /F1 10 Tf 40 ${800 - index * 14} Td (${line.replace(/[()\\]/g, "\\$&")}) Tj ET`)
    .join("\n");
  const stream = Buffer.from(escapedText, "utf8");
  const chunks = [
    "%PDF-1.4\n",
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
    `5 0 obj << /Length ${stream.length} >> stream\n${stream.toString("utf8")}\nendstream endobj\n`,
    "xref\n0 6\n0000000000 65535 f \n",
    "trailer << /Root 1 0 R /Size 6 >>\nstartxref\n0\n%%EOF",
  ];

  return Buffer.from(chunks.join(""), "utf8");
}
