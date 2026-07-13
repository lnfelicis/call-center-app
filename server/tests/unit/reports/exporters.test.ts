import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { createExcel } from "../../../src/modules/reports/exporters/excel-exporter.js";
import { createExportSummary } from "../../../src/modules/reports/exporters/export-schema.js";
import { createPdf } from "../../../src/modules/reports/exporters/pdf-exporter.js";
import {
  createLabelMap,
  createReportCall,
} from "./report-fixtures.js";

describe("report exporters", () => {
  const createdAt = new Date("2026-07-13T10:20:30.000Z");

  it("creates the exact ordered export summary and omits legacy unsupported filters", () => {
    const summary = createExportSummary({
      phoneNumber: "+90 (555) 12-34",
      studentTc: "123",
      studentName: "Ayşe",
      recordNumber: "REC-1",
      category: "all",
      status: "open",
      priority: "urgent",
      openedByUserId: "opened-1",
      assignedToUserId: "assigned-is-not-in-summary",
      resolvedByUserId: "resolved-1",
      dateFrom: "2026-07-01",
      dateTo: "invalid",
      followUpFrom: "2026-07-10",
      followUpTo: "2026-07-20",
      slaStatus: "active",
    }, 7, createdAt, createLabelMap());

    expect(summary).toStrictEqual({
      title: "Call Center Çağrı Raporu",
      createdAt,
      rowCount: 7,
      filters: [
        "Telefon: 905551234",
        "TC: 123",
        "Öğrenci: Ayşe",
        "Kayıt No: REC-1",
        "Durum: Açık",
        "Öncelik: Acil",
        "Kaydı açan: opened-1",
        "Çözüm yetkilisi: resolved-1",
        "Kayıt başlangıç: 2026-07-01",
        "Takip başlangıç: 2026-07-10",
        "Takip bitiş: 2026-07-20",
        "SLA: active",
      ],
    });
  });

  it("produces a parseable Excel workbook with semantic headers and labels", async () => {
    const labels = createLabelMap();
    const rows = [createReportCall()];
    const summary = createExportSummary({}, rows.length, createdAt, labels);

    const content = await createExcel(rows, summary, labels);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Uint8Array.from(content).buffer);
    const worksheet = workbook.getWorksheet("Çağrı Raporu");

    expect(worksheet).toBeDefined();
    expect(worksheet?.getCell("A1").value).toBe("Call Center Çağrı Raporu");
    expect(worksheet?.getCell("A3").value).toBe("Oluşturma");
    expect(worksheet?.getCell("A4").value).toBe("Kayıt sayısı");
    expect(worksheet?.getCell("B4").value).toBe(1);
    expect(worksheet?.getCell("B5").value).toBe("Yok");
    expect(Array.from(worksheet?.getRow(7).values as unknown[])).toStrictEqual([
      undefined,
      "Kayıt No",
      "Telefon",
      "TC",
      "Öğrenci",
      "Kategori",
      "Durum",
      "Öncelik",
      "Açan",
      "Çözüm Yetkilisi",
      "Kayıt Tarihi",
    ]);
    expect(worksheet?.getCell("F8").value).toBe("Açık");
    expect(worksheet?.getCell("G8").value).toBe("Acil");
    expect(worksheet?.autoFilter).toStrictEqual("A7:J7");
  });

  it("produces a PDF buffer with the PDF signature", async () => {
    const labels = createLabelMap();
    const rows = [createReportCall()];
    const summary = createExportSummary({}, rows.length, createdAt, labels);

    const content = await createPdf(rows, summary, labels);

    expect(content.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(content.length).toBeGreaterThan(500);
  });
});
