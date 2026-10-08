import { test, expect } from '@playwright/test';

// US-01: drop the sample pair → see "8 real changes found — 4 need your
// attention" with the four High findings, within a few seconds.
test('compares the sample files and shows the headline + High findings', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /hidden change/i })).toBeVisible();

  await page.getByRole('button', { name: 'Try with sample files' }).click();

  const headline = page.getByTestId('headline');
  await expect(headline).toHaveText(/8 real changes found — 4 need your attention/, { timeout: 20_000 });

  // contrast line
  await expect(page.getByText(/basic cell-by-cell compare would flag 89 cells/)).toBeVisible();

  // the four High findings
  await expect(page.getByText('Formula replaced by a typed number')).toBeVisible();
  await expect(page.getByText(/Totals don.t include/)).toBeVisible();
  await expect(page.getByText('Deleted, but referenced elsewhere')).toBeVisible();
  await expect(page.getByText(/Date moved outside/)).toBeVisible();

  // the changed-rows grid shows an edited invoice
  await expect(page.getByText('INV-1015').first()).toBeVisible();
});

// US-05: download the Excel and HTML reports (generated in the worker, saved
// via a Blob — nothing leaves the device).
test('downloads the Excel and HTML reports', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try with sample files' }).click();
  await expect(page.getByTestId('headline')).toHaveText(/8 real changes found/, { timeout: 20_000 });

  const xlsx = page.waitForEvent('download');
  await page.getByTestId('download-excel').click();
  const xlsxDownload = await xlsx;
  expect(xlsxDownload.suggestedFilename()).toMatch(/^SheetLens_.*_vs_.*_\d{4}-\d{2}-\d{2}\.xlsx$/);

  const html = page.waitForEvent('download');
  await page.getByTestId('download-html').click();
  const htmlDownload = await html;
  expect(htmlDownload.suggestedFilename()).toMatch(/^SheetLens_.*_vs_.*_\d{4}-\d{2}-\d{2}\.html$/);
});

test('privacy panel reports no external requests', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try with sample files' }).click();
  await expect(page.getByTestId('headline')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('link', { name: 'How do I know?' }).click();
  await expect(page.getByText(/0 requests carrying file data/)).toBeVisible();
});
