// src/lib/reschedule-rules.ts
// Which new times a captain may propose for a match. Everything goes through one policy: the
// captain's date picker, the hint above it, the live error under it, and the checks when the
// request is sent and when the opponent approves it — so they can never disagree.
//
// A policy is a list of rules. Each rule bounds the proposed time from below or above and knows how
// to say so (what it allows, and why a time breaks it). The match's own limit wins over the
// tournament-wide ones:
//   1. Match.rescheduleLatest — the round's latest time (Swiss rounds): any time up to it.
//   2. Match.rescheduleMaxHoursLater — older Swiss rounds: any earlier time, or at most N hours later.
//   3. Otherwise the tournament settings: "earlier only" and ±N days around the original date
//      (Tournament.rescheduleEarlierOnly / rescheduleRangeDays, the range defaulting to 3 days).
// Always on top: never in the past, a match's own deadline (window rounds, Match.deadline) and the
// tournament's final date (Tournament.rescheduleFinalDate).
//
// A new kind of limit = a new RescheduleRuleKind plus the rules it adds in reschedulePolicy();
// the picker bounds, hints and error messages follow from the rule.

export type RescheduleRuleKind =
  | 'past'
  | 'round-latest'
  | 'hours-later'
  | 'earlier-only'
  | 'range'
  | 'match-deadline'
  | 'final-date';

export interface RescheduleRule {
  kind: RescheduleRuleKind;
  /** 'min': the new time must be after `at`; 'max': not after `at` (before it when `strict`) */
  bound: 'min' | 'max';
  at: Date;
  strict?: boolean;
  /** For the captain: what this rule allows */
  describe: string;
  /** For the captain: why a proposed time breaks it */
  violation: string;
}

export interface ReschedulePolicy {
  rules: RescheduleRule[];
  /** Earliest and latest allowed times (null = no upper limit), for the date picker */
  earliest: Date;
  latest: Date | null;
  /** What the captain may do, one sentence per rule (no duplicates) */
  summary: string[];
}

export interface ReschedulePolicyInput {
  /** The match's first scheduled time (kept on earlier requests, so limits can't be chained); '' = none yet */
  originalIso: string;
  tournament?: {
    rescheduleRangeDays?: number | null;
    rescheduleFinalDate?: string | null;
    rescheduleEarlierOnly?: boolean;
  } | null;
  match?: {
    deadline?: string | null;
    rescheduleMaxHoursLater?: number | null;
    rescheduleLatest?: string | null;
  } | null;
  now?: Date;
}

/** Default ±days range when the tournament never set one */
export const DEFAULT_RESCHEDULE_RANGE_DAYS = 3;

const valid = (d: Date) => !Number.isNaN(d.getTime());
const endOfDay = (iso: string) => { const d = new Date(iso); d.setHours(23, 59, 59, 999); return d; };
const dayShift = (d: Date, days: number, end: boolean) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
  if (end) x.setHours(23, 59, 59, 999);
  return x;
};

/** "śr. 4 lis, 20:00" */
export function formatRescheduleTime(d: Date): string {
  return d.toLocaleString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
/** "śr. 4 lis" */
export function formatRescheduleDay(d: Date): string {
  return d.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' });
}
const daysWord = (n: number) => (n === 1 ? 'dzień' : 'dni');

export function reschedulePolicy({ originalIso, tournament, match, now = new Date() }: ReschedulePolicyInput): ReschedulePolicy {
  const rules: RescheduleRule[] = [];
  const original = originalIso ? new Date(originalIso) : null;
  const hasOriginal = !!original && valid(original);

  rules.push({
    kind: 'past', bound: 'min', at: now, strict: true,
    describe: '',
    violation: 'Ten termin już minął — wybierz termin w przyszłości.',
  });

  const latest = match?.rescheduleLatest ? new Date(match.rescheduleLatest) : null;
  const hours = match?.rescheduleMaxHoursLater;
  if (latest && valid(latest)) {
    rules.push({
      kind: 'round-latest', bound: 'max', at: latest,
      describe: `Możesz zaproponować dowolny termin najpóźniej do ${formatRescheduleTime(latest)} — to ostatni termin dla meczów tej rundy.`,
      violation: `Mecze tej rundy można przełożyć najpóźniej na ${formatRescheduleTime(latest)}.`,
    });
  } else if (hasOriginal && hours != null) {
    if (hours <= 0) {
      rules.push({
        kind: 'earlier-only', bound: 'max', at: original!, strict: true,
        describe: `Mecz można przełożyć wyłącznie na termin wcześniejszy niż ${formatRescheduleTime(original!)}.`,
        violation: `Nowy termin musi być wcześniejszy niż ${formatRescheduleTime(original!)}.`,
      });
    } else {
      const at = new Date(original!.getTime() + hours * 3_600_000);
      rules.push({
        kind: 'hours-later', bound: 'max', at,
        describe: `Możesz przełożyć mecz na dowolny wcześniejszy termin albo najwyżej o ${hours} h później — najpóźniej na ${formatRescheduleTime(at)}.`,
        violation: `Mecz można przełożyć najpóźniej na ${formatRescheduleTime(at)} (najwyżej ${hours} h po terminie ustalonym przez organizatora).`,
      });
    }
  } else if (hasOriginal) {
    if (tournament?.rescheduleEarlierOnly) {
      rules.push({
        kind: 'earlier-only', bound: 'max', at: original!, strict: true,
        describe: `Mecz można przełożyć wyłącznie na termin wcześniejszy niż ${formatRescheduleTime(original!)}.`,
        violation: `Zgodnie z regulaminem nowy termin musi być wcześniejszy niż ${formatRescheduleTime(original!)}.`,
      });
    }
    const range = tournament?.rescheduleRangeDays === undefined ? DEFAULT_RESCHEDULE_RANGE_DAYS : tournament.rescheduleRangeDays;
    if (range != null) {
      const from = dayShift(original!, -range, false);
      const to = dayShift(original!, range, true);
      const describe = `Nowy termin musi mieścić się w zakresie ±${range} ${daysWord(range)} od pierwotnej daty meczu (${formatRescheduleDay(from)} – ${formatRescheduleDay(to)}).`;
      const violation = `Zmiana terminu jest dozwolona tylko w zakresie ±${range} ${daysWord(range)} od pierwotnej daty meczu, czyli od ${formatRescheduleDay(from)} do ${formatRescheduleDay(to)}.`;
      rules.push({ kind: 'range', bound: 'min', at: from, describe, violation });
      rules.push({ kind: 'range', bound: 'max', at: to, describe, violation });
    }
  }

  if (match?.deadline) {
    const at = endOfDay(match.deadline);
    if (valid(at)) rules.push({
      kind: 'match-deadline', bound: 'max', at,
      describe: `Mecz musi zostać rozegrany najpóźniej ${formatRescheduleDay(at)}.`,
      violation: `Ten mecz musi zostać rozegrany najpóźniej ${formatRescheduleDay(at)}.`,
    });
  }
  if (tournament?.rescheduleFinalDate) {
    const at = endOfDay(tournament.rescheduleFinalDate);
    if (valid(at)) rules.push({
      kind: 'final-date', bound: 'max', at,
      describe: `Ostateczny termin rozegrania meczów: ${formatRescheduleDay(at)}.`,
      violation: `Proponowany termin przekracza ostateczny termin rozegrania meczów (${formatRescheduleDay(at)}).`,
    });
  }

  const mins = rules.filter(r => r.bound === 'min');
  const maxes = rules.filter(r => r.bound === 'max');
  const earliest = new Date(Math.max(...mins.map(r => r.at.getTime())));
  const latestAt = maxes.length ? new Date(Math.min(...maxes.map(r => r.at.getTime()))) : null;
  const summary = [...new Set(rules.map(r => r.describe).filter(Boolean))];
  if (!summary.length) summary.push('Możesz zaproponować dowolny przyszły termin.');
  return { rules, earliest, latest: latestAt, summary };
}

/** The first rule a proposed time breaks, or null when it's allowed */
export function checkReschedule(policy: ReschedulePolicy, proposedIso: string): RescheduleRule | null {
  const t = new Date(proposedIso).getTime();
  if (Number.isNaN(t)) return policy.rules[0];
  // in policy order: "already passed" first, then the match's own limit, then the general ones
  for (const r of policy.rules) {
    const at = r.at.getTime();
    const ok = r.bound === 'min' ? (r.strict ? t > at : t >= at) : (r.strict ? t < at : t <= at);
    if (!ok) return r;
  }
  return null;
}
