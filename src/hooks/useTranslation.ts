import { useTranslations } from 'next-intl';
import { translations } from '@/lib/translations';

// Helper function to get nested value from an object by dot path
function getNestedValue(obj: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Compatibility wrapper that delegates to next-intl and falls back to legacy translations.
 * 
 * @deprecated Prefer importing `useTranslations` from 'next-intl' directly.
 * This hook exists for backward compatibility during the migration period.
 */
export function useTranslation() {
  // Use next-intl's hook without namespace (global access)
  let nextIntlT: ((key: string) => string) | null = null;
  try {
    const intlTranslate = useTranslations();
    nextIntlT = (key: string) => {
      try {
        return intlTranslate(key as Parameters<typeof intlTranslate>[0]);
      } catch {
        return '';
      }
    };
  } catch {
    // next-intl context may not be available (e.g., in tests or non-provider contexts)
    nextIntlT = null;
  }

  const t = (key: string): string => {
    // 1. Try next-intl first (proper i18n system)
    if (nextIntlT) {
      const result = nextIntlT(key);
      if (result && result !== key) {
        return result;
      }
    }

    // 2. Fall back to legacy translations object
    const keys = key.split('.');
    const translation = getNestedValue(translations as unknown as Record<string, unknown>, keys);

    if (typeof translation === 'string') {
      return translation;
    }

    // 3. Return key as final fallback
    return key;
  };

  return { t };
}

/**
 * Direct translation function for non-component usage.
 * Only reads from legacy translations (no React context available).
 * 
 * @deprecated Move to next-intl server/client translation functions.
 */
export function t(key: string): string {
  const keys = key.split('.');
  const translation = getNestedValue(translations as unknown as Record<string, unknown>, keys);

  if (typeof translation === 'string') {
    return translation;
  }

  return key;
}
