// scripts/measure-pages.js
// Measures page loads in a real browser for docs/overhaul/inventory/PAGES.md:
// TTFB, LCP, when the full-screen loading screen is gone, Firestore requests,
// /api requests and JS weight. Cold = fresh incognito context; warm = the same
// URL loaded again in that tab (HTTP cache and sessionStorage warm).
//
//   npm install          (puppeteer-core is a devDependency; it uses installed Edge)
//   node scripts/measure-pages.js https://dota2inhouse.pl out.json /wiosenna /wiosenna/teams /pdl-s2 /pdl-s2/teams
//
// Against a local production build, blank the server secrets first, or
// prerendering and server routes read production with the service account:
//   FIREBASE_SERVICE_ACCOUNT_BASE64= npx next build && FIREBASE_SERVICE_ACCOUNT_BASE64= npx next start -p 3100
//
// Set EDGE_PATH if Edge is not in the default location.
const puppeteer = require('puppeteer-core');
const fs = require('fs');

const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const [, , base, out, ...paths] = process.argv;

// Runs in the page before any script. Tracks when the full-screen loader
// (fixed inset-0 container at opacity-100 holding the pd2ih logo) was last visible.
const PROBE = () => {
  window.__probe = { lastLoaderSeen: null, firstLoaderSeen: null, lcp: 0, lcpEl: '' };
  const visibleLoader = () =>
    [...document.querySelectorAll('div.fixed.inset-0')].some(
      d => d.className.includes('opacity-100') && d.querySelector('img[src*="pd2ih-logo"], img[srcset*="pd2ih-logo"]')
    );
  setInterval(() => {
    if (visibleLoader()) {
      const t = performance.now();
      if (window.__probe.firstLoaderSeen === null) window.__probe.firstLoaderSeen = t;
      window.__probe.lastLoaderSeen = t;
    }
  }, 25);
  new PerformanceObserver(list => {
    for (const e of list.getEntries()) {
      window.__probe.lcp = e.startTime;
      window.__probe.lcpEl = e.element ? `${e.element.tagName.toLowerCase()}${e.url ? ' ' + e.url.slice(0, 80) : ''}` : '';
    }
  }).observe({ type: 'largest-contentful-paint', buffered: true });
};

async function loadOnce(page, url) {
  const reqs = [];
  const onReq = r => reqs.push(r.url());
  page.on('request', onReq);
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  // Wait until the loader has been gone for 2 s, or 45 s in total.
  for (;;) {
    await new Promise(r => setTimeout(r, 250));
    const p = await page.evaluate(() => ({ ...window.__probe, now: performance.now() }));
    const gone = p.lastLoaderSeen === null ? p.now > 3000 : p.now - p.lastLoaderSeen > 2000;
    if (gone || Date.now() - t0 > 45000) break;
  }
  await new Promise(r => setTimeout(r, 1500)); // late requests
  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const res = performance.getEntriesByType('resource');
    const js = res.filter(r => r.initiatorType === 'script' || r.name.endsWith('.js'));
    return {
      finalUrl: location.pathname + location.search,
      ttfb: Math.round(nav.responseStart),
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
      load: Math.round(nav.loadEventEnd),
      lcp: Math.round(window.__probe.lcp),
      lcpEl: window.__probe.lcpEl,
      loaderGone: window.__probe.lastLoaderSeen === null ? 0 : Math.round(window.__probe.lastLoaderSeen),
      loaderSeen: window.__probe.firstLoaderSeen !== null,
      jsTransferKB: Math.round(js.reduce((s, r) => s + (r.transferSize || 0), 0) / 1024),
      jsDecodedKB: Math.round(js.reduce((s, r) => s + (r.decodedBodySize || 0), 0) / 1024),
    };
  });
  page.off('request', onReq);
  m.firestoreRequests = reqs.filter(u => u.includes('firestore.googleapis.com')).length;
  m.apiRequests = reqs.filter(u => /\/api\//.test(new URL(u).pathname) && new URL(u).origin === new URL(url).origin).map(u => new URL(u).pathname);
  m.totalRequests = reqs.length;
  return m;
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--window-size=1440,900'] });
  const results = [];
  for (const p of paths) {
    const url = base + p;
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.evaluateOnNewDocument(PROBE);
    try {
      const cold = await loadOnce(page, url);
      const warm = await loadOnce(page, url);
      results.push({ url: p, cold, warm });
      console.log(p, 'cold', cold.ttfb, cold.lcp, cold.loaderGone, cold.firestoreRequests, '| warm', warm.ttfb, warm.lcp, warm.loaderGone, warm.firestoreRequests);
    } catch (e) {
      results.push({ url: p, error: String(e) });
      console.log(p, 'ERROR', String(e).slice(0, 200));
    }
    await ctx.close();
    fs.writeFileSync(out, JSON.stringify(results, null, 1));
  }
  await browser.close();
})();
