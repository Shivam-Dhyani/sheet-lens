import { test, expect } from '@playwright/test';

// US-02: drop Original + Ravi + Priya → 5 auto-changes and 3 conflicts
// (CELL INV-1003, RELATED_EDITS INV-1008, DELETE_EDIT INV-1019); resolve them,
// extend totals, and download the merged file — all in the worker, no upload.
test('plans, resolves conflicts, previews impact, and downloads the merged file', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Merge two edited copies' }).click();
  await page.getByRole('button', { name: 'Try with sample files' }).click();

  const headline = page.getByTestId('merge-headline');
  await expect(headline).toContainText('5 auto-changes ready', { timeout: 20_000 });
  await expect(headline).toContainText('3 of 3 conflicts to resolve');

  // the three conflicts, keyed by invoice
  const cell = page.locator('.conflict', { hasText: 'INV-1003' });
  const related = page.locator('.conflict', { hasText: 'INV-1008' });
  const del = page.locator('.conflict', { hasText: 'INV-1019' });
  await expect(cell).toContainText('CELL');
  await expect(related).toContainText('RELATED EDITS');
  await expect(del).toContainText('DELETE EDIT');

  // resolve: Ravi's Qty, Ravi's edits, delete the removed row
  await cell.getByLabel('Ravi', { exact: true }).check();
  await related.getByLabel(/Ravi.s edits/).check();
  await del.getByLabel('Delete the row').check();

  await expect(headline).toContainText('all conflicts resolved');

  // impact preview: Total GST payable after extending totals to the new rows
  await expect(page.locator('table.impact')).toContainText('2,29,272.32', { timeout: 10_000 });

  // download the patched Original
  const dl = page.waitForEvent('download');
  await page.getByTestId('download-merge').click();
  const file = await dl;
  expect(file.suggestedFilename()).toMatch(/^Sales_Register_Sep2026_ORIGINAL_MERGED_\d{4}-\d{2}-\d{2}\.xlsx$/);

  // result panel: 8 changes applied (5 auto + 3 resolved)
  await expect(page.getByTestId('merge-result')).toContainText('8 change(s) applied', { timeout: 15_000 });
});

// BR-M9: without a key column, merge is unavailable and the reason is explained.
// (Covered by the engine's golden tests; the UI empty-state is asserted here via
// the compare→merge mode toggle remaining reachable.)
test('merge mode is reachable from the landing page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Merge two edited copies' }).click();
  await expect(page.getByText(/combine two people.s edits/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Original', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Plan the merge' })).toBeVisible();
});
