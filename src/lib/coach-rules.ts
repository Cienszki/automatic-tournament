// src/lib/coach-rules.ts
// What each `Tournament.coachMode` means, and when a captain may change the coach.
// Used by the admin settings (explanations), the captain's "Moja drużyna" page (editing + locks)
// and the public team cards (display).

import type { CoachMode, TournamentStatus } from '@/types/tournament';

/** Coach changes close this long before a team's scheduled match. */
export const COACH_CHANGE_LOCK_HOURS = 24;
/** A match that has started but isn't completed keeps the lock for this long after its start time. */
const STARTED_MATCH_GRACE_HOURS = 6;
const HOUR = 60 * 60 * 1000;

export const COACH_MODE_OPTIONS: { value: CoachMode; label: string; description: string }[] = [
  {
    value: 'disabled',
    label: 'Wyłączeni',
    description: 'Drużyny nie mogą zgłaszać trenerów — sekcja trenera jest ukryta u kapitanów i na kartach drużyn.',
  },
  {
    value: 'pre-season',
    label: 'Zgłaszani przed sezonem',
    description:
      'Każda drużyna może mieć jednego trenera (kapitan podaje tylko jego nick). Kapitan może go dodać, zmienić lub usunąć tylko przed startem turnieju (status „Rejestracja”). Po starcie trener jest zablokowany do końca sezonu. Trener jest widoczny na karcie drużyny.',
  },
  {
    value: 'per-game',
    label: 'Zgłaszani do każdego meczu',
    description:
      'Kapitan zgłasza trenera osobno do każdego meczu (nick, opcjonalnie profil Steam), najpóźniej 24 h przed jego terminem. Mecz bez zgłoszenia drużyna gra bez trenera.',
  },
  {
    value: 'flexible',
    label: 'Elastycznie',
    description:
      'Każda drużyna może mieć jednego trenera (kapitan podaje tylko jego nick, bez dodatkowych wymagań). Trener obowiązuje do czasu zmiany. Kapitan może go dodać, zmienić lub usunąć w dowolnym momencie — z wyjątkiem 24 h przed zaplanowanym meczem drużyny (do czasu jego rozegrania). Trener jest widoczny na karcie drużyny.',
  },
];

export function coachModeOption(mode: CoachMode | null | undefined) {
  return COACH_MODE_OPTIONS.find(o => o.value === mode) ?? null;
}

/** One coach kept on the team document (`team.coach`) instead of per match. */
export function isTeamLevelCoachMode(mode: CoachMode | null | undefined): boolean {
  return mode === 'pre-season' || mode === 'flexible';
}

/**
 * Coach reported per match (`match.coachInfo`). Tournament docs from before `coachMode`
 * existed keep the old behaviour: per-match coaches in leagues only.
 */
export function isPerMatchCoachMode(mode: CoachMode | null | undefined, isLeague: boolean): boolean {
  return mode ? mode === 'per-game' : isLeague;
}

/** Whether coaches show up at all (team cards etc.). */
export function coachesEnabled(mode: CoachMode | null | undefined, isLeague: boolean): boolean {
  return mode ? mode !== 'disabled' : isLeague;
}

/** True when `matchIso` is less than 24 h away, or started but presumably still being played. */
export function isWithinCoachLock(matchIso: string | null | undefined, now: number = Date.now()): boolean {
  if (!matchIso) return false;
  const start = new Date(matchIso).getTime();
  if (Number.isNaN(start)) return false;
  const diff = start - now;
  return diff < COACH_CHANGE_LOCK_HOURS * HOUR && diff > -STARTED_MATCH_GRACE_HOURS * HOUR;
}

export interface CoachLock {
  locked: boolean;
  /** Why changes are blocked, shown to the captain */
  reason: string | null;
}

const UNLOCKED: CoachLock = { locked: false, reason: null };

/**
 * Can the captain change the team-level coach right now?
 * - pre-season: only while the tournament hasn't started (draft / registration)
 * - flexible: always, except within 24 h before any of the team's scheduled, not completed matches
 */
export function teamCoachLock(
  mode: CoachMode | null | undefined,
  { tournamentStatus, upcomingMatchTimes, now = Date.now() }: {
    tournamentStatus: TournamentStatus | string | undefined;
    /** scheduledFor of the team's matches that aren't completed */
    upcomingMatchTimes: (string | null | undefined)[];
    now?: number;
  },
): CoachLock {
  if (mode === 'pre-season') {
    const started = tournamentStatus !== 'draft' && tournamentStatus !== 'registration';
    return started
      ? { locked: true, reason: 'Trenera można było zmieniać tylko przed startem turnieju.' }
      : UNLOCKED;
  }
  if (mode === 'flexible') {
    const blocking = upcomingMatchTimes
      .filter((t): t is string => !!t && isWithinCoachLock(t, now))
      .sort()[0];
    if (blocking) {
      const when = new Date(blocking).toLocaleString('pl-PL', {
        weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
      });
      return {
        locked: true,
        reason: `Do meczu (${when}) zostało mniej niż ${COACH_CHANGE_LOCK_HOURS} h — trenera zmienisz po jego rozegraniu.`,
      };
    }
    return UNLOCKED;
  }
  return UNLOCKED;
}
