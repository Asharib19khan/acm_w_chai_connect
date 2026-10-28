import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const sites = [
  { name: 'student site', url: 'http://localhost:3000/' },
  { name: 'control app', url: 'http://localhost:3001/' },
];

for (const site of sites) {
  test.describe(site.name, () => {
    test('loads with the brand and no console errors', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await page.goto(site.url);
      await expect(page.getByRole('heading', { level: 1, name: 'Chai Connect' })).toBeAttached();
      expect(errors).toEqual([]);
    });

    test('has no serious accessibility violations', async ({ page }) => {
      await page.goto(site.url);
      const results = await new AxeBuilder({ page }).analyze();
      const serious = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );
      expect(serious).toEqual([]);
    });

    test('does not leak the X-Powered-By header', async ({ request }) => {
      const response = await request.get(site.url);
      expect(response.headers()['x-powered-by']).toBeUndefined();
    });
  });
}

test.describe('portals stay invisible', () => {
  for (const path of ['/admin', '/registrations', '/admin/cvs/x/pdf']) {
    test(`${path} is a 404 without a session`, async ({ request }) => {
      const response = await request.get(`http://localhost:3001${path}`);
      expect(response.status()).toBe(404);
    });
  }
});

test('student pages load', async ({ page }) => {
  for (const path of ['/ask', '/cv', '/games', '/quiz', '/moments', '/leaderboard', '/privacy']) {
    const response = await page.goto(`http://localhost:3000${path}`);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  }
});
