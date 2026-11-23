// The JSON columns of a seed tournament: a plain dark theme and today's ordinary settings. Typed
// with the columns' zod input types, so a value the schema would refuse does not compile.

import type { z } from 'zod';
import type {
  featuresSchema, presentationSchema, settingsSchema, themeSchema,
} from '../../src/platform/db/schema/json/tournament';

export type ThemeInput = z.input<typeof themeSchema>;
export type PresentationInput = z.input<typeof presentationSchema>;
export type SettingsInput = z.input<typeof settingsSchema>;
export type FeaturesInput = z.input<typeof featuresSchema>;

export function defaultTheme(primary = '#d4af37'): ThemeInput {
  return {
    version: 1,
    colors: {
      primary, secondary: '#1a1a2e', accent: '#e94560', background: '#0f0f1a', card: '#16213e',
      text: '#ffffff', mutedText: '#a0a0b0', border: '#2a2a40',
    },
    fonts: { header: 'Inter', body: 'Inter', custom: [] },
    background: {},
    navbar: { style: 'blur', opacity: 80, blur: 12 },
    card: { opacity: 90, radius: '0.75rem' },
    mode: 'dark',
    logos: {},
  };
}

export function defaultPresentation(title: string): PresentationInput {
  return {
    hero: { title, layout: 'logo-promo' },
    sponsor: { enabled: false, slides: [] },
    links: {},
    prizesPage: {},
  };
}

export function defaultSettings(options: { registrationOpen: boolean; mmrCap?: number }): SettingsInput {
  return {
    registration: { enabled: options.registrationOpen, requireApproval: true },
    teams: { size: 5, maxSubstitutes: 1, mmrCap: options.mmrCap, mmrVerification: options.mmrCap !== undefined, coachMode: 'disabled' },
    scheduling: { method: 'captain', rescheduleRangeDays: 3 },
    standins: {
      enabled: true, requireRegistration: true, requireOpponentApproval: true, adminCanOverride: true,
      maxPerMatch: 1, mmrRestrictions: options.mmrCap !== undefined,
    },
    transfers: { windowOpen: false },
    discord: {},
    lobby: { server: 'EU West' },
  };
}

export function defaultFeatures(): FeaturesInput {
  return {
    fantasy: { enabled: false, type: 'round-based', rosterSize: 5, budget: 100, lockBeforeMatchday: true },
    pickem: {
      enabled: false, matchPredictions: true, standingsPredictions: false, playoffBracket: false,
      mvpPredictions: false, lockTime: 'before-round',
    },
    cards: { enabled: false, roundPacks: 3, twitchChannels: [] },
    prizes: { enabled: false },
  };
}
