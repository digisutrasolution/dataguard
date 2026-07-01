// Generic tabular export → CSV, XLSX, or PDF, streamed to the HTTP response.
import type { Response } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';
export interface Column { key: string; header: string; width?: number }
export interface ExportOpts { filename: string; title: string; columns: Column[]; rows: Record<string, any>[] }

function csvCell(v: any): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function sendCsv(res: Response, o: ExportOpts): void {
  const head = o.columns.map((c) => csvCell(c.header)).join(',');
  const body = o.rows.map((r) => o.columns.map((c) => csvCell(r[c.key])).join(',')).join('\n');
  res.setHeader('content-type', 'text/csv; charset=utf-8');
  res.setHeader('content-disposition', `attachment; filename="${o.filename}.csv"`);
  res.send(head + '\n' + body);
}

async function sendXlsx(res: Response, o: ExportOpts): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Report');
  ws.columns = o.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 }));
  o.rows.forEach((r) => ws.addRow(r));
  ws.getRow(1).font = { bold: true };
  res.setHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('content-disposition', `attachment; filename="${o.filename}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}

function sendPdf(res: Response, o: ExportOpts): void {
  const doc = new PDFDocument({ size: 'A4', margin: 36, layout: o.columns.length > 4 ? 'landscape' : 'portrait' });
  res.setHeader('content-type', 'application/pdf');
  res.setHeader('content-disposition', `attachment; filename="${o.filename}.pdf"`);
  doc.pipe(res);
  doc.fontSize(16).fillColor('#000').text(o.title);
  doc.fontSize(8).fillColor('#666').text(`DataGuard Solutions · generated ${new Date().toLocaleString()} · ${o.rows.length} rows`);
  doc.moveDown(1);
  const startX = doc.page.margins.left;
  const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colW = usable / o.columns.length;
  let y = doc.y;
  const rowH = 16;
  const write = (vals: any[], bold: boolean) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor('#000');
    vals.forEach((v, i) => doc.text(v == null ? '' : String(v), startX + i * colW, y, { width: colW - 4, height: rowH, ellipsis: true, lineBreak: false }));
    y += rowH;
    if (y > doc.page.height - doc.page.margins.bottom - rowH) { doc.addPage(); y = doc.page.margins.top; }
  };
  write(o.columns.map((c) => c.header), true);
  doc.moveTo(startX, y - 3).lineTo(startX + usable, y - 3).strokeColor('#ccc').stroke();
  o.rows.forEach((r) => write(o.columns.map((c) => r[c.key]), false));
  doc.end();
}

export async function sendExport(res: Response, format: ExportFormat, o: ExportOpts): Promise<void> {
  if (format === 'xlsx') return sendXlsx(res, o);
  if (format === 'pdf') return sendPdf(res, o);
  return sendCsv(res, o);
}
