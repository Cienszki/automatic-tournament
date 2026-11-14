// Moved to src/platform/errors. Kept so existing importers keep working; new code
// imports from '@/platform/errors'.
export {
  configureErrorReporting,
  reportError,
  reportComponentError,
} from '@/platform/errors/error-reporting';
export type { ErrorReport, ErrorReportingProvider } from '@/platform/errors/error-reporting';
