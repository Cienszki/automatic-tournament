// src/lib/reschedule-rules.ts
// Validation of captain reschedule requests against the tournament's reschedule settings
// (Tournament.rescheduleRangeDays / rescheduleFinalDate / rescheduleEarlierOnly). Used when a
// captain sends a request and again when the opponent approves it.

/** Proposed date within ±rangeDays calendar days of the reference date (null/undefined = unlimited). */
export function isWithinRescheduleDays(
  referenceIso: string,
  proposedIso: string,
  rangeDays: number | null | undefined,
): boolean {
  if (rangeDays === null || rangeDays === undefined) return true;

  const referenceDate = new Date(referenceIso);
  const proposedDate = new Date(proposedIso);
  if (Number.isNaN(referenceDate.getTime()) || Number.isNaN(proposedDate.getTime())) return false;

  // Compare by calendar day (local time) to avoid timezone edge-case rejections.
  const refDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const propDay = new Date(proposedDate.getFullYear(), proposedDate.getMonth(), proposedDate.getDate());
  const diffDays = Math.round((propDay.getTime() - refDay.getTime()) / (1000 * 60 * 60 * 24));
  return Math.abs(diffDays) <= rangeDays;
}

/** Proposed date on or before the end of the final-deadline day (no deadline = always ok). */
export function isBeforeFinalDeadline(proposedIso: string, finalDate: string | null | undefined): boolean {
  if (!finalDate) return true;
  const proposed = new Date(proposedIso);
  const deadline = new Date(finalDate);
  deadline.setHours(23, 59, 59, 999);
  return proposed <= deadline;
}

/** "Earlier only" rule: the new time must be strictly before the originally scheduled time. */
export function isEarlierThanOriginal(originalIso: string, proposedIso: string): boolean {
  const original = new Date(originalIso);
  const proposed = new Date(proposedIso);
  if (Number.isNaN(original.getTime()) || Number.isNaN(proposed.getTime())) return false;
  return proposed.getTime() < original.getTime();
}

export interface RescheduleSettings {
  rangeDays: number | null | undefined;
  finalDate: string | null | undefined;
  earlierOnly: boolean;
}

export type RescheduleViolation = 'range' | 'deadline' | 'earlier-only';

/**
 * First rule a proposed date breaks, or null when it's allowed. Range and "earlier only" are
 * anchored to the original scheduled date and skipped when the match has none yet.
 */
export function checkRescheduleProposal(
  originalIso: string,
  proposedIso: string,
  { rangeDays, finalDate, earlierOnly }: RescheduleSettings,
): RescheduleViolation | null {
  const hasScheduledDate = !!originalIso;
  if (hasScheduledDate && earlierOnly && !isEarlierThanOriginal(originalIso, proposedIso)) return 'earlier-only';
  if (hasScheduledDate && !isWithinRescheduleDays(originalIso, proposedIso, rangeDays)) return 'range';
  if (!isBeforeFinalDeadline(proposedIso, finalDate)) return 'deadline';
  return null;
}
