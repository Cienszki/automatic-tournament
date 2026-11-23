// Builds one seed tournament step by step: stages, groups, teams with rosters, matches, and played
// series with their games and performances. The format files (scripts/seed/formats) only decide
// who plays whom and when; the bookkeeping is here.

import { computeStandings, parseRankingRules } from '../../src/features/formats';
import { POSITIONS } from '../../src/platform/db/schema/_columns';
import {
  aGame, aGroup, aMatch, aMember, aPerformance, aPlayer, aStage, aTeam, aTournament, aUser, fakeSteamId,
  SEED_ADMIN_USER_ID, anOrganization,
  type GroupRow, type MatchRow, type StageRow, type TeamRow, type TournamentRow,
} from './builders';
import { nickname, tagOf } from './names';
import { draft as pickDraft, playerLine, seriesGames } from './play';
import type { Random } from './random';
import { emptyWorld, type SeedWorld } from './world';

/** Numbers shared by every tournament of one seed run, so ids and names never collide. */
export interface SeedCounters { player: number; team: number; dotaMatch: number }

export interface DraftContext { random: Random; counters: SeedCounters; now: Date }

const HOUR = 3_600_000;

export class TournamentDraft {
  readonly world: SeedWorld = emptyWorld();
  private readonly rosters = new Map<string, { steamId64: string; position: (typeof POSITIONS)[number] }[]>();
  private readonly strength = new Map<string, number>();

  constructor(readonly ctx: DraftContext, row: Partial<TournamentRow> & { id: string }) {
    this.world.organizations.push(anOrganization());
    this.world.users.push(aUser({ id: SEED_ADMIN_USER_ID, nickname: 'Organizator', displayName: 'Organizator testowy' }));
    this.world.tournaments.push(aTournament(row));
    this.world.tournamentMembers.push({ tournamentId: row.id, userId: SEED_ADMIN_USER_ID, role: 'admin' });
  }

  get id(): string {
    return this.world.tournaments[0].id;
  }

  stage(o: Partial<StageRow> & { id: string; kind: StageRow['kind'] }): string {
    this.world.stages.push(aStage(this.id, { position: this.world.stages.length + 1, ...o }));
    return o.id;
  }

  group(o: Partial<GroupRow> & { id: string; stageId: string }): string {
    const position = this.world.groups.filter((g) => g.stageId === o.stageId).length + 1;
    this.world.groups.push(aGroup(this.id, { position, ...o }));
    return o.id;
  }

  /** Registers teams with a captain, five players and sometimes a substitute. Returns their ids. */
  teams(names: readonly string[], o: { status?: (name: string, i: number) => TeamRow['status']; mmr?: [number, number] } = {}): string[] {
    const { random, counters } = this.ctx;
    return names.map((name, i) => {
      const teamId = `${this.id}-team-${++counters.team}`;
      const captainId = `seed-captain-${counters.team}`;
      this.world.users.push(aUser({ id: captainId, nickname: `Kapitan ${tagOf(name)}` }));
      this.world.teams.push(aTeam(this.id, {
        id: teamId, name, tag: tagOf(name), captainUserId: captainId, status: o.status?.(name, i) ?? 'verified',
        seedMmr: o.mmr ? random.int(o.mmr[0], o.mmr[1]) : null,
      }));
      const roster = POSITIONS.map((position) => ({ position, kind: 'player' as const }));
      if (random.chance(0.4)) roster.push({ position: random.pick(POSITIONS), kind: 'player' });
      this.rosters.set(teamId, []);
      roster.forEach((slot, j) => {
        const n = ++counters.player;
        const steamId64 = fakeSteamId(n);
        const nick = nickname(n);
        this.world.players.push(aPlayer({ steamId64, nickname: nick }));
        this.world.teamMembers.push(aMember(this.id, {
          id: `${teamId}-p${j + 1}`, teamId, steamId64, nickname: nick, position: slot.position,
          kind: j < 5 ? 'player' : 'substitute', mmr: o.mmr ? random.int(o.mmr[0], o.mmr[1]) : null,
        }));
        if (j < 5) this.rosters.get(teamId)!.push({ steamId64, position: slot.position });
      });
      this.strength.set(teamId, random.next());
      return teamId;
    });
  }

  join(groupId: string, teamIds: string[]): void {
    teamIds.forEach((teamId, i) => this.world.groupTeams.push({ tournamentId: this.id, groupId, teamId, seed: i + 1 }));
  }

  /** Adds a match. Ids (its own and the next-match links) are local: the tournament id is prefixed. */
  match(o: Partial<MatchRow> & { id: string; stageId: string; round: number }): MatchRow {
    const full = (id: string | null | undefined) => (id ? `${this.id}-${id}` : id);
    const row = aMatch(this.id, {
      ...o, id: `${this.id}-${o.id}`, nextWinnerMatchId: full(o.nextWinnerMatchId), nextLoserMatchId: full(o.nextLoserMatchId),
    });
    this.world.matches.push(row);
    return row;
  }

  find(matchId: string): MatchRow {
    const row = this.world.matches.find((m) => m.id === matchId || m.id === `${this.id}-${matchId}`);
    if (!row) throw new Error(`No match ${matchId} in ${this.id}`);
    return row;
  }

  /** Plays a scheduled match: its games, performances, score and winner; a bracket winner moves on. */
  play(match: MatchRow): void {
    const { random, counters } = this.ctx;
    const a = match.teamAId;
    const b = match.teamBId;
    if (!a || !b) throw new Error(`Match ${match.id} has no two teams`);
    const aChance = 0.5 + (this.strength.get(a)! - this.strength.get(b)!) * 0.4;
    const winners = seriesGames(random, match.bestOf ?? 3, aChance);
    const start = match.scheduledAt ?? new Date(this.ctx.now.getTime() - 24 * HOUR);
    let at = start.getTime();
    winners.forEach((aWins, i) => {
      const dotaMatchId = 8_000_000_000 + ++counters.dotaMatch;
      const minutes = random.int(24, 55);
      const [radiant, dire] = i % 2 === 0 ? [a, b] : [b, a];
      const radiantWin = aWins === (radiant === a);
      const { picksBans, radiant: rHeroes, dire: dHeroes } = pickDraft(random);
      const gameId = String(dotaMatchId);
      this.world.games.push(aGame(this.id, {
        id: gameId, matchId: match.id, number: i + 1, dotaMatchId, radiantTeamId: radiant, direTeamId: dire, radiantWin,
        startedAt: new Date(at), durationSeconds: minutes * 60 + random.int(0, 59), firstBloodSeconds: random.int(30, 400),
        picksBans, importedAt: new Date(at + minutes * 60_000),
      }));
      for (const [teamId, heroes, isRadiant] of [[radiant, rHeroes, true], [dire, dHeroes, false]] as const) {
        const won = isRadiant === radiantWin;
        this.rosters.get(teamId)!.forEach((p, k) => {
          this.world.performances.push(aPerformance(this.id, {
            gameId, steamId64: p.steamId64, teamId, heroId: heroes[k], playerSlot: (isRadiant ? 0 : 128) + k,
            firstBlood: false, ...playerLine(random, p.position, won, minutes),
            extra: { isRadiant, role: p.position, level: random.int(18, 30) },
          }));
        });
      }
      at += (minutes + 15) * 60_000;
    });
    const scoreA = winners.filter(Boolean).length;
    const scoreB = winners.length - scoreA;
    Object.assign(match, {
      status: 'completed', scoreA, scoreB, completedAt: new Date(at),
      winnerTeamId: scoreA === scoreB ? null : scoreA > scoreB ? a : b,
    });
    this.advance(match);
  }

  private advance(match: MatchRow): void {
    const winner = match.winnerTeamId;
    const loser = winner === match.teamAId ? match.teamBId : match.teamAId;
    const place = (nextId: string | null | undefined, slot: 'a' | 'b' | null | undefined, teamId: string | null | undefined) => {
      if (!nextId || !slot || !teamId) return;
      const next = this.find(nextId);
      if (slot === 'a') next.teamAId = teamId;
      else next.teamBId = teamId;
    };
    place(match.nextWinnerMatchId, match.nextWinnerSlot, winner);
    place(match.nextLoserMatchId, match.nextLoserSlot, loser);
  }

  /**
   * The group's table with the stage's ranking rules (src/features/formats), best first. Teams
   * that share a place come in team id order, so the seed is deterministic.
   */
  table(groupId: string): string[] {
    const group = this.world.groups.find((g) => g.id === groupId)!;
    const stage = this.world.stages.find((st) => st.id === group.stageId)!;
    const teamIds = this.groupTeams(groupId);
    const mmr = (teamId: string) =>
      this.world.teamMembers.filter((m) => m.teamId === teamId && m.kind === 'player').reduce((sum, m) => sum + (m.mmr ?? 0), 0);
    const standings = computeStandings({
      teams: teamIds.map((id) => ({ id, name: id, mmr: mmr(id) || undefined })),
      matches: this.world.matches.filter((m) => m.groupId === groupId).map((m) => ({
        id: m.id, teamAId: m.teamAId ?? null, teamBId: m.teamBId ?? null, scoreA: m.scoreA ?? null, scoreB: m.scoreB ?? null,
        status: m.status ?? 'scheduled', kind: m.kind ?? 'regular', replaced: false, round: m.round,
      })),
      rules: parseRankingRules(stage.ranking),
    });
    return standings.rows.map((r) => r.teamId);
  }

  /** Teams of a group in the order they joined it. */
  groupTeams(groupId: string): string[] {
    return this.world.groupTeams.filter((g) => g.groupId === groupId).map((g) => g.teamId);
  }

  /** The time of round `round` (1-based), `firstRoundAt` plus a week per round, at 19:00 UTC. */
  roundTime(firstRoundAt: Date, round: number, matchIndex = 0): Date {
    return new Date(firstRoundAt.getTime() + (round - 1) * 7 * 24 * HOUR + (matchIndex % 3) * 24 * HOUR);
  }
}
