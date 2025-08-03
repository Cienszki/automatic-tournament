import { translations, TranslationKey } from '@/lib/translations';

// Helper function to get nested translation value
function getNestedTranslation(obj: any, path: string[]): string {
  return path.reduce((current, key) => current?.[key], obj) || path.join('.');
}

// Translation hook
export function useTranslation() {
  const t = (key: string): string => {
    const keys = key.split('.');
    const translation = getNestedTranslation(translations, keys);
    
    if (typeof translation === 'string') {
      return translation;
    }
    
    // If translation not found, return the key as fallback
    console.warn(`Translation not found for key: ${key}`);
    return key;
  };

  return { t };
}

// Direct translation function for non-component usage
export function t(key: string): string {
  const keys = key.split('.');
  const translation = getNestedTranslation(translations, keys);
  
  if (typeof translation === 'string') {
    return translation;
  }
  
  // If translation not found, return the key as fallback
  console.warn(`Translation not found for key: ${key}`);
  return key;
}
