// Two small servers for trying the forwarding on this machine, with no real site involved (WP-06):
//
//   npx tsx scripts/measure/local-hops.ts [--old-port 3400] [--front-port 3300 --target http://localhost:3101]
//
//   - A stand-in for the old site on --old-port: answers every path with a small page that names
//     the path (and a script for /_next/static/old/*), so a forward is visible in the response.
//   - With --target, a stand-in for the community site's rule on --front-port: everything goes to
//     the target, and a client navigation (`RSC: 1`) gets the `.rsc` suffix that Vercel's routing
//     adds in front of us today (see src/middleware.ts). The real rule is a `fallback` rewrite in
//     the community site's next.config.ts; it owns a few paths of its own, which this one does not.
//
// Stop with Ctrl+C.

import http from 'node:http';
import { numberOption, option, parseOptions, run } from './lib';

function oldSite(port: number) {
  const server = http.createServer((req, res) => {
    const path = req.url ?? '/';
    if (path.startsWith('/_next/static/old/')) {
      res.writeHead(200, { 'content-type': 'application/javascript', 'x-old-site': '1' });
      res.end('/* old site chunk */');
      return;
    }
    const rsc = req.headers.rsc === '1';
    res.writeHead(200, { 'content-type': rsc ? 'text/x-component' : 'text/html; charset=utf-8', 'x-old-site': '1' });
    res.end(rsc ? `0:["old site","${path}"]\n` : `<!doctype html><title>Old site</title><p>Old site: ${path.replace(/[<>&]/g, '')}</p>`
      + '<script src="/_next/static/old/chunk.js"></script>');
  });
  server.listen(port, '127.0.0.1', () => console.log(`old site stand-in on http://127.0.0.1:${port}`));
}

function frontProxy(port: number, target: string) {
  const to = new URL(target);
  const server = http.createServer((req, res) => {
    let path = req.url ?? '/';
    if (req.headers.rsc === '1') {
      const [p, q] = path.split('?');
      path = `${p === '/' ? '/index' : p}.rsc${q ? `?${q}` : ''}`;
    }
    const upstream = http.request(
      { host: to.hostname, port: to.port, method: req.method, path, headers: { ...req.headers, host: to.host, 'x-forwarded-host': req.headers.host ?? '' } },
      (up) => {
        res.writeHead(up.statusCode ?? 502, { ...up.headers, 'x-front-proxy': '1' });
        up.pipe(res);
      },
    );
    upstream.on('error', (e) => {
      res.writeHead(502, { 'content-type': 'text/plain' });
      res.end(`front proxy: ${e.message}`);
    });
    req.pipe(upstream);
  });
  server.listen(port, '127.0.0.1', () => console.log(`community-site stand-in on http://127.0.0.1:${port} -> ${target}`));
}

run(async () => {
  const o = parseOptions(process.argv.slice(2));
  oldSite(numberOption(o, 'old-port', 3400));
  if (o.target) frontProxy(numberOption(o, 'front-port', 3300), option(o, 'target'));
  await new Promise(() => {});
});
