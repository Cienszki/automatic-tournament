// What a match counts towards. Matches the admin adds after the schedule was planned (tiebreaks,
// showmatches, rematches — Admin → Mecze → "Dodaj mecz") and matches they replace follow these rules:
//
//   extra (tiebreak / showmatch / other)  shown everywhere, player stats yes, standings / Swiss no
//   rematch                               takes the replaced match's place everywhere
//   replaced original                     shown (marked "powtórzony"), counts nowhere
//
// Every consumer that turns results into tables or stats goes through these helpers.

import type { ExtraMatchKind } from './definitions';

interface Flags {
  extra?: { kind?: ExtraMatchKind | string } | null;
  replacedByMatchId?: string | null;
}

export const EXTRA_KIND_LABEL: Record<ExtraMatchKind, string> = {
  tiebreak: 'Tiebreaker',
  rematch: 'Powtórka',
  showmatch: 'Showmatch',
  other: 'Dodatkowy mecz',
};

/** Does the result count in standings, Swiss records and pairings? */
export function countsForStandings(m: Flags): boolean {
  if (m.replacedByMatchId) return false;
  if (m.extra && m.extra.kind !== 'rematch') return false;
  return true;
}

/** Do its games count in player and team stats? (Everything except a replayed original.) */
export function countsForStats(m: Flags): boolean {
  return !m.replacedByMatchId;
}

/** Short tag for schedule rows and lists, or null for an ordinary match */
export function extraTag(m: Flags & { extra?: { kind?: string; note?: string } | null }): string | null {
  if (m.replacedByMatchId) return 'Powtórzony';
  if (!m.extra?.kind) return null;
  const label = EXTRA_KIND_LABEL[m.extra.kind as ExtraMatchKind] ?? 'Dodatkowy mecz';
  return m.extra.note ? `${label} · ${m.extra.note}` : label;
}
