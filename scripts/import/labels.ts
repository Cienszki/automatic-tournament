// Readable names for matches and games in the import's findings (owner, STATUS.md question 42;
// CONVENTIONS.md): tournament, stage and round, the two teams, the date and the score, then the
// id in brackets. Ids are random Firestore strings and tell the owner nothing by themselves.
// Built from the mapped rows, so it names a match as the new database holds it.

import * as s from '@/platform/db/schema';
import type { Row, RowSet } from './rows';
import { WARSAW } from './values';

const dateFormat = new Intl.DateTimeFormat('en-GB', { timeZone: WARSAW, day: 'numeric', month: 'long', year: 'numeric' });
const clockFormat = new Intl.DateTimeFormat('en-GB', { timeZone: WARSAW, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

const SIDE_NAMES: Record<string, string> = {
  upper: 'upper bracket', lower: 'lower bracket', final: 'final', wildcard: 'wildcard round', third_place: 'third-place match',
};

const asDate = (v: unknown): Date | null => (v instanceof Date ? v : null);

export class MatchLabels {
  private readonly matches: Map<string, Row>;
  private readonly teams: Map<string, string>;
  private readonly stages: Map<string, Row>;
  private readonly groups: Map<string, string>;
  private readonly games: Row[];
  private readonly tournament: string;

  constructor(rows: RowSet, fallbackName: string) {
    this.matches = new Map(rows.get(s.matches).map((m) => [m.id as string, m]));
    this.teams = new Map(rows.get(s.teams).map((t) => [t.id as string, String(t.name).trim()]));
    this.stages = new Map(rows.get(s.stages).map((st) => [st.id as string, st]));
    this.groups = new Map(rows.get(s.groups).map((g) => [g.id as string, String(g.name)]));
    this.games = rows.get(s.games);
    const [tournament] = rows.get(s.tournaments);
    this.tournament = typeof tournament?.name === 'string' ? tournament.name : fallbackName;
  }

  has(matchId: string): boolean {
    return this.matches.has(matchId);
  }

  /** `Wiosenna Furia, Grupa B, 24 June 2026, Chrupek zamknij się vs Adaś, ile za tę Robotę?, 1:1 (HVwwRd87bSFsCzkph25p)` */
  match(matchId: string): string {
    const m = this.matches.get(matchId);
    return m ? `${this.core(m)} (${matchId})` : `match ${matchId} (not imported)`;
  }

  /** The match's label with the game: `…, 1:2, game 3 (Dota 8910469903 at 23:13; match ub-r3-p1)`. */
  game(matchId: string, gameRef: string): string {
    const game = this.gameRow(matchId, gameRef);
    const m = this.matches.get((game?.matchId as string | undefined) ?? matchId);
    if (!m) return `game ${gameRef} of match ${matchId} (not imported)`;
    const start = asDate(game?.startedAt);
    const what = game?.dotaMatchId ? `Dota ${String(game.dotaMatchId)}${start ? ` at ${clockFormat.format(start)}` : ''}` : `forfeited game`;
    const number = game ? `, game ${String(game.number)}` : '';
    return `${this.core(m)}${number} (${what}; match ${String(m.id)})`;
  }

  /** A game by its row id or source document id; real games keep their Dota id, forfeits are renamed. */
  private gameRow(matchId: string, ref: string): Row | undefined {
    const forfeit = /^forfeit_game(\d+)$/.exec(ref);
    const id = forfeit ? `${matchId}-forfeit-${forfeit[1]}` : ref;
    return this.games.find((g) => g.id === id);
  }

  private core(m: Row): string {
    const team = (id: unknown) => (typeof id === 'string' ? this.teams.get(id) ?? id : 'TBD');
    const parts = [this.tournament, this.stagePart(m), this.datePart(m), `${team(m.teamAId)} vs ${team(m.teamBId)}`, scorePart(m)];
    return parts.filter(Boolean).join(', ');
  }

  private stagePart(m: Row): string {
    const stage = this.stages.get(m.stageId as string);
    if (m.bracketSide) {
      const side = SIDE_NAMES[m.bracketSide as string] ?? String(m.bracketSide);
      const round = m.bracketSide === 'final' || m.bracketSide === 'third_place' ? '' : ` round ${String(m.round)}`;
      return `${side}${round}${m.code ? ` (${String(m.code)})` : ''}`;
    }
    const group = m.groupId ? this.groups.get(m.groupId as string) : undefined;
    const where = group ?? (stage?.name as string | undefined) ?? '';
    if (m.matchday) return `${where}, matchday ${String(m.matchday)}`;
    if (stage?.kind === 'swiss') return `${where}, round ${String(m.round)}`;
    return where;
  }

  /** The day it was played: its first game, else its scheduled time, else its completion. */
  private datePart(m: Row): string {
    const starts = this.games.filter((g) => g.matchId === m.id).map((g) => asDate(g.startedAt)).filter((d): d is Date => d !== null);
    const first = starts.length ? new Date(Math.min(...starts.map((d) => d.getTime()))) : null;
    const when = first ?? asDate(m.scheduledAt) ?? asDate(m.completedAt);
    return when ? dateFormat.format(when) : 'no date';
  }
}

function scorePart(m: Row): string {
  if (m.status === 'bye') return 'bye';
  if (m.scoreA === null || m.scoreA === undefined || m.scoreB === null || m.scoreB === undefined) return 'not played';
  return `${String(m.scoreA)}:${String(m.scoreB)}`;
}

/**
 * The match (and game) a finding's reference names, from a Firestore path in it
 * (`…/matches/{id}/games/{game}/…`, `…/playoff_matches/{id}`) or a leading match id.
 */
export function subjectOf(ref: string | undefined): { matchId: string; game?: string } | null {
  if (!ref) return null;
  const path = /(?:^|\/)(?:matches|playoff_matches)\/([^/\s]+)(?:\/games\/([^/\s]+))?/.exec(ref);
  if (path) return path[2] ? { matchId: path[1], game: path[2] } : { matchId: path[1] };
  return null;
}
