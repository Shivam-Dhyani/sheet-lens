import type {
  ReportModel,
  MarkedSheet,
  MarkedRow,
  RemovedRow,
  Scalar,
  Severity,
} from '@shivam-dhyani/sheet-diff';
import { RowState } from '@shivam-dhyani/sheet-diff';
import type { Fill, Worksheet } from 'exceljs';
import { isAmountColumn, serialToDisplayDate } from '../lib/format.ts';

// Palette — kept in step with the HTML report / design tokens.
const C = {
  high: 'FFFBE0CF',
  med: 'FFFCEBC0',
  recalc: 'FFDCE9FB',
  add: 'FFDCE9FB',
  removed: 'FFEFEFEF',
  header: 'FFF4F4EF',
  line: 'FFE2E2DC',
} as const;

const RISK_LABEL: Record<Severity, 'High' | 'Medium' | 'Info'> = {
  high: 'High',
  medium: 'Medium',
  info: 'Info',
};

const ROW_LABEL: Record<number, string> = {
  [RowState.Added]: 'Added',
  [RowState.Removed]: 'Removed',
  [RowState.Changed]: 'Changed',
  [RowState.Moved]: 'Moved',
};

function fill(argb: string): Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

/**
 * Formula-injection guard. In an `.xlsx` a plain string is stored as a
 * (shared/inline) string cell, never as a `<f>` formula, so Excel never
 * evaluates it — only the `{ formula }` objects we build ourselves (the
 * Overview COUNTIFs, all from trusted constants) become formulas. We still
 * strip control characters from free text so nothing odd lands in a cell.
 * (The apostrophe-prefix guard matters for the engine's CSV path, not here.)
 */
function text(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
}

/** A scalar → a cell value (+ number format), faithful to how the UI shows it. */
function toCell(v: Scalar, header: string): { value: number | string | boolean | null; numFmt?: string } {
  if (v === null || v === undefined || v === '') return { value: null };
  if (typeof v === 'boolean') return { value: v };
  if (typeof v === 'number') {
    if (/date/i.test(header)) return { value: serialToDisplayDate(v) };
    if (header.includes('%')) return { value: v, numFmt: '0.##%' };
    if (isAmountColumn(header)) return { value: v, numFmt: '"₹"#,##,##0.00' };
    return { value: v };
  }
  return { value: text(v) };
}

/** Display a scalar as a string (for the All Changes Old/New columns). */
function show(v: Scalar, header: string): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') {
    if (/date/i.test(header)) return serialToDisplayDate(v);
    if (header.includes('%')) {
      const pct = v * 100;
      return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(2)}%`;
    }
    if (isAmountColumn(header)) return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    return String(v);
  }
  return text(v);
}

function sheetName(name: string): string {
  // Excel: ≤31 chars, none of : \ / ? * [ ]
  return `${name} (marked)`.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
}

function headerRow(ws: Worksheet, rowIdx: number, labels: string[]): void {
  const row = ws.getRow(rowIdx);
  labels.forEach((label, i) => {
    const cell = row.getCell(i + 1);
    cell.value = label;
    cell.font = { bold: true };
    cell.fill = fill(C.header);
    cell.border = { bottom: { style: 'thin', color: { argb: C.line } } };
  });
}

function buildOverview(ws: Worksheet, m: ReportModel, lastChangeRow: number): void {
  ws.getColumn(1).width = 30;
  ws.getColumn(2).width = 72;

  ws.getCell('A1').value = 'SheetLens report';
  ws.getCell('A1').font = { bold: true, size: 16 };
  ws.getCell('A2').value = 'Generated in the browser — your files were not uploaded anywhere.';
  ws.getCell('A2').font = { italic: true, color: { argb: 'FF4A4F57' } };

  const meta: [string, string][] = [
    ['Old file', m.meta.oldFile],
    ['New file', m.meta.newFile],
    ['Rows matched by', m.meta.matchedBy],
  ];
  meta.forEach(([k, v], i) => {
    const r = 4 + i;
    ws.getCell(`A${r}`).value = k;
    ws.getCell(`A${r}`).font = { bold: true };
    ws.getCell(`B${r}`).value = text(v);
  });

  ws.getCell('A8').value = 'At a glance';
  ws.getCell('A8').font = { bold: true, size: 13 };

  // COUNTIFs over the All Changes table, so the figures are auditable and
  // recalc live; the engine's exact count is cached as the displayed result.
  const AC = `'All Changes'`;
  const risk = `${AC}!B4:B${lastChangeRow}`;
  const what = `${AC}!F4:F${lastChangeRow}`;
  const c = m.overview.counts;
  const rows: [string, string, number][] = [
    ['Needs your attention (High)', `COUNTIF(${risk},"High")`, c.needsAttention],
    ['Review (Medium)', `COUNTIF(${risk},"Medium")`, c.toReview],
    ['For information', `COUNTIF(${risk},"Info")`, m.overview.forInformation],
    ['Rows added', `COUNTIF(${what},"Row added")`, c.rowsAdded],
    ['Rows removed', `COUNTIF(${what},"Row removed")`, c.rowsRemoved],
    ['Cells edited by hand', `COUNTIF(${what},"Value edited")`, c.cellsEditedByHand],
    ['Formulas overwritten', `COUNTIF(${what},"Formula replaced*")`, c.formulasOverwritten],
  ];
  rows.forEach(([label, formula, result], i) => {
    const r = 9 + i;
    ws.getCell(`A${r}`).value = label;
    ws.getCell(`B${r}`).value = { formula, result };
  });

  const contrastRow = 9 + rows.length + 1;
  ws.getCell(`A${contrastRow}`).value = 'For reference';
  ws.getCell(`A${contrastRow}`).font = { bold: true };
  ws.getCell(`B${contrastRow}`).value =
    `A basic cell-by-cell compare would flag ${m.overview.contrastCells} cells; ` +
    `SheetLens found ${c.realChanges} real changes and ${c.recalculated} automatic recalculations.`;
  ws.getCell(`A${contrastRow + 2}`).value = `Generated ${m.meta.generated}.`;
  ws.getCell(`A${contrastRow + 2}`).font = { color: { argb: 'FF4A4F57' } };

  ws.views = [{ showGridLines: false }];
}

function buildAllChanges(ws: Worksheet, m: ReportModel): void {
  const widths = [5, 9, 16, 15, 16, 30, 22, 22, 64];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  ws.getCell('A1').value = 'All changes — most important first';
  ws.getCell('A1').font = { bold: true, size: 13 };

  headerRow(ws, 3, [
    '#',
    'Risk',
    'Where',
    'Invoice / Row',
    'Column',
    'What changed',
    'Old',
    'New',
    'What it means',
  ]);

  m.allChanges.forEach((ch, i) => {
    const r = 4 + i;
    const row = ws.getRow(r);
    row.getCell(1).value = ch.index;
    const riskCell = row.getCell(2);
    riskCell.value = RISK_LABEL[ch.risk];
    riskCell.font = { bold: true };
    riskCell.fill = fill(ch.risk === 'high' ? C.high : ch.risk === 'medium' ? C.med : C.removed);
    row.getCell(3).value = text(ch.where);
    row.getCell(4).value = text(ch.key);
    row.getCell(5).value = text(ch.column);
    row.getCell(6).value = text(ch.whatChanged);
    row.getCell(7).value = show(ch.old, ch.column);
    row.getCell(8).value = show(ch.new, ch.column);
    const meaning = row.getCell(9);
    meaning.value = text(ch.meaning);
    meaning.alignment = { wrapText: true, vertical: 'top' };
  });

  const lastRow = 3 + m.allChanges.length;
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: lastRow, column: 9 } };
  ws.views = [{ state: 'frozen', ySplit: 3, showGridLines: false }];
}

function buildMarkedSheet(ws: Worksheet, ms: MarkedSheet): void {
  ws.getColumn(1).width = 11;
  ms.columns.forEach((h, i) => (ws.getColumn(i + 2).width = isAmountColumn(h) ? 16 : 18));

  ws.getCell('A1').value = `${ms.name} — new file, with changes marked`;
  ws.getCell('A1').font = { bold: true, size: 13 };

  // Legend (colour is never the only signal — each swatch is labelled).
  const legend: [string, string][] = [
    ['Added', C.add],
    ['Removed', C.removed],
    ['Edited by hand', C.med],
    ['High risk', C.high],
    ['Recalculated', C.recalc],
  ];
  const legRow = ws.getRow(2);
  legend.forEach(([label, argb], i) => {
    const cell = legRow.getCell(1 + i * 2 + 1);
    cell.value = label;
    cell.fill = fill(argb);
    cell.border = { bottom: { style: 'thin', color: { argb: C.line } } };
  });
  ws.getCell('A2').value = 'Legend:';
  ws.getCell('A2').font = { bold: true };
  ws.getCell('A3').value = 'A changed cell carries its previous value as a note.';
  ws.getCell('A3').font = { italic: true, color: { argb: 'FF4A4F57' } };

  headerRow(ws, 5, ['Status', ...ms.columns]);

  // Interleave removed rows by their anchor (afterKey: null = top of sheet).
  const byAnchor = new Map<string | null, RemovedRow[]>();
  for (const rm of ms.removed) {
    const list = byAnchor.get(rm.afterKey) ?? [];
    list.push(rm);
    byAnchor.set(rm.afterKey, list);
  }

  let r = 6;
  const emitRemoved = (anchor: string | null): void => {
    for (const rm of byAnchor.get(anchor) ?? []) {
      const row = ws.getRow(r++);
      const status = row.getCell(1);
      status.value = 'Removed';
      status.font = { bold: true, color: { argb: 'FF6B6B6B' } };
      status.fill = fill(C.removed);
      rm.cells.forEach((v, i) => {
        const h = ms.columns[i] ?? '';
        const cell = row.getCell(i + 2);
        const { value, numFmt } = toCell(v, h);
        cell.value = value;
        if (numFmt) cell.numFmt = numFmt;
        cell.font = { strike: true, color: { argb: 'FF6B6B6B' } };
        cell.fill = fill(C.removed);
      });
    }
  };

  emitRemoved(null);
  for (const mr of ms.rows) {
    writeMarkedRow(ws.getRow(r++), mr, ms.columns);
    emitRemoved(mr.key);
  }

  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 5, showGridLines: false }];
}

function writeMarkedRow(row: ReturnType<Worksheet['getRow']>, mr: MarkedRow, columns: string[]): void {
  const label = ROW_LABEL[mr.status] ?? '';
  const status = row.getCell(1);
  if (label) {
    status.value = label;
    status.font = { bold: true };
    if (mr.status === RowState.Added) status.fill = fill(C.add);
    else if (mr.status === RowState.Changed) status.fill = fill(C.med);
    else if (mr.status === RowState.Moved) status.fill = fill(C.recalc);
  }
  mr.cells.forEach((mc, i) => {
    const h = columns[i] ?? '';
    const cell = row.getCell(i + 2);
    const { value, numFmt } = toCell(mc.value, h);
    cell.value = value;
    if (numFmt) cell.numFmt = numFmt;
    if (mc.high) cell.fill = fill(C.high);
    else if (mc.changed) cell.fill = fill(C.med);
    else if (mc.recalculated) cell.fill = fill(C.recalc);
    if (mc.changed && mc.oldValue !== undefined) {
      cell.note = `was ${show(mc.oldValue, h)}`;
    }
  });
}

/**
 * The downloadable Excel report (FR-REP-01): Overview, All Changes, and one
 * "{Sheet} (marked)" tab per sheet, shaped to `reference_report_prototype.xlsx`.
 * ExcelJS is imported lazily (it is only needed on export).
 */
export async function renderExcelReport(m: ReportModel): Promise<ArrayBuffer> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SheetLens';
  wb.created = new Date();

  const lastChangeRow = 3 + Math.max(m.allChanges.length, 1);
  buildOverview(wb.addWorksheet('Overview'), m, lastChangeRow);
  buildAllChanges(wb.addWorksheet('All Changes'), m);
  for (const ms of m.markedSheets) {
    buildMarkedSheet(wb.addWorksheet(sheetName(ms.name)), ms);
  }

  const out = await wb.xlsx.writeBuffer();
  const u8 = new Uint8Array(out as ArrayBuffer);
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}
