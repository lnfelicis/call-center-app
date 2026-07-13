import ExcelJS from "exceljs";
import { exportColumns, formatDateTime } from "./export-schema.js";
import type { ReportExporter } from "../types.js";

export const createExcel: ReportExporter = async (rows, summary, labels) => {
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
};
