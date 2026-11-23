// Performance score (v2) — the per-game rating behind the rankings page. Shared by the server-side
// rankings calculator and the client-side stats pages so both always show the same numbers.

export const PERFORMANCE_ROLES = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'] as const;

export interface PerformanceInput {
  kills: number;
  deaths: number;
  assists: number;
  gpm: number;
  xpm: number;
  lastHits: number;
  heroDamage: number;
  towerDamage: number;
  obsPlaced: number;
  senPlaced: number;
  observerKills: number;
  sentryKills: number;
  campsStacked: number;
  firstBloodClaimed: boolean;
  runesPickedUp: number;
}

export interface ScoreComponents {
  total: number;
  killPts: number;
  assistPts: number;
  deathPts: number;
  farmPts: number;
  dmgPts: number;
  wardPts: number;
  dewardPts: number;
  campPts: number;
  miscPts: number;
}

/** Games shorter than this are corrupted / stub games and are not scored */
export const MIN_SCORED_GAME_MINS = 5;

export function calcPerformanceScore(
  role: string,
  p: PerformanceInput,
  gameMins: number,
  avgGameMins: number,
): ScoreComponents {
  const zero: ScoreComponents = { total: 0, killPts: 0, assistPts: 0, deathPts: 0, farmPts: 0, dmgPts: 0, wardPts: 0, dewardPts: 0, campPts: 0, miscPts: 0 };
  if (gameMins <= 0) return zero;
  // Normalise per-count stats to average game length to remove duration bias
  const n = (v: number) => v * avgGameMins / gameMins;

  let killPts = 0, assistPts = 0, deathPts = 0, farmPts = 0, dmgPts = 0, wardPts = 0;

  switch (role) {
    case 'Carry':
      killPts   = n(p.kills)   * 0.29;
      assistPts = n(p.assists) * 0.13;
      deathPts  = n(p.deaths)  * -0.38;
      farmPts   = Math.max(p.gpm - 300, 0) / 150 + n(p.lastHits) / 150;
      dmgPts    = n(p.heroDamage) / 14000 + n(p.towerDamage) / 14000;
      break;
    case 'Mid':
      killPts   = n(p.kills)   * 0.38;
      assistPts = n(p.assists) * 0.12;
      deathPts  = n(p.deaths)  * -0.34;
      farmPts   = Math.max(p.xpm - 300, 0) / 144 + n(p.lastHits) / 220;
      dmgPts    = n(p.heroDamage) / 12000 + n(p.towerDamage) / 12000;
      break;
    case 'Offlane':
      killPts   = n(p.kills)   * 0.43;
      assistPts = n(p.assists) * 0.23;
      deathPts  = n(p.deaths)  * -0.30;
      farmPts   = Math.max(p.gpm - 250, 0) / 175;
      dmgPts    = n(p.heroDamage) / 9000 + n(p.towerDamage) / 9000;
      wardPts   = n(p.obsPlaced) * 0.20 + n(p.senPlaced) * 0.20;
      break;
    case 'Soft Support':
      killPts   = n(p.kills)   * 0.35;
      assistPts = n(p.assists) * 0.20;
      deathPts  = n(p.deaths)  * -0.25;
      farmPts   = Math.max(p.gpm - 200, 0) / 130;
      dmgPts    = n(p.heroDamage) / 13000 + n(p.towerDamage) / 13000;
      wardPts   = n(p.obsPlaced) * 0.22 + n(p.senPlaced) * 0.15;
      break;
    case 'Hard Support':
      killPts   = n(p.kills)   * 0.23;
      assistPts = n(p.assists) * 0.20;
      deathPts  = n(p.deaths)  * -0.21;
      farmPts   = Math.max(p.gpm - 200, 0) / 200;
      dmgPts    = n(p.heroDamage) / 11500 + n(p.towerDamage) / 11500;
      wardPts   = n(p.obsPlaced) * 0.18 + n(p.senPlaced) * 0.12;
      break;
    default:
      return zero;
  }

  const dewardPts = n(p.observerKills) * 0.25 + n(p.sentryKills) * 0.10;
  const campPts   = n(p.campsStacked) * 0.20;
  const miscPts   = (p.firstBloodClaimed ? 0.75 : 0)
                  + (role === 'Mid' ? n(p.runesPickedUp) * 0.07 : 0);

  const total = killPts + assistPts + deathPts + farmPts + dmgPts + wardPts + dewardPts + campPts + miscPts;
  return { total, killPts, assistPts, deathPts, farmPts, dmgPts, wardPts, dewardPts, campPts, miscPts };
}
