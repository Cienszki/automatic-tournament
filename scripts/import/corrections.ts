// Owner corrections (WP-33b): facts the owner gave about the old data that the data itself gets
// wrong, kept as data in owner-corrections.json and applied on every run. Each entry names its
// target by Firestore ids (tournament slug, match id, Dota match id, roster document id, Steam id)
// and carries a readable label, the reason and the source. A run records, per entry, whether it
// matched a row and what it changed; an entry that matches nothing is a finding, never silent.

import { z } from 'zod';
import raw from './owner-corrections.json';

const steam64 = z.string().regex(/^7656\d{13}$/);
const common = {
  /** Short and stable: the report and the tests refer to it. */
  id: z.string().regex(/^[a-z0-9-]+$/),
  /** Tournament, stage and round, the two teams, the date and the final score (or the player and team). */
  label: z.string().min(10),
  reason: z.string().min(5),
  source: z.string().min(5),
};
const tournament = z.string().min(1);

/** A match's format, score, winner or an organizer's decision over the played games. */
const matchCorrection = z.object({
  ...common,
  kind: z.literal('match'),
  tournament,
  matchId: z.string(),
  set: z.object({
    bestOf: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(5), z.literal(7)]).optional(),
    scoreA: z.number().int().min(0).optional(),
    scoreB: z.number().int().min(0).optional(),
    /** `none` for a draw. */
    winner: z.enum(['a', 'b', 'none']).optional(),
    /** The organizer gave the series to the other side; the played games stay as games. */
    forfeit: z.object({ team: z.enum(['a', 'b']), reason: z.string().min(5) }).optional(),
  }).strict(),
}).strict();

/** Where one Dota game belongs: placement follows it over every other rule. */
const gameCorrection = z.object({
  ...common,
  kind: z.literal('game'),
  tournament,
  dotaMatchId: z.number().int().positive(),
  /** The match the game belongs to. */
  matchId: z.string(),
  /** The match it is wrongly stored under. */
  notMatchId: z.string(),
}).strict();

/** A player who stood in for a team in one match without a roster spot there. */
const standinCorrection = z.object({
  ...common,
  kind: z.literal('standin'),
  tournament,
  matchId: z.string(),
  teamId: z.string(),
  steamId64: steam64,
  nickname: z.string().min(1),
  /** The roster document id of the player they replaced, when known. */
  replacedMemberId: z.string().optional(),
}).strict();

/** A roster entry that left the team. */
const memberCorrection = z.object({
  ...common,
  kind: z.literal('member'),
  tournament,
  memberId: z.string(),
  teamId: z.string(),
  steamId64: steam64,
  set: z.object({ leftAt: z.string().datetime(), leftReason: z.enum(['transfer', 'removed', 'captain_change']) }).strict(),
}).strict();

/** The account of a roster entry whose Steam ids disagree; `confirmed` when the import already chose it. */
const rosterSteamCorrection = z.object({
  ...common,
  kind: z.literal('roster-steam'),
  tournament,
  memberId: z.string(),
  teamId: z.string(),
  steamId64: steam64,
  status: z.enum(['confirmed', 'corrected']),
}).strict();

/** A person's name across tournaments: the global player row of a Steam account. */
const playerCorrection = z.object({
  ...common,
  kind: z.literal('player'),
  steamId64: steam64,
  nickname: z.string().min(1),
  aliases: z.array(z.string()).default([]),
}).strict();

export const correctionSchema = z.discriminatedUnion('kind', [
  matchCorrection, gameCorrection, standinCorrection, memberCorrection, rosterSteamCorrection, playerCorrection,
]);
export const correctionsFileSchema = z.object({ corrections: z.array(correctionSchema) }).strict()
  .superRefine((file, ctx) => {
    const seen = new Set<string>();
    for (const c of file.corrections) {
      if (seen.has(c.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate correction id ${c.id}` });
      seen.add(c.id);
    }
  });

export type Correction = z.infer<typeof correctionSchema>;
export type MatchCorrection = z.infer<typeof matchCorrection>;
export type GameCorrection = z.infer<typeof gameCorrection>;
export type StandinCorrection = z.infer<typeof standinCorrection>;
export type MemberCorrection = z.infer<typeof memberCorrection>;
export type RosterSteamCorrection = z.infer<typeof rosterSteamCorrection>;
export type PlayerCorrection = z.infer<typeof playerCorrection>;

/** The corrections of owner-corrections.json, checked. */
export const OWNER_CORRECTIONS: readonly Correction[] = correctionsFileSchema.parse(raw).corrections;

/** What a run did with one correction. */
export interface CorrectionOutcome {
  id: string;
  label: string;
  /** `applied`: it matched its row (and set what it says, which may already have been so). */
  status: 'applied' | 'unmatched';
  /** What it changed, readable ("score 1:2 → 1:1"); "already so" when the row had the value. */
  change: string;
  reason: string;
  source: string;
}

/**
 * The corrections that concern one tournament, and what became of each. A player correction
 * belongs to every tournament (players are global) and counts as applied in each run that writes
 * the player.
 */
export class CorrectionLog {
  readonly outcomes = new Map<string, CorrectionOutcome>();

  constructor(readonly corrections: readonly Correction[]) {}

  static forTournament(all: readonly Correction[], slug: string): CorrectionLog {
    return new CorrectionLog(all.filter((c) => c.kind === 'player' || c.tournament === slug));
  }

  of<K extends Correction['kind']>(kind: K): Array<Extract<Correction, { kind: K }>> {
    return this.corrections.filter((c): c is Extract<Correction, { kind: K }> => c.kind === kind);
  }

  applied(c: Correction, change: string): void {
    const prev = this.outcomes.get(c.id);
    const text = prev?.status === 'applied' && prev.change !== change ? `${prev.change}; ${change}` : change;
    this.outcomes.set(c.id, { id: c.id, label: c.label, status: 'applied', change: text, reason: c.reason, source: c.source });
  }

  /** Every correction with its outcome; those that matched nothing are `unmatched`, except player corrections for players this tournament never names. */
  finish(): CorrectionOutcome[] {
    return this.corrections.flatMap((c) => {
      const done = this.outcomes.get(c.id);
      if (done) return [done];
      if (c.kind === 'player') return [];
      return [{ id: c.id, label: c.label, status: 'unmatched' as const, change: 'matched no row', reason: c.reason, source: c.source }];
    });
  }
}
