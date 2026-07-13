import { existsSync } from "node:fs";
import PDFDocument from "pdfkit";
import { exportColumns, formatDateTime } from "./export-schema.js";
import type {
  ExportSummary,
  ReportCall,
  ReportExporter,
  ReportOptionLabelMap,
} from "../types.js";

type PdfFonts = {
  regular: string;
  bold: string;
};

const pdfRegularFont = "AppRegular";
const pdfBoldFont = "AppBold";
const windowsRegularFontPath = "C:/Windows/Fonts/arial.ttf";
const windowsBoldFontPath = "C:/Windows/Fonts/arialbd.ttf";

export const createPdf: ReportExporter = async (rows, summary, labels) => {
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
};

function drawPdfHeader(
  doc: PDFKit.PDFDocument,
  summary: ExportSummary,
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
