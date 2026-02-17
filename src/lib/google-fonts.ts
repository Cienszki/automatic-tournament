/**
 * Google Fonts Integration
 * Provides utilities for working with Google Fonts
 */

export interface GoogleFont {
  family: string;
  category: string;
  variants: string[];
  subsets: string[];
  popularity: number;
}

/**
 * Curated list of popular Google Fonts
 * This avoids needing an API key while still providing good selection
 */
export const POPULAR_GOOGLE_FONTS: GoogleFont[] = [
  {
    family: 'Inter',
    category: 'sans-serif',
    variants: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
    subsets: ['latin', 'latin-ext'],
    popularity: 1,
  },
  {
    family: 'Roboto',
    category: 'sans-serif',
    variants: ['100', '300', '400', '500', '700', '900'],
    subsets: ['latin', 'latin-ext'],
    popularity: 2,
  },
  {
    family: 'Open Sans',
    category: 'sans-serif',
    variants: ['300', '400', '500', '600', '700', '800'],
    subsets: ['latin', 'latin-ext'],
    popularity: 3,
  },
  {
    family: 'Lato',
    category: 'sans-serif',
    variants: ['100', '300', '400', '700', '900'],
    subsets: ['latin', 'latin-ext'],
    popularity: 4,
  },
  {
    family: 'Montserrat',
    category: 'sans-serif',
    variants: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
    subsets: ['latin', 'latin-ext'],
    popularity: 5,
  },
  {
    family: 'Poppins',
    category: 'sans-serif',
    variants: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
    subsets: ['latin', 'latin-ext'],
    popularity: 6,
  },
  {
    family: 'Oswald',
    category: 'sans-serif',
    variants: ['200', '300', '400', '500', '600', '700'],
    subsets: ['latin', 'latin-ext'],
    popularity: 7,
  },
  {
    family: 'Raleway',
    category: 'sans-serif',
    variants: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
    subsets: ['latin', 'latin-ext'],
    popularity: 8,
  },
  {
    family: 'Nunito',
    category: 'sans-serif',
    variants: ['200', '300', '400', '500', '600', '700', '800', '900'],
    subsets: ['latin', 'latin-ext'],
    popularity: 9,
  },
  {
    family: 'Ubuntu',
    category: 'sans-serif',
    variants: ['300', '400', '500', '700'],
    subsets: ['latin', 'latin-ext'],
    popularity: 10,
  },
  {
    family: 'Playfair Display',
    category: 'serif',
    variants: ['400', '500', '600', '700', '800', '900'],
    subsets: ['latin', 'latin-ext'],
    popularity: 11,
  },
  {
    family: 'Merriweather',
    category: 'serif',
    variants: ['300', '400', '700', '900'],
    subsets: ['latin', 'latin-ext'],
    popularity: 12,
  },
  {
    family: 'PT Sans',
    category: 'sans-serif',
    variants: ['400', '700'],
    subsets: ['latin', 'latin-ext'],
    popularity: 13,
  },
  {
    family: 'Noto Sans',
    category: 'sans-serif',
    variants: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
    subsets: ['latin', 'latin-ext'],
    popularity: 14,
  },
  {
    family: 'Work Sans',
    category: 'sans-serif',
    variants: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
    subsets: ['latin', 'latin-ext'],
    popularity: 15,
  },
  {
    family: 'Rubik',
    category: 'sans-serif',
    variants: ['300', '400', '500', '600', '700', '800', '900'],
    subsets: ['latin', 'latin-ext'],
    popularity: 16,
  },
  {
    family: 'Quicksand',
    category: 'sans-serif',
    variants: ['300', '400', '500', '600', '700'],
    subsets: ['latin', 'latin-ext'],
    popularity: 17,
  },
  {
    family: 'Barlow',
    category: 'sans-serif',
    variants: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
    subsets: ['latin', 'latin-ext'],
    popularity: 18,
  },
  {
    family: 'DM Sans',
    category: 'sans-serif',
    variants: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
    subsets: ['latin', 'latin-ext'],
    popularity: 19,
  },
  {
    family: 'IBM Plex Sans',
    category: 'sans-serif',
    variants: ['100', '200', '300', '400', '500', '600', '700'],
    subsets: ['latin', 'latin-ext'],
    popularity: 20,
  },
  {
    family: 'Source Sans 3',
    category: 'sans-serif',
    variants: ['200', '300', '400', '500', '600', '700', '800', '900'],
    subsets: ['latin', 'latin-ext'],
    popularity: 21,
  },
  {
    family: 'Crimson Text',
    category: 'serif',
    variants: ['400', '600', '700'],
    subsets: ['latin', 'latin-ext'],
    popularity: 22,
  },
  {
    family: 'Fira Sans',
    category: 'sans-serif',
    variants: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
    subsets: ['latin', 'latin-ext'],
    popularity: 23,
  },
  {
    family: 'Karla',
    category: 'sans-serif',
    variants: ['200', '300', '400', '500', '600', '700', '800'],
    subsets: ['latin', 'latin-ext'],
    popularity: 24,
  },
  {
    family: 'Titillium Web',
    category: 'sans-serif',
    variants: ['200', '300', '400', '600', '700', '900'],
    subsets: ['latin', 'latin-ext'],
    popularity: 25,
  },
];

/**
 * Get all Google Fonts as CustomFont objects with IDs
 */
export function getAllGoogleFonts(): Array<{
  id: string;
  family: string;
  type: 'google';
  variants: string[];
  category: string;
}> {
  return POPULAR_GOOGLE_FONTS.map(font => ({
    id: `google-${font.family.toLowerCase().replace(/\s+/g, '-')}`,
    family: font.family,
    type: 'google' as const,
    variants: font.variants,
    category: font.category,
  }));
}

/**
 * Search Google Fonts by name
 */
export function searchGoogleFonts(query: string): GoogleFont[] {
  const lowerQuery = query.toLowerCase();
  return POPULAR_GOOGLE_FONTS.filter(font =>
    font.family.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get a font by family name
 */
export function getFontByFamily(family: string): GoogleFont | undefined {
  return POPULAR_GOOGLE_FONTS.find(font => font.family === family);
}

/**
 * Generate Google Fonts CSS import URL
 */
export function getGoogleFontUrl(family: string, variants: string[] = ['400']): string {
  const encodedFamily = family.replace(/ /g, '+');
  const weights = variants.filter(v => /^\d+$/.test(v)).join(';');
  return `https://fonts.googleapis.com/css2?family=${encodedFamily}:wght@${weights}&display=swap`;
}

/**
 * Generate CSS variable name from font family
 */
export function getFontVariableName(family: string): string {
  return `--font-${family.toLowerCase().replace(/\s+/g, '-')}`;
}

/**
 * Generate Tailwind font class name from font family
 */
export function getFontClassName(family: string): string {
  return family.toLowerCase().replace(/\s+/g, '-');
}
