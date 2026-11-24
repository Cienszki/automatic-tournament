import { withSentryConfig } from '@sentry/nextjs/config';
import createNextIntlPlugin from 'next-intl/plugin';
import {
  resolveAssetOrigin, resolveServerActionHosts, resolveStorageHosts,
} from './src/platform/origins/config.mjs';
import {
  legacyFallbackRewrites, platformRewrites, readRoutingConfig, routingHeaders,
} from './src/platform/routing/rules.mjs';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Next's PHASE_DEVELOPMENT_SERVER, inlined. Importing it from 'next/constants'
// fails under native ESM (.mjs) — the subpath has no ESM export map — and
// esbuild keeps `next` external when firebase-tools bundles this config, so the
// import would also break at the Cloud Run runtime. The string is a stable part
// of Next's public API.
const PHASE_DEVELOPMENT_SERVER = 'phase-development-server';

// Where our own JS, CSS and optimized images are served from, when a proxy in front of us owns
// /_next (the old site behind the community site). Blank: relative paths. Every address comes
// from the environment, so a local or staging build never points at production (ADR-15).
const ASSET_ORIGIN = resolveAssetOrigin(process.env);

// The new platform in front of the old site (ADR-15): PLATFORM_ROUTING, LEGACY_ORIGIN, LEGACY_SLUGS.
// Read at build time; Vercel and `next start` both apply rewrites from the built config.
const ROUTING = readRoutingConfig(process.env);

// NOTE: this file is .mjs (not .ts) ON PURPOSE.
// firebase-tools' frameworks adapter only recognises next.config.js / .mjs
// (see CONFIG_FILES in firebase-tools/lib/frameworks/next/constants.js). A
// next.config.ts is read fine by `next build` but is NEVER bundled into the
// Cloud Run SSR function, so at request time next({dev:false}) loads DEFAULTS
// (no assetPrefix) and the initial <script>/CSS tags render relative — which
// 404 behind the Vercel domain. Keeping this as .mjs gets it bundled and loaded
// at runtime. See the domain-cutover instructions / memory.

// ─── Build-time environment variable validation ────────────────────────────────
// NEXT_PUBLIC_* vars are baked into the client bundle at build time.
// If any are missing the app will silently break, so we fail the build loudly.
const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
];

const missingVars = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);
if (missingVars.length > 0) {
  throw new Error(
    `\n\nMissing required environment variables:\n` +
    missingVars.map((v) => `  ✗ ${v}`).join('\n') +
    `\n\nCreate a .env.local file based on .env.local.example.\n`
  );
}

// Exported as a function of `phase` (not a plain object) on purpose.
// The Firebase frameworks adapter serves SSR via next({ dev: false }), which
// RE-EVALUATES this config at request time — and at that moment NODE_ENV is not
// reliably 'production'. So we must NOT gate assetPrefix/images.path on NODE_ENV
// (that dropped them at runtime and emitted the initial <script>/CSS tags
// relative, which 404 behind the Vercel domain). `phase` is deterministic:
// PHASE_PRODUCTION_BUILD at build, PHASE_PRODUCTION_SERVER at the frameworks
// runtime, PHASE_DEVELOPMENT_SERVER only under `next dev`.
const buildConfig = (phase) => {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;

  const nextConfig = {
    // Load our own JS/CSS from our own origin by absolute URL when NEXT_PUBLIC_ASSET_ORIGIN is
    // set. Behind the community site's rewrite, the community site owns /_next/* at
    // the root, so relative asset paths would round-trip through (or collide with)
    // it. Absolute URLs to our own origin bypass it entirely.
    assetPrefix: isDev ? undefined : ASSET_ORIGIN,
    // Server Actions reject any POST whose Origin differs from the (forwarded)
    // host. Behind the community site's fallback rewrite the browser's Origin is
    // the public domain while we see our hosting's own host, so every action
    // failed with the masked "error occurred in the Server Components render".
    // The public site and ALLOWED_ORIGINS are allowed.
    experimental: {
        serverActions: {
            allowedOrigins: resolveServerActionHosts(process.env),
        },
    },
    // Exclude archive folder from build
    typescript: {
        ignoreBuildErrors: false,
    },
    eslint: {
        ignoreDuringBuilds: true, // CI runs `npm run lint`; keep the build independent of it
        dirs: ['src'],
    },
    pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
    // Exclude _archive from webpack processing
    webpack: (config) => {
        config.watchOptions = {
            ...config.watchOptions,
            ignored: ['**/_archive/**', '**/node_modules/**'],
        };
        return config;
    },
    images: {
        // Enable Next.js image optimization for better performance
        unoptimized: false,
        formats: ['image/avif', 'image/webp'],
        // With NEXT_PUBLIC_ASSET_ORIGIN set, serve the image optimizer from that origin by absolute URL.
        // Why not the obvious alternatives:
        //   - assetPrefix does NOT cover /_next/image (only basePath does), so it
        //     alone would leave image requests hitting Vercel's optimizer after the
        //     dota2inhouse.pl cutover — which rejects our Firebase/Steam hosts (400).
        //   - A custom `loader`/`loaderFile` would DISABLE our built-in optimizer
        //     (next-server 404s /_next/image when loader !== 'default').
        // Keeping the default loader + an absolute `images.path` routes optimized
        // images straight to our own optimizer, which honours the remotePatterns
        // below. Dev, and any build without NEXT_PUBLIC_ASSET_ORIGIN, stays on the relative default.
        ...(isDev || !ASSET_ORIGIN ? {} : { path: `${ASSET_ORIGIN}/_next/image` }),
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'steamcdn-a.akamaihd.net',
            },
            {
                protocol: 'https',
                hostname: 'cdn.steamusercontent.com',
            },
            {
                protocol: 'https',
                hostname: 'firebasestorage.googleapis.com',
            },
            // The Firebase Storage bucket's own hostname, from NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.
            ...resolveStorageHosts(process.env).map((hostname) => ({ protocol: 'https', hostname })),
            {
                protocol: 'https',
                hostname: 'avatars.steamstatic.com',
            },
            {
                // Dota 2 hero art (full-body renders are 0.5–1.5 MB; served resized via the optimizer)
                protocol: 'https',
                hostname: 'cdn.cloudflare.steamstatic.com',
                pathname: '/apps/dota2/**',
            },
        ],
    },
    // With PLATFORM_ROUTING=on (src/platform/routing/rules.mjs): before the app's own pages, the
    // moved pages of new tournaments go to /platform/<slug>/<page> and everything that is not the
    // new app's own goes to the old site (`beforeFiles`); a path this build has no file or route
    // for, above all the old site's /_next/ files, goes there too (`fallback`). All empty when off.
    async rewrites() {
        return { beforeFiles: platformRewrites(ROUTING), afterFiles: [], fallback: legacyFallbackRewrites(ROUTING) };
    },
    async headers() {
        return routingHeaders(ROUTING);
    },
    // The middleware's copy of the switch, fixed at build time like the rewrites above.
    env: { PLATFORM_ROUTING_AT_BUILD: ROUTING.enabled ? 'on' : 'off' },
    async redirects() {
        return [
            // Creator shorthand
            { source: '/create', destination: '/creator', permanent: false },
            { source: '/create/new', destination: '/creator/new', permanent: false },
            // Legacy admin redirect
            { source: '/admin', destination: '/letnia/admin', permanent: true },
            // Legacy URL redirects to Letnia tournament
            { source: '/teams', destination: '/letnia/teams', permanent: true },
            { source: '/groups', destination: '/letnia/groups', permanent: true },
            { source: '/schedule', destination: '/letnia/schedule', permanent: true },
            { source: '/playoffs', destination: '/letnia/playoffs', permanent: true },
            { source: '/fantasy', destination: '/letnia/fantasy', permanent: true },
            { source: '/pickem', destination: '/letnia/pickem', permanent: true },
            { source: '/stats', destination: '/letnia/stats', permanent: true },
            { source: '/rules', destination: '/letnia/rules', permanent: true },
            { source: '/faq', destination: '/letnia/faq', permanent: true },
            { source: '/standins', destination: '/letnia/standins', permanent: true },
            { source: '/register', destination: '/letnia/register', permanent: true },
            { source: '/my-team', destination: '/letnia/my-team', permanent: true },
            { source: '/admin/:path*', destination: '/letnia/admin/:path*', permanent: true },
        ];
    },
  };

  return withNextIntl(nextConfig);
};

// Sentry's build step. It never talks to the network unless SENTRY_AUTH_TOKEN is
// set: then it creates the release and uploads source maps; otherwise it only
// injects the release name. Runtime set-up is in src/platform/errors/sentry.ts.
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN || undefined;
const sentryUpload = Boolean(sentryAuthToken);
// The commit being built, from the hosting provider (Vercel) or CI (GitHub Actions).
const release =
  process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || undefined;

export default withSentryConfig(buildConfig, {
  org: 'polish-dota2-inhouse',
  project: 'tournament-web',
  authToken: sentryAuthToken,
  silent: !sentryUpload,
  telemetry: false,
  release: { name: release, create: sentryUpload, finalize: sentryUpload },
  sourcemaps: { disable: !sentryUpload, deleteSourcemapsAfterUpload: true },
  widenClientFileUpload: true,
  // Wrapping the middleware put the whole edge SDK into it (33 kB to 118 kB);
  // middleware errors still reach onRequestError in src/instrumentation.ts.
  webpack: { autoInstrumentMiddleware: false },
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
    excludeReplayWorker: true,
  },
});
