/**
 * Dynamic font utility to inject custom fonts into Tailwind at runtime
 * This script is used by the DynamicFontLoader component
 */

import { getFontVariableName, getFontClassName } from './google-fonts';

/**
 * Oxanium (public/fonts/oxanium), offered as built-in options in the admin font
 * pickers. "Oxanium" is the weight-aware family (each element gets the file for
 * its own weight — bold headings get Bold); the others pin one file whatever the
 * element's weight. @font-face rules for every family live in globals.css.
 */
export const OXANIUM_FONT_OPTIONS = [
  { id: 'local-oxanium', label: 'Oxanium (automatyczna grubość)', family: 'Oxanium' },
  { id: 'local-oxanium-extralight', label: 'Oxanium ExtraLight', family: 'Oxanium ExtraLight' },
  { id: 'local-oxanium-light', label: 'Oxanium Light', family: 'Oxanium Light' },
  { id: 'local-oxanium-regular', label: 'Oxanium Regular', family: 'Oxanium Regular' },
  { id: 'local-oxanium-medium', label: 'Oxanium Medium', family: 'Oxanium Medium' },
  { id: 'local-oxanium-semibold', label: 'Oxanium SemiBold', family: 'Oxanium SemiBold' },
  { id: 'local-oxanium-bold', label: 'Oxanium Bold', family: 'Oxanium Bold' },
  { id: 'local-oxanium-extrabold', label: 'Oxanium ExtraBold', family: 'Oxanium ExtraBold' },
] as const;

export const BUILT_IN_LOCAL_FONT_IDS: ReadonlySet<string> = new Set(OXANIUM_FONT_OPTIONS.map(option => option.id));

/**
 * Inject CSS for custom fonts into document
 * Creates CSS variables and font-family classes for Tailwind
 */
export function injectCustomFontStyles(customFonts: Array<{ family: string; id: string }>) {
  // Remove existing custom font styles
  const existingStyle = document.getElementById('custom-fonts-style');
  if (existingStyle) {
    existingStyle.remove();
  }

  if (!customFonts || customFonts.length === 0) {
    return;
  }

  // Create CSS rules for each custom font
  const cssRules = customFonts.map(font => {
    const variableName = getFontVariableName(font.family);
    const className = getFontClassName(font.family);
    
    return `
      .font-${className} {
        font-family: '${font.family}', var(--font-geist-sans), sans-serif;
      }
    `;
  }).join('\n');

  // Create and inject style element
  const style = document.createElement('style');
  style.id = 'custom-fonts-style';
  style.textContent = cssRules;
  document.head.appendChild(style);
}

/**
 * Get the font family name from a font ID
 * Handles both built-in fonts and custom fonts
 */
export function getFontFamily(
  fontId: string, 
  customFonts?: Array<{ id: string; family: string }>
): string {
  // Check if it's a built-in font
  const builtInFonts: Record<string, string> = {
    'logik': 'var(--font-logik)',
    'geist': 'var(--font-geist-sans)',
    'inter': 'Inter',
    'logik-extended-bold': 'var(--font-logik-extended-bold)',
    'logik-wide-black': 'var(--font-logik-wide-black)',
    'logik-extended-8': 'var(--font-logik-extended-8)',
    'logik-3': 'var(--font-logik-3)',
    'logik-4': 'var(--font-logik-4)',
    'logik-readable': 'var(--font-logik-4)',
    // Local fonts from public/fonts — font names with spaces/digits must be CSS-quoted
    'local-logik': "'Logik', sans-serif",
    'local-logik-2': "'Logik 2', sans-serif",
    'local-logik-3': "'Logik 3', sans-serif",
    'local-logik-4': "'Logik 4', sans-serif",
    'local-logik-6': "'Logik 6', sans-serif",
    'local-logik-extended-6': "'Logik Extended 6', sans-serif",
    'local-logik-extended-7': "'Logik Extended 7', sans-serif",
    'local-logik-extended-8': "'Logik Extended 8', sans-serif",
    'local-logik-extended-9': "'Logik Extended 9', sans-serif",
    'local-logik-extended-bold': "'Logik Extended Bold', sans-serif",
    'local-logik-wide-black': "'Logik Wide Black', sans-serif",
    'local-mitchell': "'Mitchell', cursive",
    'local-neonderthaw': "'Neonderthaw', cursive",
    ...Object.fromEntries(OXANIUM_FONT_OPTIONS.map(option => [option.id, `'${option.family}', sans-serif`])),
    'local-space-mono': "'Space Mono', monospace",
    'local-tilt-neon': "'Tilt Neon', sans-serif",
  };

  if (builtInFonts[fontId]) {
    return builtInFonts[fontId];
  }

  // Check if it's a custom font
  const customFont = customFonts?.find(f => f.id === fontId);
  if (customFont) {
    return `'${customFont.family}', var(--font-geist-sans), sans-serif`;
  }

  // Fallback
  return 'var(--font-geist-sans)';
}
