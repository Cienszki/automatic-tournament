// src/lib/themes/typography.ts
// Typography system with fluid scale

/**
 * Fluid Typography Scale
 * Uses CSS clamp() for responsive font sizing
 * Format: clamp(min, preferred, max)
 */
export const TYPOGRAPHY_SCALE = {
  // Extra small - fine print, labels
  xs: 'clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)',
  
  // Small - secondary text, captions
  sm: 'clamp(0.875rem, 0.825rem + 0.25vw, 1rem)',
  
  // Base - body text
  base: 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)',
  
  // Large - lead paragraphs, emphasis
  lg: 'clamp(1.125rem, 1.05rem + 0.375vw, 1.25rem)',
  
  // XL - section subheadings
  xl: 'clamp(1.25rem, 1.15rem + 0.5vw, 1.5rem)',
  
  // 2XL - card titles, smaller headings
  '2xl': 'clamp(1.5rem, 1.35rem + 0.75vw, 1.875rem)',
  
  // 3XL - page section titles
  '3xl': 'clamp(1.875rem, 1.65rem + 1.125vw, 2.25rem)',
  
  // 4XL - page titles
  '4xl': 'clamp(2.25rem, 1.9rem + 1.75vw, 3rem)',
  
  // 5XL - hero titles
  '5xl': 'clamp(3rem, 2.4rem + 3vw, 4rem)',
  
  // 6XL - display text
  '6xl': 'clamp(3.75rem, 2.85rem + 4.5vw, 5rem)',
} as const;

/**
 * Font Family Definitions
 */
export const FONT_FAMILIES = {
  // PDL fonts - Professional, clean
  pdl: {
    heading: 'var(--font-logik)',
    body: 'var(--font-geist-sans)',
    mono: 'var(--font-geist-mono)',
  },
  
  // Letnia fonts - Cyberpunk, retro
  letnia: {
    heading: 'var(--font-neon-bines)',
    body: 'var(--font-space-mono)',
    mono: 'var(--font-space-mono)',
  },
  
  // Fallback
  default: {
    heading: 'system-ui, -apple-system, sans-serif',
    body: 'system-ui, -apple-system, sans-serif',
    mono: 'ui-monospace, monospace',
  },
} as const;

/**
 * Line Height Scale
 */
export const LINE_HEIGHTS = {
  none: '1',
  tight: '1.25',
  snug: '1.375',
  normal: '1.5',
  relaxed: '1.625',
  loose: '2',
} as const;

/**
 * Letter Spacing Scale
 */
export const LETTER_SPACING = {
  tighter: '-0.05em',
  tight: '-0.025em',
  normal: '0',
  wide: '0.025em',
  wider: '0.05em',
  widest: '0.1em',
} as const;

/**
 * Font Weight Scale
 */
export const FONT_WEIGHTS = {
  thin: '100',
  extralight: '200',
  light: '300',
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;

/**
 * Typography presets for common text styles
 */
export const TEXT_STYLES = {
  // Display - Hero text
  displayLarge: {
    fontSize: TYPOGRAPHY_SCALE['6xl'],
    lineHeight: LINE_HEIGHTS.tight,
    fontWeight: FONT_WEIGHTS.bold,
    letterSpacing: LETTER_SPACING.tight,
  },
  displayMedium: {
    fontSize: TYPOGRAPHY_SCALE['5xl'],
    lineHeight: LINE_HEIGHTS.tight,
    fontWeight: FONT_WEIGHTS.bold,
    letterSpacing: LETTER_SPACING.tight,
  },
  displaySmall: {
    fontSize: TYPOGRAPHY_SCALE['4xl'],
    lineHeight: LINE_HEIGHTS.tight,
    fontWeight: FONT_WEIGHTS.semibold,
    letterSpacing: LETTER_SPACING.normal,
  },
  
  // Headings
  h1: {
    fontSize: TYPOGRAPHY_SCALE['4xl'],
    lineHeight: LINE_HEIGHTS.tight,
    fontWeight: FONT_WEIGHTS.bold,
    letterSpacing: LETTER_SPACING.tight,
  },
  h2: {
    fontSize: TYPOGRAPHY_SCALE['3xl'],
    lineHeight: LINE_HEIGHTS.snug,
    fontWeight: FONT_WEIGHTS.semibold,
    letterSpacing: LETTER_SPACING.normal,
  },
  h3: {
    fontSize: TYPOGRAPHY_SCALE['2xl'],
    lineHeight: LINE_HEIGHTS.snug,
    fontWeight: FONT_WEIGHTS.semibold,
    letterSpacing: LETTER_SPACING.normal,
  },
  h4: {
    fontSize: TYPOGRAPHY_SCALE.xl,
    lineHeight: LINE_HEIGHTS.normal,
    fontWeight: FONT_WEIGHTS.semibold,
    letterSpacing: LETTER_SPACING.normal,
  },
  h5: {
    fontSize: TYPOGRAPHY_SCALE.lg,
    lineHeight: LINE_HEIGHTS.normal,
    fontWeight: FONT_WEIGHTS.medium,
    letterSpacing: LETTER_SPACING.normal,
  },
  h6: {
    fontSize: TYPOGRAPHY_SCALE.base,
    lineHeight: LINE_HEIGHTS.normal,
    fontWeight: FONT_WEIGHTS.medium,
    letterSpacing: LETTER_SPACING.wide,
  },
  
  // Body text
  bodyLarge: {
    fontSize: TYPOGRAPHY_SCALE.lg,
    lineHeight: LINE_HEIGHTS.relaxed,
    fontWeight: FONT_WEIGHTS.normal,
    letterSpacing: LETTER_SPACING.normal,
  },
  body: {
    fontSize: TYPOGRAPHY_SCALE.base,
    lineHeight: LINE_HEIGHTS.normal,
    fontWeight: FONT_WEIGHTS.normal,
    letterSpacing: LETTER_SPACING.normal,
  },
  bodySmall: {
    fontSize: TYPOGRAPHY_SCALE.sm,
    lineHeight: LINE_HEIGHTS.normal,
    fontWeight: FONT_WEIGHTS.normal,
    letterSpacing: LETTER_SPACING.normal,
  },
  
  // Labels and captions
  label: {
    fontSize: TYPOGRAPHY_SCALE.sm,
    lineHeight: LINE_HEIGHTS.normal,
    fontWeight: FONT_WEIGHTS.medium,
    letterSpacing: LETTER_SPACING.wide,
  },
  caption: {
    fontSize: TYPOGRAPHY_SCALE.xs,
    lineHeight: LINE_HEIGHTS.normal,
    fontWeight: FONT_WEIGHTS.normal,
    letterSpacing: LETTER_SPACING.normal,
  },
  overline: {
    fontSize: TYPOGRAPHY_SCALE.xs,
    lineHeight: LINE_HEIGHTS.normal,
    fontWeight: FONT_WEIGHTS.medium,
    letterSpacing: LETTER_SPACING.widest,
    textTransform: 'uppercase' as const,
  },
  
  // Stats and numbers
  stat: {
    fontSize: TYPOGRAPHY_SCALE['2xl'],
    lineHeight: LINE_HEIGHTS.none,
    fontWeight: FONT_WEIGHTS.bold,
    letterSpacing: LETTER_SPACING.tight,
    fontFamily: 'var(--font-geist-mono)',
  },
  statLabel: {
    fontSize: TYPOGRAPHY_SCALE.xs,
    lineHeight: LINE_HEIGHTS.normal,
    fontWeight: FONT_WEIGHTS.medium,
    letterSpacing: LETTER_SPACING.wide,
    textTransform: 'uppercase' as const,
  },
} as const;

export type TypographyScale = keyof typeof TYPOGRAPHY_SCALE;
export type TextStyle = keyof typeof TEXT_STYLES;
export type FontFamily = keyof typeof FONT_FAMILIES;
