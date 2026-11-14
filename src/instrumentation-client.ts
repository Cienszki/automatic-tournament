import { initSentry } from '@/platform/errors';

// Browser start-up. NEXT_PUBLIC_* values are inlined at build time; with the DSN
// blank, the Sentry SDK chunk is never requested.
type TransitionHook = (href: string, navigationType: string) => void;
let transitionHook: TransitionHook | null = null;

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  void initSentry({
    runtime: 'browser',
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NEXT_PUBLIC_VERCEL_ENV,
  }).then(async (started) => {
    if (started) transitionHook = (await import('@sentry/nextjs')).captureRouterTransitionStart;
  });
}

export function onRouterTransitionStart(href: string, navigationType: string): void {
  transitionHook?.(href, navigationType);
}
