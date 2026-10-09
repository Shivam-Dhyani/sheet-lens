import { test, expect } from '@playwright/test';

// FR-SET-06: the sample pair has a confident key (Invoice No), so results show
// immediately. Setup can still be opened on request from the results screen,
// where the user can re-pick the key column and re-compare.
test('opens setup on request and re-compares with a chosen key', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try with sample files' }).click();
  await expect(page.getByTestId('headline')).toHaveText(/8 real changes found/, { timeout: 20_000 });

  // confident key → straight to results, with the "matched by" line
  await expect(page.getByText(/Matched by Invoice No/)).toBeVisible();

  await page.getByRole('link', { name: 'Change how rows are matched' }).click();
  await expect(page.getByRole('heading', { name: 'Check how rows are matched' })).toBeVisible();

  // the key column select is pre-filled with the detected key
  const select = page.getByLabel('Key column for Sales Register');
  await expect(select).toHaveValue('Invoice No');

  await page.getByTestId('apply-setup').click();

  // back on results, still a valid comparison
  await expect(page.getByTestId('headline')).toHaveText(/8 real changes found/, { timeout: 20_000 });
});
