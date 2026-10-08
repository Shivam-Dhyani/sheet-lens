import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { RowState, type ReportModel } from '@shivam-dhyani/sheet-diff';
import { renderExcelReport } from './excel-report.ts';
import { renderHtmlReport } from './html-report.ts';
import { reportFileName } from './filename.ts';

function sampleModel(): ReportModel {
  return {
    meta: {
      oldFile: 'Sales_v1.xlsx',
      newFile: 'Sales_FINAL.xlsx',
      matchedBy: 'Invoice No (auto-detected: unique in both files)',
      generated: '2026-10-08',
    },
    overview: {
      counts: {
        needsAttention: 2,
        toReview: 1,
        rowsAdded: 1,
        rowsRemoved: 1,
        cellsEditedByHand: 1,
        formulasOverwritten: 1,
        realChanges: 3,
        recalculated: 2,
      },
      forInformation: 1,
      contrastCells: 42,
      attention: [],
    },
    allChanges: [
      {
        index: 1,
        risk: 'high',
        where: 'Sales Register',
        key: 'INV-1015',
        column: 'GST Amount (₹)',
        whatChanged: 'Formula replaced by a typed number',
        old: 1036.8,
        new: 1063.8,
        meaning: 'Someone typed over the formula.',
        rule: 'CHK-01',
      },
      {
        index: 2,
        risk: 'high',
        where: 'Sales Register',
        key: 'INV-1029',
        column: 'Invoice Date',
        whatChanged: 'Value edited',
        old: 46290,
        new: 46297,
        meaning: 'Date moved outside September.',
        rule: 'CHK-04',
      },
      {
        index: 3,
        risk: 'medium',
        where: 'Sales Register',
        key: 'INV-1013',
        column: '—',
        whatChanged: 'Row added',
        old: null,
        new: null,
        meaning: 'New invoice in the FINAL file.',
        rule: 'CHK-07',
      },
      {
        index: 4,
        risk: 'medium',
        where: 'Sales Register',
        key: 'INV-1019',
        column: '—',
        whatChanged: 'Row removed',
        old: null,
        new: null,
        meaning: 'Invoice no longer in the register.',
        rule: 'CHK-08',
      },
      {
        index: 5,
        risk: 'info',
        where: 'Credit Notes',
        key: '—',
        column: '—',
        whatChanged: 'New sheet: Credit Notes.',
        old: null,
        new: null,
        meaning: 'A new sheet exists only in the FINAL file.',
        rule: 'CHK-09',
      },
    ],
    markedSheets: [
      {
        name: 'Sales Register',
        columns: ['Invoice No', 'Invoice Date', 'Customer Name', 'GST Amount (₹)'],
        rows: [
          {
            status: RowState.Changed,
            key: 'INV-1015',
            cells: [
              { value: 'INV-1015', changed: false, high: false, recalculated: false },
              { value: 46275, changed: false, high: false, recalculated: false },
              { value: 'Shah Electricals', changed: false, high: false, recalculated: false },
              { value: 1063.8, changed: true, high: true, recalculated: false, oldValue: 1036.8 },
            ],
          },
          {
            status: RowState.Added,
            key: 'INV-1013',
            cells: [
              { value: 'INV-1013', changed: false, high: false, recalculated: false },
              { value: 46280, changed: false, high: false, recalculated: false },
              { value: 'Trivedi Infra', changed: false, high: false, recalculated: false },
              { value: 30001.5, changed: false, high: false, recalculated: false },
            ],
          },
        ],
        removed: [
          {
            key: 'INV-1019',
            afterKey: 'INV-1013',
            cells: ['INV-1019', 46260, 'Old Co', 8831.6],
          },
        ],
      },
    ],
  };
}

describe('renderExcelReport', () => {
  it('produces a valid workbook with Overview, All Changes and marked sheets', async () => {
    const buf = await renderExcelReport(sampleModel());
    expect(buf.byteLength).toBeGreaterThan(0);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Overview',
      'All Changes',
      'Sales Register (marked)',
    ]);
  });

  it('writes the Overview counts as COUNTIFs that cache the engine totals', async () => {
    const buf = await renderExcelReport(sampleModel());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ov = wb.getWorksheet('Overview')!;

    const high = ov.getCell('B9').value as { formula: string; result: number };
    expect(high.formula).toContain('COUNTIF');
    expect(high.formula).toContain("'All Changes'!B4:B8");
    expect(high.result).toBe(2);

    expect((ov.getCell('B12').value as { result: number }).result).toBe(1); // rows added
    expect((ov.getCell('B13').value as { result: number }).result).toBe(1); // rows removed
  });

  it('marks changed cells, carries the old value as a note, and strikes removed rows', async () => {
    const buf = await renderExcelReport(sampleModel());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.getWorksheet('Sales Register (marked)')!;

    // Header at row 5, first data row at 6: the changed High GST cell is column 5 (E).
    const gst = ws.getCell('E6');
    expect(gst.note).toBeTruthy();
    expect(String((gst.note as { texts?: { text: string }[] })?.texts?.[0]?.text ?? gst.note)).toContain('was');
    expect((gst.fill as { fgColor?: { argb: string } }).fgColor?.argb).toBe('FFFBE0CF');

    // Removed row (INV-1019) is placed after the added row and struck through.
    const statusCol = ws.getColumn(1).values.map((v) => String(v ?? ''));
    expect(statusCol).toContain('Removed');
  });
});

describe('renderHtmlReport', () => {
  it('is self-contained — no external http(s) references', () => {
    const html = renderHtmlReport(sampleModel());
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Content-Security-Policy');
    expect(html).not.toMatch(/https?:\/\//);
  });

  it('renders the headline figures and every change', () => {
    const html = renderHtmlReport(sampleModel());
    expect(html).toContain('INV-1015');
    expect(html).toContain('INV-1019');
    expect(html).toContain('42'); // contrast cells
  });
});

describe('reportFileName', () => {
  it('builds SheetLens_{new}_vs_{old}_{date}.{ext}', () => {
    const name = reportFileName('Sales_FINAL.xlsx', 'Sales_v1.xlsx', 'xlsx', new Date('2026-10-08T00:00:00Z'));
    expect(name).toBe('SheetLens_Sales_FINAL_vs_Sales_v1_2026-10-08.xlsx');
  });
});
