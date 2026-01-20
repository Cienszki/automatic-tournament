// src/lib/themes/index.ts
// Theme definitions for all tournaments

import { TournamentTheme } from '@/types/tournament';
import { FONT_FAMILIES } from './typography';

/**
 * PDL Color Palette
 * Extracted from pdl-s1-logo.png
 * Primary: Deep crimson/maroon (shield color)
 * Secondary: Rich gold (accents and text)
 */
export const PDL_COLORS = {
  // Primary - Deep crimson/maroon (from logo shield)
  primary: '#8B1538',
  primaryHsl: '345 75% 31%',
  primaryLight: '#A91D45',
  primaryLightHsl: '345 70% 39%',
  primaryDark: '#6B102A',
  primaryDarkHsl: '345 75% 24%',
  
  // Secondary - Rich gold (from logo accents)
  gold: '#D4AF37',
  goldHsl: '46 65% 52%',
  goldLight: '#E5C158',
  goldLightHsl: '46 72% 62%',
  goldDark: '#B8952F',
  goldDarkHsl: '46 60% 45%',
  
  // Background - Dark slate with subtle warmth
  bgDark: '#0D0D12',
  bgDarkHsl: '240 17% 6%',
  bgCard: '#151520',
  bgCardHsl: '240 15% 10%',
  bgCardHover: '#1A1A28',
  bgCardHoverHsl: '240 21% 13%',
  bgElevated: '#1E1E2D',
  bgElevatedHsl: '240 21% 15%',
  
  // Text
  textPrimary: '#FFFFFF',
  textPrimaryHsl: '0 0% 100%',
  textSecondary: '#A0A0B0',
  textSecondaryHsl: '240 8% 66%',
  textMuted: '#606070',
  textMutedHsl: '240 8% 41%',
  
  // Borders
  border: '#2A2A3A',
  borderHsl: '240 16% 20%',
  borderLight: '#3A3A4A',
  borderLightHsl: '240 12% 26%',
  
  // Status colors
  success: '#22C55E',
  successHsl: '142 71% 45%',
  warning: '#EAB308',
  warningHsl: '45 93% 47%',
  error: '#EF4444',
  errorHsl: '0 84% 60%',
  info: '#3B82F6',
  infoHsl: '217 91% 60%',
  
  // Division colors (tier-specific)
  divisionElite: '#D4AF37',      // Gold
  divisionEliteHsl: '46 65% 52%',
  divisionChallenger: '#C0C0C0', // Silver
  divisionChallengerHsl: '0 0% 75%',
  divisionAdept: '#CD7F32',      // Bronze
  divisionAdeptHsl: '30 60% 50%',
} as const;

/**
 * Letnia Batalia Color Palette
 * Neon cyberpunk aesthetic
 */
export const LETNIA_COLORS = {
  // Primary - Hot pink (neon)
  primary: '#FF1493',
  primaryHsl: '330 100% 54%',
  primaryLight: '#FF69B4',
  primaryLightHsl: '330 100% 70%',
  primaryDark: '#C71585',
  primaryDarkHsl: '330 82% 44%',
  
  // Secondary - Cyan
  secondary: '#00FFFF',
  secondaryHsl: '180 100% 50%',
  secondaryLight: '#7FFFD4',
  secondaryLightHsl: '160 100% 75%',
  secondaryDark: '#00CED1',
  secondaryDarkHsl: '181 100% 41%',
  
  // Accent - Neon green
  accent: '#39FF14',
  accentHsl: '109 100% 54%',
  
  // Background - Deep purple/black
  bgDark: '#0a0a0f',
  bgDarkHsl: '240 20% 5%',
  bgCard: '#1a1a2e',
  bgCardHsl: '240 27% 14%',
  bgCardHover: '#252540',
  bgCardHoverHsl: '240 25% 20%',
  bgElevated: '#2a2a45',
  bgElevatedHsl: '240 25% 22%',
  
  // Text
  textPrimary: '#FFFFFF',
  textPrimaryHsl: '0 0% 100%',
  textSecondary: '#B0B0C0',
  textSecondaryHsl: '240 14% 72%',
  textMuted: '#707080',
  textMutedHsl: '240 7% 47%',
  
  // Borders
  border: '#3a3a5e',
  borderHsl: '240 24% 30%',
  borderLight: '#4a4a6e',
  borderLightHsl: '240 20% 36%',
} as const;

/**
 * PDL Tournament Theme Configuration
 */
export const PDL_THEME: TournamentTheme = {
  primaryColor: `hsl(${PDL_COLORS.primaryHsl})`,
  secondaryColor: `hsl(${PDL_COLORS.goldHsl})`,
  accentColor: `hsl(${PDL_COLORS.goldLightHsl})`,
  backgroundColor: `hsl(${PDL_COLORS.bgDarkHsl})`,
  backgroundGradient: `linear-gradient(135deg, hsl(${PDL_COLORS.bgDarkHsl}) 0%, hsl(${PDL_COLORS.bgCardHsl}) 100%)`,
  cardColor: `hsl(${PDL_COLORS.bgCardHsl})`,
  textColor: `hsl(${PDL_COLORS.textPrimaryHsl})`,
  mutedTextColor: `hsl(${PDL_COLORS.textSecondaryHsl})`,
  borderColor: `hsl(${PDL_COLORS.borderHsl})`,
  headerFont: FONT_FAMILIES.pdl.heading,
  bodyFont: FONT_FAMILIES.pdl.body,
  logoUrl: '/logos/pdl/pdl-s1-logo.png',
};

/**
 * Letnia Batalia Tournament Theme Configuration
 */
export const LETNIA_THEME: TournamentTheme = {
  primaryColor: `hsl(${LETNIA_COLORS.primaryHsl})`,
  secondaryColor: `hsl(${LETNIA_COLORS.secondaryHsl})`,
  accentColor: `hsl(${LETNIA_COLORS.accentHsl})`,
  backgroundColor: `hsl(${LETNIA_COLORS.bgDarkHsl})`,
  backgroundGradient: `linear-gradient(135deg, hsl(${LETNIA_COLORS.bgDarkHsl}) 0%, hsl(280, 30%, 12%) 100%)`,
  cardColor: `hsl(${LETNIA_COLORS.bgCardHsl})`,
  textColor: `hsl(${LETNIA_COLORS.textPrimaryHsl})`,
  mutedTextColor: `hsl(${LETNIA_COLORS.textSecondaryHsl})`,
  borderColor: `hsl(${LETNIA_COLORS.borderHsl})`,
  headerFont: 'var(--font-neon-bines)',
  bodyFont: 'var(--font-space-mono)',
  logoUrl: '/logos/letnia/letnia-logo.png',
};

/**
 * Get CSS custom properties from a theme for dynamic theming
 */
export function getThemeCssVariables(theme: TournamentTheme): Record<string, string> {
  return {
    '--theme-primary': theme.primaryColor,
    '--theme-secondary': theme.secondaryColor,
    '--theme-accent': theme.accentColor,
    '--theme-background': theme.backgroundColor,
    '--theme-background-gradient': theme.backgroundGradient || theme.backgroundColor,
    '--theme-card': theme.cardColor,
    '--theme-text': theme.textColor,
    '--theme-muted': theme.mutedTextColor,
    '--theme-border': theme.borderColor,
    '--theme-header-font': theme.headerFont,
    '--theme-body-font': theme.bodyFont,
  };
}

/**
 * Get theme by tournament slug
 */
export function getThemeBySlug(slug: string): TournamentTheme {
  switch (slug) {
    case 'pdl':
      return PDL_THEME;
    case 'letnia':
      return LETNIA_THEME;
    default:
      return LETNIA_THEME; // Default to Letnia theme
  }
}

export type { TournamentTheme };
