// The read-only smoke test (WP-03, TEST_STRATEGY.md level 10): the home page and two pages of each
// of two tournaments answer, show content, have a real title and log no errors. Run it after a
// go-live step, against the address that step changed:
//
//   SMOKE_BASE_URL=https://<site> npm run smoke
//   SMOKE_BASE_URL=http://localhost:3100 SMOKE_TOURNAMENTS=seed-liga,seed-swiss npm run smoke
//
// It never signs in and refuses every request that could write (plan.ts), so it is safe against
// production. CI runs it only by hand (.github/workflows/smoke.yml).

import { expect, test } from '@playwright/test';
import { isErrorTitle, isIgnoredConsoleError, isReadOnlyRequest, smokeTarget } from './plan';

const target = smokeTarget(process.env);
/** Visible text a page must show at least, so a bare loading screen fails. */
const MIN_TEXT = Number(process.env.SMOKE_MIN_TEXT ?? 200);

for (const path of target.paths) {
  test(`GET ${path}`, async ({ page }) => {
    const refused = new Set<string>();
    const errors: string[] = [];

    await page.route('**/*', async (route) => {
      const request = route.request();
      if (isReadOnlyRequest(request.method(), request.url())) return route.continue();
      refused.add(request.url());
      return route.abort('blockedbyclient');
    });
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = `${message.text()} ${message.location().url ?? ''}`;
      if (!isIgnoredConsoleError(text, refused, process.env.SMOKE_IGNORE_CONSOLE)) errors.push(text.trim());
    });
    page.on('pageerror', (error) => errors.push(`uncaught: ${error.message}`));

    const response = await page.goto(`${target.baseUrl}${path}`, { waitUntil: 'domcontentloaded' });
    expect(response, 'no response').not.toBeNull();
    expect(response!.status(), `HTTP status of ${path}`).toBeLessThan(400);

    // The old site fills its pages in the browser; give it time, then read what a visitor sees.
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
    await expect.poll(async () => (await page.locator('body').innerText()).trim().length, {
      message: `visible text on ${path}`, timeout: 20_000,
    }).toBeGreaterThanOrEqual(MIN_TEXT);

    const title = await page.title();
    expect(isErrorTitle(title), `title of ${path}: "${title}"`).toBe(false);
    expect(errors, `console errors on ${path}`).toEqual([]);
    if (refused.size) test.info().annotations.push({ type: 'refused writes', description: [...refused].join('\n') });
  });
}
