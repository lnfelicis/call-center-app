import ExcelJS from "exceljs";
import { Router } from "express";
import { existsSync } from "node:fs";
import type { RowDataPacket } from "mysql2";
import PDFDocument from "pdfkit";
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
  color: string | null;
  sort_order: number;
};

type ReportCall = ReturnType<typeof serializeSearchRow>;

type ExportColumn = {
  key: string;
  header: string;
  width: number;
  pdfWidth: number;
  value: (row: ReportCall, labels: ReportOptionLabelMap) => string;
};

type PdfFonts = {
  regular: string;
  bold: string;
};

type ReportOptionLabelMap = {
  priority: Map<string, string>;
  status: Map<string, string>;
};

const pdfRegularFont = "AppRegular";
const pdfBoldFont = "AppBold";
const windowsRegularFontPath = "C:/Windows/Fonts/arial.ttf";
const windowsBoldFontPath = "C:/Windows/Fonts/arialbd.ttf";

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
      `SELECT id, option_type, label, value, color, sort_order
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
        color: row.color,
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
    const labels = await getReportOptionLabelMap();
    const createdAt = new Date();
    const summary = createExportSummary(req, rows.length, createdAt, labels);
    const fileName = `cagri-raporu-${createdAt.toISOString().slice(0, 10)}.${format === "pdf" ? "pdf" : "xlsx"}`;
    const content = format === "pdf"
      ? await createPdf(rows, summary, labels)
      : await createExcel(rows, summary, labels);

    await writeAuditLog({
      req,
      action: "reports.export",
      entityType: "report",
      metadata: { format, rowCount: rows.length },
    });

    res.json({
      fileName,
      mimeType: format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      content: content.toString("base64"),
    });
  },
);

const exportColumns: ExportColumn[] = [
  {
    key: "recordNumber",
    header: "Kayıt No",
    width: 30,
    pdfWidth: 120,
    value: (row) => row.recordNumber,
  },
  {
    key: "phoneNumber",
    header: "Telefon",
    width: 18,
    pdfWidth: 58,
    value: (row) => row.phoneNumber,
  },
  {
    key: "studentTc",
    header: "TC",
    width: 16,
    pdfWidth: 54,
    value: (row) => row.studentTc ?? "",
  },
  {
    key: "studentName",
    header: "Öğrenci",
    width: 24,
    pdfWidth: 78,
    value: (row) => row.studentName ?? "",
  },
  {
    key: "category",
    header: "Kategori",
    width: 22,
    pdfWidth: 72,
    value: (row) => row.category,
  },
  {
    key: "status",
    header: "Durum",
    width: 16,
    pdfWidth: 50,
    value: (row, labels) => getOptionLabel(labels.status, row.status),
  },
  {
    key: "priority",
    header: "Öncelik",
    width: 14,
    pdfWidth: 42,
    value: (row, labels) => getOptionLabel(labels.priority, row.priority),
  },
  {
    key: "openedByName",
    header: "Açan",
    width: 22,
    pdfWidth: 68,
    value: (row) => row.openedByName,
  },
  {
    key: "resolvedByName",
    header: "Çözüm Yetkilisi",
    width: 22,
    pdfWidth: 70,
    value: (row) => row.resolvedByName ?? "",
  },
  {
    key: "createdAt",
    header: "Kayıt Tarihi",
    width: 22,
    pdfWidth: 60,
    value: (row) => formatDateTime(row.createdAt),
  },
];

async function getReportOptionLabelMap(): Promise<ReportOptionLabelMap> {
  const [rows] = await db.query<ReportFilterOptionRow[]>(
    `SELECT id, option_type, label, value, color, sort_order
    FROM call_form_options
    WHERE is_active = 1 AND option_type IN ('status', 'priority')
    ORDER BY option_type ASC, sort_order ASC, label ASC`,
  );
  const labels: ReportOptionLabelMap = {
    priority: new Map<string, string>(),
    status: new Map<string, string>(),
  };

  rows.forEach((row) => {
    if (row.option_type === "priority" || row.option_type === "status") {
      labels[row.option_type].set(row.value ?? row.label, row.label);
    }
  });

  return labels;
}

function getOptionLabel(labels: Map<string, string>, value: string) {
  return labels.get(value) ?? value;
}

function createExportSummary(
  req: AuthenticatedRequest,
  rowCount: number,
  createdAt: Date,
  labels: ReportOptionLabelMap,
) {
  const filters = [
    ["Telefon", normalizePhone(req.query.phoneNumber)],
    ["TC", normalizeText(req.query.studentTc)],
    ["Öğrenci", normalizeText(req.query.studentName)],
    ["Kayıt No", normalizeText(req.query.recordNumber)],
    ["Kategori", normalizeText(req.query.category)],
    ["Durum", getOptionLabel(labels.status, normalizeText(req.query.status))],
    ["Öncelik", getOptionLabel(labels.priority, normalizeText(req.query.priority))],
    ["Kaydı açan", normalizeText(req.query.openedByUserId)],
    ["Çözüm yetkilisi", normalizeText(req.query.resolvedByUserId)],
    ["Kayıt başlangıç", normalizeDate(req.query.dateFrom)],
    ["Kayıt bitiş", normalizeDate(req.query.dateTo)],
    ["Takip başlangıç", normalizeDate(req.query.followUpFrom)],
    ["Takip bitiş", normalizeDate(req.query.followUpTo)],
    ["SLA", normalizeText(req.query.slaStatus)],
  ]
    .filter(([, value]) => value && value !== "all")
    .map(([label, value]) => `${label}: ${value}`);

  return {
    title: "Call Center Çağrı Raporu",
    createdAt,
    rowCount,
    filters,
  };
}

async function createExcel(
  rows: ReportCall[],
  summary: ReturnType<typeof createExportSummary>,
  labels: ReportOptionLabelMap,
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Call Center App";
  workbook.created = summary.createdAt;

  const worksheet = workbook.addWorksheet("Çağrı Raporu", {
    views: [{ state: "frozen", ySplit: 7 }],
  });

  worksheet.columns = exportColumns.map((column) => ({
    key: column.key,
    width: column.width,
  }));

  worksheet.mergeCells(1, 1, 1, exportColumns.length);
  worksheet.getCell("A1").value = summary.title;
  worksheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  worksheet.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F4E79" },
  };
  worksheet.getCell("A1").alignment = { vertical: "middle" };
  worksheet.getRow(1).height = 24;

  worksheet.getCell("A3").value = "Oluşturma";
  worksheet.getCell("B3").value = formatDateTime(summary.createdAt);
  worksheet.getCell("A4").value = "Kayıt sayısı";
  worksheet.getCell("B4").value = summary.rowCount;
  worksheet.getCell("A5").value = "Aktif filtreler";
  worksheet.getCell("B5").value = summary.filters.length > 0 ? summary.filters.join(" | ") : "Yok";

  for (const cellAddress of ["A3", "A4", "A5"]) {
    worksheet.getCell(cellAddress).font = { bold: true };
  }

  const headerRow = worksheet.getRow(7);
  headerRow.values = exportColumns.map((column) => column.header);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.alignment = { vertical: "middle", wrapText: true };
  headerRow.height = 22;

  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2F5597" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFD9E2F3" } },
      left: { style: "thin", color: { argb: "FFD9E2F3" } },
      bottom: { style: "thin", color: { argb: "FFD9E2F3" } },
      right: { style: "thin", color: { argb: "FFD9E2F3" } },
    };
  });

  rows.forEach((row) => {
    const excelRow = worksheet.addRow(exportColumns.map((column) => column.value(row, labels)));
    excelRow.alignment = { vertical: "top", wrapText: false };
  });

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 7) {
      return;
    }

    row.eachCell((cell) => {
      cell.border = {
        bottom: { style: "hair", color: { argb: "FFE7E6E6" } },
      };
    });
  });

  worksheet.autoFilter = {
    from: { row: 7, column: 1 },
    to: { row: 7, column: exportColumns.length },
  };

  const content = await workbook.xlsx.writeBuffer();

  return Buffer.from(content);
}

async function createPdf(
  rows: ReportCall[],
  summary: ReturnType<typeof createExportSummary>,
  labels: ReportOptionLabelMap,
) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      bufferPages: true,
      layout: "landscape",
      margin: 28,
      size: "A4",
    });
    const chunks: Buffer[] = [];
    const fonts = registerPdfFonts(doc);

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    drawPdfHeader(doc, summary, fonts);
    drawPdfTableHeader(doc, fonts);

    rows.forEach((row, index) => {
      drawPdfRow(doc, row, index, fonts, labels);
    });

    drawPdfPageNumbers(doc, fonts);
    doc.end();
  });
}

function drawPdfHeader(
  doc: PDFKit.PDFDocument,
  summary: ReturnType<typeof createExportSummary>,
  fonts: PdfFonts,
) {
  doc
    .font(fonts.bold)
    .fontSize(16)
    .fillColor("#1f2937")
    .text(summary.title, { continued: false });

  doc.moveDown(0.35);
  doc
    .font(fonts.regular)
    .fontSize(9)
    .fillColor("#4b5563")
    .text(`Oluşturma: ${formatDateTime(summary.createdAt)}`)
    .text(`Kayıt sayısı: ${summary.rowCount}`)
    .text(`Aktif filtreler: ${summary.filters.length > 0 ? summary.filters.join(" | ") : "Yok"}`, {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
    });

  doc.moveDown(0.8);
}

function drawPdfTableHeader(doc: PDFKit.PDFDocument, fonts: PdfFonts) {
  const left = doc.page.margins.left;
  const y = doc.y;
  const height = 20;
  let x = left;

  doc.rect(left, y, getPdfTableWidth(), height).fill("#1f4e79");
  doc.font(fonts.bold).fontSize(7).fillColor("#ffffff");

  exportColumns.forEach((column) => {
    doc.text(column.header, x + 3, y + 6, {
      width: column.pdfWidth - 6,
      height: height - 6,
      lineBreak: false,
    });
    x += column.pdfWidth;
  });

  doc.y = y + height;
}

function drawPdfRow(
  doc: PDFKit.PDFDocument,
  row: ReportCall,
  index: number,
  fonts: PdfFonts,
  labels: ReportOptionLabelMap,
) {
  const rowHeight = 22;

  if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom - 20) {
    doc.addPage();
    drawPdfTableHeader(doc, fonts);
  }

  const left = doc.page.margins.left;
  const y = doc.y;
  let x = left;

  doc.rect(left, y, getPdfTableWidth(), rowHeight).fill(index % 2 === 0 ? "#ffffff" : "#f8fafc");
  doc.strokeColor("#e5e7eb").lineWidth(0.5).moveTo(left, y + rowHeight).lineTo(left + getPdfTableWidth(), y + rowHeight).stroke();
  doc.font(fonts.regular).fontSize(6.5).fillColor("#111827");

  exportColumns.forEach((column) => {
    const value = column.value(row, labels);
    const text = column.key === "recordNumber"
      ? value
      : truncateForPdf(doc, value, column.pdfWidth - 6);

    doc.text(text, x + 3, y + 6, {
      width: column.pdfWidth - 6,
      height: rowHeight - 8,
      lineBreak: false,
    });
    x += column.pdfWidth;
  });

  doc.y = y + rowHeight;
}

function drawPdfPageNumbers(doc: PDFKit.PDFDocument, fonts: PdfFonts) {
  const range = doc.bufferedPageRange();

  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    doc.font(fonts.regular).fontSize(8).fillColor("#6b7280").text(
      `Sayfa ${index + 1} / ${range.count}`,
      doc.page.margins.left,
      doc.page.height - doc.page.margins.bottom + 8,
      {
        align: "right",
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      },
    );
  }
}

function getPdfTableWidth() {
  return exportColumns.reduce((total, column) => total + column.pdfWidth, 0);
}

function registerPdfFonts(doc: PDFKit.PDFDocument): PdfFonts {
  if (existsSync(windowsRegularFontPath) && existsSync(windowsBoldFontPath)) {
    doc.registerFont(pdfRegularFont, windowsRegularFontPath);
    doc.registerFont(pdfBoldFont, windowsBoldFontPath);
    return { regular: pdfRegularFont, bold: pdfBoldFont };
  }

  return { regular: "Helvetica", bold: "Helvetica-Bold" };
}

function truncateForPdf(doc: PDFKit.PDFDocument, value: string, width: number) {
  if (doc.widthOfString(value) <= width) {
    return value;
  }

  let text = value;

  while (text.length > 1 && doc.widthOfString(`${text}...`) > width) {
    text = text.slice(0, -1);
  }

  return `${text}...`;
}

function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
