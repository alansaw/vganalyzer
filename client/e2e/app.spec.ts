import { expect, test } from '@playwright/test';

// These E2E tests drive the full stack (Vite client -> Express API -> Postgres)
// with the deterministic mock provider (set via playwright webServer env).
// They assume the dev DB has been migrated + seeded (npm run setup).

test.describe('VG Analyzer', () => {
  test('portfolio page shows totals, chart and positions', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Portfolio', level: 1 })).toBeVisible();
    await expect(page.getByText('Total Value', { exact: true })).toBeVisible();
    await expect(page.getByTestId('price-chart')).toBeVisible();
    // Seeded demo data includes open positions.
    await expect(page.getByTestId('position-row').first()).toBeVisible();
  });

  test('navigates to a position detail page from the portfolio', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('position-row').first().getByRole('link').click();
    await expect(page).toHaveURL(/\/positions\//);
    await expect(page.getByText('P/E (trailing)')).toBeVisible();
    await expect(page.getByText('PEG')).toBeVisible();
    await expect(page.getByText('Price history')).toBeVisible();
  });

  test('recommendations page lists ranked value-growth picks', async ({ page }) => {
    await page.goto('/recommendations');
    await expect(page.getByRole('heading', { name: 'Recommendations', level: 1 })).toBeVisible();
    // Wait for the first batch to generate/load.
    await expect(page.getByTestId('reco-row').first()).toBeVisible({ timeout: 20_000 });
    const count = await page.getByTestId('reco-row').count();
    expect(count).toBeGreaterThan(0);
  });

  test('grades page buckets recommendations into five grade rows', async ({ page }) => {
    await page.goto('/grades');
    await expect(page.getByRole('heading', { name: 'Grades', level: 1 })).toBeVisible();
    await expect(page.getByTestId('grade-row')).toHaveCount(5, { timeout: 20_000 });
    await expect(page.getByTestId('stock-chip').first()).toBeVisible({ timeout: 20_000 });
  });

  test('can add a transaction and see it on the position page', async ({ page }) => {
    const ticker = 'CSCO';
    await page.goto(`/positions/${ticker}`);
    await page.getByRole('button', { name: '+ Add transaction' }).click();

    await page.getByLabel('Shares', { exact: true }).fill('7');
    await page.getByLabel('Price', { exact: true }).fill('48');
    await page.getByLabel('Date', { exact: true }).fill('2025-10-10');
    await page.getByRole('button', { name: 'Add transaction' }).click();

    // The new transaction row should appear.
    await expect(page.getByTestId('tx-row').first()).toBeVisible();
    await expect(page.getByText('Shares held', { exact: true }).first()).toBeVisible();
  });
});
