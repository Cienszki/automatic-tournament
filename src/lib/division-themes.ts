/**
 * Division Theme System
 * Predefined themes for divisions with colors, gradients, and styling
 */

export interface DivisionTheme {
  id: string;
  name: string;
  displayName: string;
  primaryColor: string;
  secondaryColor?: string;
  accentColor?: string;
  gradient?: string;
  hoverGradient?: string;
  textColor?: string;
  description?: string;
}

/**
 * Predefined division themes
 * Based on existing PDL divisions + new themed divisions
 */
export const DIVISION_THEMES: Record<string, DivisionTheme> = {
  // EXISTING PDL THEMES (from current implementation)
  'pdl-elite': {
    id: 'pdl-elite',
    name: 'PDL Elite',
    displayName: 'Elite (Classic)',
    primaryColor: '#8B1538',
    secondaryColor: '#A91D45',
    accentColor: '#CF2648',
    gradient: 'linear-gradient(135deg, #8B1538 0%, #A91D45 50%, #CF2648 100%)',
    hoverGradient: 'linear-gradient(135deg, #A91D45 0%, #CF2648 50%, #E6356F 100%)',
    textColor: '#FFFFFF',
    description: 'Deep crimson theme - professional and prestigious',
  },
  
  'pdl-challenger': {
    id: 'pdl-challenger',
    name: 'PDL Challenger',
    displayName: 'Challenger (Classic)',
    primaryColor: '#1E3A8A',
    secondaryColor: '#2563EB',
    accentColor: '#3B82F6',
    gradient: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 50%, #3B82F6 100%)',
    hoverGradient: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 50%, #60A5FA 100%)',
    textColor: '#FFFFFF',
    description: 'Royal blue theme - competitive and bold',
  },
  
  'pdl-adept': {
    id: 'pdl-adept',
    name: 'PDL Adept',
    displayName: 'Adept (Classic)',
    primaryColor: '#065F46',
    secondaryColor: '#059669',
    accentColor: '#10B981',
    gradient: 'linear-gradient(135deg, #065F46 0%, #059669 50%, #10B981 100%)',
    hoverGradient: 'linear-gradient(135deg, #059669 0%, #10B981 50%, #34D399 100%)',
    textColor: '#FFFFFF',
    description: 'Emerald green theme - growth and potential',
  },

  // NEW THEMED DIVISIONS (based on elite.png, challenger.png, adept.png)
  'elite-gold': {
    id: 'elite-gold',
    name: 'Elite Rainbow',
    displayName: 'Elite (Rainbow)',
    primaryColor: '#EC4899',
    secondaryColor: '#3B82F6',
    accentColor: '#06B6D4',
    gradient: 'linear-gradient(135deg, #EC4899 0%, #FBBF24 25%, #06B6D4 75%, #3B82F6 100%)',
    hoverGradient: 'linear-gradient(135deg, #F472B6 0%, #FCD34D 25%, #22D3EE 75%, #60A5FA 100%)',
    textColor: '#FFFFFF',
    description: 'Vibrant rainbow gradient - ultimate prestige',
  },
  
  'challenger-silver': {
    id: 'challenger-silver',
    name: 'Challenger Wings',
    displayName: 'Challenger (Wings)',
    primaryColor: '#475569',
    secondaryColor: '#64748B',
    accentColor: '#F97316',
    gradient: 'linear-gradient(135deg, #475569 0%, #64748B 40%, #94A3B8 60%, #F97316 100%)',
    hoverGradient: 'linear-gradient(135deg, #64748B 0%, #94A3B8 40%, #CBD5E1 60%, #FB923C 100%)',
    textColor: '#FFFFFF',
    description: 'Steel blue with fiery orange wings - competitive spirit',
  },
  
  'adept-bronze': {
    id: 'adept-bronze',
    name: 'Adept Bronze',
    displayName: 'Adept (Bronze)',
    primaryColor: '#C2410C',
    secondaryColor: '#EA580C',
    accentColor: '#FB923C',
    gradient: 'linear-gradient(135deg, #9A3412 0%, #C2410C 30%, #EA580C 60%, #FB923C 100%)',
    hoverGradient: 'linear-gradient(135deg, #C2410C 0%, #EA580C 30%, #FB923C 60%, #FDBA74 100%)',
    textColor: '#FFFFFF',
    description: 'Warm bronze-copper tones - rising champions',
  },
};

/**
 * Get theme by ID
 */
export function getDivisionTheme(themeId?: string): DivisionTheme | null {
  if (!themeId) return null;
  return DIVISION_THEMES[themeId] || null;
}

/**
 * Get all available themes as array
 */
export function getAllDivisionThemes(): DivisionTheme[] {
  return Object.values(DIVISION_THEMES);
}

/**
 * Get theme color (with fallback)
 */
export function getThemeColor(themeId?: string, fallbackColor: string = '#666666'): string {
  const theme = getDivisionTheme(themeId);
  return theme?.primaryColor || fallbackColor;
}

/**
 * Get theme gradient (with fallback)
 */
export function getThemeGradient(themeId?: string, fallbackColor: string = '#666666'): string {
  const theme = getDivisionTheme(themeId);
  return theme?.gradient || `linear-gradient(135deg, ${fallbackColor} 0%, ${fallbackColor} 100%)`;
}
