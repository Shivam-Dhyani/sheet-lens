import { createRequire } from 'node:module';
import { test, expect, type Page } from '@playwright/test';

// Playwright's ESM loader cannot link ExcelJS's CommonJS dependency tree through `import`,
// so load it with require (types only come from the import type).
const ExcelJS = createRequire(import.meta.url)('exceljs') as typeof import('exceljs');

// US-02 (ADD_ADD, BR-M6 / FR-MRG-03): both copies add the same invoice with different
// content. The user keeps one copy's row, or both under different keys. The shipped
// fixtures have no such conflict, so the three workbooks are built here.

type Sale = { id: string; who: string; qty: number };

/** Sales (Amount is a live formula) + a Summary that totals rows 2..4, as in the fixtures. */
async function workbook(rows: Sale[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sales = wb.addWorksheet('Sales');
  sales.addRow(['Invoice No', 'Customer', 'Qty', 'Rate', 'Amount']);
  rows.forEach((r, i) => {
    const n = i + 2;
    sales.addRow([r.id, r.who, r.qty, 100, { formula: `C${n}*D${n}`, result: r.qty * 100 }]);
  });
  const summary = wb.addWorksheet('Summary');
  summary.addRow(['Total amount', { formula: 'SUM(Sales!E2:E4)', result: 600 }]);
  summary.addRow(['Invoices', { formula: 'COUNT(Sales!E2:E4)', result: 3 }]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const ORIGINAL: Sale[] = [
  { id: 'INV-1', who: 'Alpha', qty: 2 },
  { id: 'INV-2', who: 'Beta', qty: 3 },
  { id: 'INV-3', who: 'Gamma', qty: 1 },
];
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Upload Original / Ravi / Priya in Merge mode and plan the merge. */
async function planAddAdd(page: Page): Promise<void> {
  const files = [
    ['Original.xlsx', await workbook(ORIGINAL)],
    ['Ravi.xlsx', await workbook([...ORIGINAL, { id: 'INV-4', who: 'Delta (Ravi)', qty: 5 }])],
    ['Priya.xlsx', await workbook([...ORIGINAL, { id: 'INV-4', who: 'Delta (Priya)', qty: 7 }])],
  ] as const;

  await page.goto('/');
  await page.getByRole('tab', { name: 'Merge two edited copies' }).click();
  const inputs = page.locator('input[type=file]'); // Original, Copy 1, Copy 2
  await expect(inputs).toHaveCount(3);
  for (const [i, [name, buffer]] of files.entries()) {
    await inputs.nth(i).setInputFiles({ name, mimeType: XLSX, buffer });
  }
  await expect(page.getByTestId('file-name')).toHaveCount(3);
  await page.getByRole('button', { name: 'Plan the merge' }).click();
  await expect(page.getByTestId('merge-headline')).toContainText('1 of 1 conflicts to resolve', { timeout: 20_000 });
}

/** [key, customer] of every Sales row in a downloaded merged file. */
async function salesRows(path: string): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const out: string[][] = [];
  wb.getWorksheet('Sales')!.eachRow((row, n) => {
    if (n > 1) out.push([String(row.getCell(1).value), String(row.getCell(2).value)]);
  });
  return out;
}

test('shows what each copy added and lets you keep one copy\'s row', async ({ page }) => {
  await planAddAdd(page);

  const card = page.locator('.conflict', { hasText: 'INV-4' });
  await expect(card).toContainText('ADD ADD');

  // The two rows side by side; the field they disagree on is marked with a symbol, not just colour.
  const table = card.locator('table.row-compare');
  await expect(table).toContainText('Delta (Ravi)');
  await expect(table).toContainText('Delta (Priya)');
  await expect(table.locator('tr', { hasText: 'Customer' })).toContainText('≠');
  await expect(table.locator('tr', { hasText: 'Invoice No' })).not.toContainText('≠');

  // Nothing is chosen yet, so downloading is blocked.
  await expect(page.getByTestId('download-merge')).toBeDisabled();

  await card.getByLabel(/Copy 2.s row/).check(); // Copy 2 = the Priya file
  await expect(page.getByTestId('merge-headline')).toContainText('all conflicts resolved');
  await expect(page.locator('table.impact')).toContainText('1,300', { timeout: 10_000 }); // 600 + 7×100

  const download = page.waitForEvent('download');
  await page.getByTestId('download-merge').click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^Original_MERGED_\d{4}-\d{2}-\d{2}\.xlsx$/);
  expect((await salesRows((await file.path())!)).slice(3)).toEqual([['INV-4', 'Delta (Priya)']]);
});

test('keep both: refuses bad keys with a clear message, then writes both rows', async ({ page }) => {
  await planAddAdd(page);
  const card = page.locator('.conflict', { hasText: 'INV-4' });
  await card.getByLabel('Keep both rows').check();

  const copy1Key = card.getByLabel(/Key for Copy 1.s row/);
  const copy2Key = card.getByLabel(/Key for Copy 2.s row/);
  await expect(copy1Key).toHaveValue('INV-4');
  await expect(copy2Key).toHaveValue('INV-4-B'); // a sensible starting point

  // A key that is already a row in the Original.
  await copy2Key.fill('INV-2');
  await expect(card.getByRole('alert')).toContainText('"INV-2" is already used by another row');
  await expect(page.getByTestId('download-merge')).toBeDisabled();
  await expect(page.getByTestId('merge-headline')).not.toContainText('all conflicts resolved');

  // The same key twice.
  await copy2Key.fill('INV-4');
  await expect(card.getByRole('alert')).toContainText('two different keys');

  // A valid pair clears the error and unlocks the download.
  await copy2Key.fill('INV-4-B');
  await expect(card.getByRole('alert')).toHaveCount(0);
  await expect(page.getByTestId('merge-headline')).toContainText('all conflicts resolved');
  // Totals are extended to both kept rows by default: 600 + 500 + 700.
  await expect(page.locator('table.impact')).toContainText('1,800', { timeout: 10_000 });

  const download = page.waitForEvent('download');
  await page.getByTestId('download-merge').click();
  const file = await download;
  await expect(page.getByTestId('merge-result')).toContainText('2 change(s) applied', { timeout: 15_000 });

  expect(await salesRows((await file.path())!)).toEqual([
    ['INV-1', 'Alpha'],
    ['INV-2', 'Beta'],
    ['INV-3', 'Gamma'],
    ['INV-4', 'Delta (Ravi)'],
    ['INV-4-B', 'Delta (Priya)'],
  ]);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile((await file.path())!);
  expect(wb.worksheets.map((w) => w.name)).toContain('SheetLens Merge Log');
});
