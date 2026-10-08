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

test('privacy panel reports no external requests', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try with sample files' }).click();
  await expect(page.getByTestId('headline')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('link', { name: 'How do I know?' }).click();
  await expect(page.getByText(/0 requests carrying file data/)).toBeVisible();
});
