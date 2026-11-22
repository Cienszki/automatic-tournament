/**
 * One game of one Steam account, as stored and as draft preparation reads it. A tuple keeps a
 * history of 5,000+ games small; the order is the one `DpMatchRow` uses on the old site.
 * `position` is 0 when unknown: only STRATZ knows it, and only after the monthly sweep.
 */
export type GameRow = [
  matchId: number,
  start: number,
  hero: number,
  win: 0 | 1,
  kind: 0 | 1,
  lane: number,
  position: number,
];

export const PUB = 0;
export const LEAGUE = 1;

/** Game modes that say something about hero choice: AP, CM, RD, SD, AR, CD, ranked AP */
export const HERO_CHOICE_MODES: ReadonlySet<number> = new Set([1, 2, 3, 4, 5, 16, 22]);
/** Practice lobby (leagues, inhouses), tournament, battle cup */
export const LEAGUE_LOBBIES: ReadonlySet<number> = new Set([1, 2, 9]);

/** A game as OpenDota's `/players/{id}/matches` lists it, with the fields we project */
export interface OpenDotaPlayerMatch {
  match_id: number;
  start_time: number;
  hero_id: number;
  radiant_win: boolean | null;
  player_slot: number;
  lobby_type: number;
  game_mode: number;
  lane_role?: number | null;
}

/** A game as STRATZ lists it for one player */
export interface StratzPlayerGame {
  matchId: number;
  start: number;
  hero: number;
  win: boolean;
  league: boolean;
  position: number;
  heroChoiceMode: boolean;
}

/** Keeps the games that say something about hero choice and have a result */
export function fromOpenDota(list: readonly OpenDotaPlayerMatch[]): GameRow[] {
  const rows: GameRow[] = [];
  for (const m of list) {
    if (!HERO_CHOICE_MODES.has(m.game_mode) || !m.hero_id || m.radiant_win == null) continue;
    // player_slot 0-127 is Radiant, 128-255 Dire
    const radiant = m.player_slot < 128;
    rows.push([
      m.match_id,
      m.start_time,
      m.hero_id,
      radiant === m.radiant_win ? 1 : 0,
      LEAGUE_LOBBIES.has(m.lobby_type) ? LEAGUE : PUB,
      m.lane_role ?? 0,
      0,
    ]);
  }
  return rows;
}

export function fromStratz(list: readonly StratzPlayerGame[]): GameRow[] {
  return list
    .filter((g) => g.heroChoiceMode && g.hero > 0)
    .map((g): GameRow => [g.matchId, g.start, g.hero, g.win ? 1 : 0, g.league ? LEAGUE : PUB, 0, g.position]);
}
