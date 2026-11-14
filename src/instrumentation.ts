import type { Instrumentation } from 'next';
import { initSentry, tournamentSlugFromRoute } from '@/platform/errors';

// Server and edge start-up. With SENTRY_DSN_WEB blank, Sentry is never loaded.
export async function register() {
  const runtime = process.env.NEXT_RUNTIME;
  if (runtime !== 'nodejs' && runtime !== 'edge') return;
  await initSentry({
    runtime,
    dsn: process.env.SENTRY_DSN_WEB,
    tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.VERCEL_ENV,
  });
}

// Errors thrown while rendering a page or running a route handler.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (!process.env.SENTRY_DSN_WEB?.trim()) return;
  const Sentry = await import('@sentry/nextjs');
  const slug = tournamentSlugFromRoute(context.routePath, request.path);
  Sentry.withScope((scope) => {
    if (slug) scope.setTag('tournamentSlug', slug);
    Sentry.captureRequestError(error, request, context);
  });
};
