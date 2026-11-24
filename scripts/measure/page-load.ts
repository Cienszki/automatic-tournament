// A page view in a real browser (WP-06): time to first byte and Largest Contentful Paint, cold and
// warm, and the requests one view costs, by kind and by host (to check the estimate in COSTS.md).
//
//   npx tsx scripts/measure/page-load.ts --base https://<address> --path /pdl-s2/teams [--path ...]
//       [--runs 3] [--channel msedge] [--cdp http://127.0.0.1:9222] [--block googleapis.com] [--json out.json]
//
// Cold: a fresh browser context (empty HTTP cache, no cookies). Warm: the same URL again in that
// context. Use --channel msedge (or chrome) for an installed browser, or --cdp to attach to a
// browser started by hand with --remote-debugging-port, where Playwright cannot start one itself.
// The browser loads everything the page asks for, including third parties, unless --block <host
// suffix> (repeatable) aborts the requests to those hosts; aborted requests are still counted.
// Playwright turns the browser cache off while requests are intercepted, so with --block the warm
// views are not warm: read their requests, not their timings.
//
// A page behind a front (WP-06 step 7) loads its scripts from a second protected address, which
// needs that project's own bypass secret: --bypass-cookie <origin>=<secret> (repeatable) asks the
// origin once for Vercel's bypass cookie and gives it to every browser context, so nothing is
// intercepted and the browser cache keeps working.

import { chromium, type Browser, type Page } from 'playwright';
import { baseUrl, extraHeaders, numberOption, option, parseOptions, round, run, summarize, formatSummary, writeJson } from './lib';

interface Cookie { name: string; value: string; domain: string; path: string; secure: boolean; sameSite: 'None' }

/** Vercel's bypass cookie for each `<origin>=<secret>`, set with SameSite=None for cross-site loads. */
async function fetchBypassCookies(specs: string[]): Promise<Cookie[]> {
  const cookies: Cookie[] = [];
  for (const spec of specs) {
    const i = spec.indexOf('=');
    if (i <= 0) throw new Error('--bypass-cookie must be <origin>=<secret>');
    const origin = new URL(spec.slice(0, i));
    const res = await fetch(`${origin.origin}/`, {
      redirect: 'manual',
      headers: { 'x-vercel-protection-bypass': spec.slice(i + 1), 'x-vercel-set-bypass-cookie': 'samesitenone' },
    });
    const set = res.headers.getSetCookie().map((c) => c.split(';')[0]).filter((c) => c.startsWith('_vercel_jwt='));
    if (!set.length) throw new Error(`no bypass cookie from ${origin.origin} (status ${res.status})`);
    for (const c of set) {
      const j = c.indexOf('=');
      cookies.push({ name: c.slice(0, j), value: c.slice(j + 1), domain: origin.hostname, path: '/', secure: true, sameSite: 'None' });
    }
  }
  return cookies;
}

interface View {
  path: string;
  phase: 'cold' | 'warm';
  ttfbMs: number;
  lcpMs: number;
  lcpElement: string;
  requests: number;
  /** Requests answered by the address measured: what the CDN of that deployment counts. */
  sameOriginRequests: number;
  byType: Record<string, number>;
  byHost: Record<string, number>;
  failed: string[];
  transferBytes: number;
}

const LCP_PROBE = () => {
  const w = window as unknown as { __lcp: { t: number; el: string } };
  w.__lcp = { t: 0, el: '' };
  new PerformanceObserver((list) => {
    for (const e of list.getEntries() as (PerformanceEntry & { element?: Element; url?: string })[]) {
      w.__lcp = { t: e.startTime, el: e.element ? `${e.element.tagName.toLowerCase()}${e.url ? ` ${e.url.slice(0, 60)}` : ''}` : '' };
    }
  }).observe({ type: 'largest-contentful-paint', buffered: true });
};

async function view(page: Page, url: string, origin: string, path: string, phase: View['phase']): Promise<View> {
  const requests: { url: string; type: string }[] = [];
  const failed: string[] = [];
  const onRequest = (r: { url: () => string; resourceType: () => string }) => requests.push({ url: r.url(), type: r.resourceType() });
  const onFailed = (r: { url: () => string; failure: () => { errorText: string } | null }) => failed.push(`${r.url().slice(0, 100)} (${r.failure()?.errorText ?? '?'})`);
  page.on('request', onRequest);
  page.on('requestfailed', onFailed);
  await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForTimeout(1500);
  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const w = window as unknown as { __lcp: { t: number; el: string } };
    return {
      ttfb: nav ? nav.responseStart - nav.startTime : 0,
      lcp: w.__lcp.t,
      el: w.__lcp.el,
      bytes: (nav?.transferSize ?? 0) + resources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
    };
  });
  page.off('request', onRequest);
  page.off('requestfailed', onFailed);
  const count = (key: (r: { url: string; type: string }) => string) => {
    const out: Record<string, number> = {};
    for (const r of requests) out[key(r)] = (out[key(r)] ?? 0) + 1;
    return out;
  };
  return {
    path, phase, ttfbMs: round(metrics.ttfb), lcpMs: round(metrics.lcp), lcpElement: metrics.el,
    requests: requests.length,
    sameOriginRequests: requests.filter((r) => r.url.startsWith(origin)).length,
    byType: count((r) => r.type),
    byHost: count((r) => (r.url.startsWith('data:') ? 'data:' : new URL(r.url).host)),
    failed, transferBytes: metrics.bytes,
  };
}

async function openBrowser(cdp: string | undefined, channel: string | undefined): Promise<Browser> {
  if (cdp) return chromium.connectOverCDP(cdp);
  return chromium.launch({ channel, headless: true });
}

run(async () => {
  const o = parseOptions(process.argv.slice(2));
  const base = baseUrl(o);
  const origin = new URL(base).origin;
  const runs = numberOption(o, 'runs', 3);
  const bypassCookies = await fetchBypassCookies(o['bypass-cookie'] ?? []);
  const browser = await openBrowser(o.cdp ? option(o, 'cdp') : undefined, o.channel ? option(o, 'channel') : undefined);
  const views: View[] = [];
  try {
    for (const path of o.path ?? ['/pdl-s2/teams']) {
      for (let r = 0; r < runs; r++) {
        const context = await browser.newContext({
          locale: 'pl-PL', viewport: { width: 1366, height: 900 }, serviceWorkers: 'block', extraHTTPHeaders: extraHeaders(o),
        });
        if (bypassCookies.length) await context.addCookies(bypassCookies);
        await context.addInitScript(LCP_PROBE);
        for (const suffix of o.block ?? []) {
          await context.route((url) => url.hostname === suffix || url.hostname.endsWith(`.${suffix}`), (route) => route.abort());
        }
        const page = await context.newPage();
        views.push(await view(page, `${base}${path}`, origin, path, 'cold'));
        views.push(await view(page, `${base}${path}`, origin, path, 'warm'));
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  for (const path of new Set(views.map((v) => v.path))) {
    for (const phase of ['cold', 'warm'] as const) {
      const set = views.filter((v) => v.path === path && v.phase === phase);
      console.log(`\n${path} ${phase} (${set.length} views)`);
      console.log(`  TTFB ${formatSummary(summarize(set.map((v) => v.ttfbMs)))}`);
      console.log(`  LCP  ${formatSummary(summarize(set.map((v) => v.lcpMs)))}  element: ${set[0].lcpElement || '-'}`);
      console.log(`  requests per view: ${set.map((v) => v.requests).join(', ')}; to ${origin}: ${set.map((v) => v.sameOriginRequests).join(', ')}`);
      console.log(`  by type: ${JSON.stringify(set[0].byType)}`);
      console.log(`  by host: ${JSON.stringify(set[0].byHost)}`);
      console.log(`  transferred: ${set.map((v) => Math.round(v.transferBytes / 1024)).join(', ')} kB`);
      if (set[0].failed.length) console.log(`  failed: ${set[0].failed.join('; ')}`);
    }
  }
  writeJson(o, { base, at: new Date().toISOString(), views });
});
