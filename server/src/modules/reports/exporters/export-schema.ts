import { getOptionLabel } from "../mapper.js";
import { normalizeDate, normalizePhone, normalizeText } from "../policy.js";
import type {
  ExportSummary,
  ReportCall,
  ReportOptionLabelMap,
  ReportQuery,
} from "../types.js";

export type ExportColumn = {
  key: string;
  header: string;
  width: number;
  pdfWidth: number;
  value: (row: ReportCall, labels: ReportOptionLabelMap) => string;
};

export const exportColumns: ExportColumn[] = [
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

export function createExportSummary(
  query: ReportQuery,
  rowCount: number,
  createdAt: Date,
  labels: ReportOptionLabelMap,
): ExportSummary {
  const filters = [
    ["Telefon", normalizePhone(query.phoneNumber)],
    ["TC", normalizeText(query.studentTc)],
    ["Öğrenci", normalizeText(query.studentName)],
    ["Kayıt No", normalizeText(query.recordNumber)],
    ["Kategori", normalizeText(query.category)],
    ["Durum", getOptionLabel(labels.status, normalizeText(query.status))],
    ["Öncelik", getOptionLabel(labels.priority, normalizeText(query.priority))],
    ["Kaydı açan", normalizeText(query.openedByUserId)],
    ["Çözüm yetkilisi", normalizeText(query.resolvedByUserId)],
    ["Kayıt başlangıç", normalizeDate(query.dateFrom)],
    ["Kayıt bitiş", normalizeDate(query.dateTo)],
    ["Takip başlangıç", normalizeDate(query.followUpFrom)],
    ["Takip bitiş", normalizeDate(query.followUpTo)],
    ["SLA", normalizeText(query.slaStatus)],
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

export function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
