import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Four separate sites (amendment A7). Each has its own heading on its first screen.
const sites = [
  { name: 'student site', url: 'http://localhost:3000/', heading: 'Chai Connect' },
  { name: 'display + admin', url: 'http://localhost:3001/', heading: 'Chai Connect' },
  { name: 'moments', url: 'http://localhost:3002/', heading: /Share the/ },
  { name: 'games desk', url: 'http://localhost:3003/', heading: 'Games desk' },
];

for (const site of sites) {
  test.describe(site.name, () => {
    test('loads with the brand and no console errors', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await page.goto(site.url);
      await expect(page.getByRole('heading', { level: 1, name: site.heading })).toBeAttached();
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
  for (const path of ['/admin', '/registrations', '/admin/cvs/x/pdf', '/admin/team']) {
    test(`${path} is a 404 without a session`, async ({ request }) => {
      const response = await request.get(`http://localhost:3001${path}`);
      expect(response.status()).toBe(404);
    });
  }
});

test('game-station API refuses requests without a station key', async ({ request }) => {
  const base = 'http://localhost:3003/api/games/skill-issues';
  expect((await request.get(`${base}/registrations?rollNo=25K-1234`)).status()).toBe(401);
  const run = await request.post(`${base}/scores`, {
    data: {
      gameSlug: 'skill-issues',
      runId: '0'.repeat(32),
      rollNo: '25K-1234',
      points: 10,
      playedAt: new Date().toISOString(),
    },
  });
  expect(run.status()).toBe(401);
});

test('games desk export needs a desk session', async ({ request }) => {
  const response = await request.get('http://localhost:3003/export');
  expect(response.status()).toBe(404);
});

test('student site has no moments, scores or menu', async ({ page, request }) => {
  for (const path of ['/moments', '/leaderboard']) {
    expect((await request.get(`http://localhost:3000${path}`)).status(), path).toBe(404);
  }
  await page.goto('http://localhost:3000/');
  await expect(page.getByRole('navigation')).toHaveCount(0);
});

test('student pages load', async ({ page }) => {
  for (const path of ['/ask', '/cv', '/games', '/quiz', '/privacy']) {
    const response = await page.goto(`http://localhost:3000${path}`);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  }
});
