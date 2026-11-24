// The tournament's theme as CSS variables on a wrapper, in the server's HTML (ADR-08). On a wrapper
// and not on <html>: the old TournamentProvider in the root layout still writes its default theme
// onto <html> after hydration, and the nearer declaration wins. WP-08 moves this to the layout.
// Without a gradient the variable holds a plain colour, which is not a valid background image, so
// the background colour shows.

import type { Theme } from '@/platform/db/schema/json';
import { themeCssVariables } from '../domain/theme';

export function TournamentTheme({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return (
    <div
      data-tournament-theme=""
      style={themeCssVariables(theme) as React.CSSProperties}
      className="min-h-screen text-[var(--tournament-text)]"
    >
      <div className="fixed inset-0 -z-10 bg-[var(--tournament-background)] [background-image:var(--tournament-bg-gradient)]" />
      {children}
    </div>
  );
}
