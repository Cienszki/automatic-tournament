// A tournament's theme as CSS custom properties, rendered by the server into the page's HTML
// (ADR-08), so the first paint already has the tournament's colours and no script applies them.
// The names are the ones the old TournamentContext sets on <html>, so view components that read
// `var(--tournament-primary)` work unchanged on both sides. Pure: no React, no database.
//
// WP-08 extends this to every token (fonts from the custom font list, navbar, background image)
// and WP-27 adds the guard rails (contrast, sizes). Here: colours, and fonts given as `var(--…)`.

import type { Theme } from '@/platform/db/schema/json';

export type CssVariables = Record<`--${string}`, string>;

// A value goes into a style attribute. Anything that could end the declaration, open a block or
// load a resource is refused; the variable then falls back to the site's default.
const UNSAFE = /[;{}<>\\]|url\(|expression\(|@import/i;

const safe = (value: string | undefined): string | undefined => {
  const v = value?.trim();
  return v && v.length <= 200 && !UNSAFE.test(v) ? v : undefined;
};

/** Only fonts that are already CSS (`var(--font-x)`); named custom fonts wait for WP-08. */
const cssFont = (value: string | undefined): string | undefined => {
  const v = safe(value);
  return v && /^var\(--[a-z0-9-]+\)$/i.test(v) ? v : undefined;
};

export function themeCssVariables(theme: Theme): CssVariables {
  const c = theme.colors;
  const text = safe(c.text);
  const entries: [`--${string}`, string | undefined][] = [
    ['--tournament-primary', safe(c.primary)],
    ['--tournament-secondary', safe(c.secondary)],
    ['--tournament-accent', safe(c.accent)],
    ['--tournament-background', safe(c.background)],
    ['--tournament-bg-gradient', safe(c.backgroundGradient) ?? safe(c.background)],
    ['--tournament-card', safe(c.card)],
    ['--tournament-text', text],
    ['--tournament-muted', safe(c.mutedText)],
    ['--tournament-border', safe(c.border)],
    ['--tournament-heading', safe(c.heading) ?? text],
    ['--tournament-title', safe(c.title) ?? text],
    ['--tournament-section-header', safe(c.sectionHeader) ?? text],
    ['--tournament-primary-text', safe(c.primaryText) ?? text],
    ['--tournament-secondary-text', safe(c.secondaryText) ?? safe(c.mutedText)],
    ['--tournament-glow', safe(c.glow) ?? safe(c.primary)],
    ['--tournament-header-font', cssFont(theme.fonts.header)],
    ['--tournament-body-font', cssFont(theme.fonts.body)],
  ];
  return Object.fromEntries(entries.filter((e): e is [`--${string}`, string] => e[1] !== undefined)) as CssVariables;
}
