import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Next's PHASE_DEVELOPMENT_SERVER, inlined. Importing it from 'next/constants'
// fails under native ESM (.mjs) — the subpath has no ESM export map — and
// esbuild keeps `next` external when firebase-tools bundles this config, so the
// import would also break at the Cloud Run runtime. The string is a stable part
// of Next's public API.
const PHASE_DEVELOPMENT_SERVER = 'phase-development-server';

const FIREBASE_ORIGIN = 'https://tournament-tracker-f35tb.web.app';

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
    // Load our own JS/CSS from Firebase directly by absolute URL. After the
    // dota2inhouse.pl → Vercel cutover the community site owns /_next/* at the
    // root, so relative asset paths would round-trip through (or collide with)
    // Vercel. Absolute URLs to our own origin bypass it entirely. Harmless while
    // the domain is still ours. See the domain-cutover instructions.
    assetPrefix: isDev ? undefined : FIREBASE_ORIGIN,
    // Exclude archive folder from build
    typescript: {
        ignoreBuildErrors: false,
    },
    eslint: {
        ignoreDuringBuilds: false,
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
        // Serve the image optimizer from our own Firebase origin by absolute URL.
        // Why not the obvious alternatives:
        //   - assetPrefix does NOT cover /_next/image (only basePath does), so it
        //     alone would leave image requests hitting Vercel's optimizer after the
        //     dota2inhouse.pl cutover — which rejects our Firebase/Steam hosts (400).
        //   - A custom `loader`/`loaderFile` would DISABLE our built-in optimizer
        //     (next-server 404s /_next/image when loader !== 'default').
        // Keeping the default loader + an absolute `images.path` routes optimized
        // images straight to our own optimizer, which honours the remotePatterns
        // below. Dev stays on the relative default.
        ...(isDev ? {} : { path: `${FIREBASE_ORIGIN}/_next/image` }),
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
            {
                protocol: 'https',
                hostname: 'tournament-tracker-f35tb.firebasestorage.app',
            },
            {
                protocol: 'https',
                hostname: 'avatars.steamstatic.com',
            },
        ],
    },
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

export default buildConfig;
