// src/lib/performance-rankings-calculator.ts
// Server-side calculation of performance score rankings.
// Reads completed match/game/performance data and writes pre-computed
// sorted arrays to tournaments/{tourId}/performanceRankings/{role}.
import 'server-only';
import { getAdminDb, ensureAdminInitialized } from '../../server/lib/admin';

// ─── Constants & types ────────────────────────────────────────────────────────

const VALID_ROLES = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'] as const;
type ValidRole = typeof VALID_ROLES[number];

const ROLE_DOC_ID: Record<ValidRole, string> = {
  Carry:           'carry',
  Mid:             'mid',
  Offlane:         'offlane',
  'Soft Support':  'soft-support',
  'Hard Support':  'hard-support',
};

interface PerfData {
  kills:             number;
  deaths:            number;
  assists:           number;
  gpm:               number;
  xpm:               number;
  lastHits:          number;
  heroDamage:        number;
  towerDamage:       number;
  obsPlaced:         number;
  senPlaced:         number;
  observerKills:     number;
  sentryKills:       number;
  campsStacked:      number;
  firstBloodClaimed: boolean;
  runesPickedUp:     number;
}

interface ScoreComponents {
  total:      number;
  killPts:    number;
  assistPts:  number;
  deathPts:   number;
  farmPts:    number;
  dmgPts:     number;
  wardPts:    number;
  dewardPts:  number;
  campPts:    number;
  miscPts:    number;
}

export interface RankingEntry {
  name:      string;
  teamName:  string;
  avgScore:  number;
  games:     number;
  killPts?:    number;
  assistPts?:  number;
  deathPts?:   number;
  farmPts?:    number;
  dmgPts?:     number;
  wardPts?:    number;
  dewardPts?:  number;
  campPts?:    number;
  miscPts?:    number;
}

export interface PerformanceRankingsDoc {
  entries:    RankingEntry[];
  updatedAt:  string;
  gameCount:  number;
}

// ─── Scoring formula (v2, mirrors calculate-performance-score.js) ─────────────

function calcScore(
  role: string,
  p: PerfData,
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

// ─── Main export ──────────────────────────────────────────────────────────────

export async function recalculatePerformanceRankings(tournamentId: string): Promise<void> {
  console.log(`[PerformanceRankings] Starting recalculation for tournament ${tournamentId}…`);
  ensureAdminInitialized();
  const adminDb = getAdminDb();

  // ── 1. Build player map (steamId / doc id → {nickname, role, teamId}) ──────
  const playerMap: Record<string, { nickname: string; role: string; teamId: string }> = {};
  const teamNameMap: Record<string, string> = {};

  const teamsSnap = await adminDb
    .collection('tournaments').doc(tournamentId)
    .collection('teams').get();

  await Promise.all(teamsSnap.docs.map(async (teamDoc) => {
    const td = teamDoc.data();
    teamNameMap[teamDoc.id] = (td.name as string) || teamDoc.id;

    // Players subcollection (PDL-style)
    const playersSnap = await adminDb
      .collection('tournaments').doc(tournamentId)
      .collection('teams').doc(teamDoc.id)
      .collection('players').get();

    if (!playersSnap.empty) {
      const roster = td.roster as Record<string, { nickname?: string; role?: string }> | undefined;
      for (const pd of playersSnap.docs) {
        const pData = pd.data();
        // Prefer the player doc's own nickname, then fall back to the team's roster map
        // (roster map is keyed by Steam64 which equals pd.id for MMR-limited tournaments)
        const rosterNickname = roster?.[pd.id]?.nickname || roster?.[pData.steamId as string]?.nickname;
        playerMap[pd.id] = {
          nickname: (pData.nickname as string) || rosterNickname || pd.id,
          role:     (pData.role     as string) || '',
          teamId:   teamDoc.id,
        };
        // Also index by steamId field if present (handles both lookup keys)
        if (pData.steamId && pData.steamId !== pd.id) {
          playerMap[pData.steamId as string] = playerMap[pd.id];
        }
      }
    } else if (td.roster && typeof td.roster === 'object') {
      // Roster map directly on team document (alternative structure)
      for (const [steamId64, info] of Object.entries(
        td.roster as Record<string, { nickname: string; role: string }>,
      )) {
        playerMap[steamId64] = {
          nickname: info.nickname,
          role:     info.role,
          teamId:   teamDoc.id,
        };
      }
    }
  }));

  // ── 2. Walk completed matches → games → performances ─────────────────────
  interface RawEntry {
    gameMins: number;
    role:     string;
    nickname: string;
    teamId:   string;
    perf:     PerfData;
  }
  const matchesSnap = await adminDb
    .collection('tournaments').doc(tournamentId)
    .collection('matches')
    .where('status', '==', 'completed')
    .get();

  const matchEntryGroups = await Promise.all(
    matchesSnap.docs
      .filter((matchDoc) => !matchDoc.data().isBanForfeit)
      .map(async (matchDoc) => {
        const gamesSnap = await adminDb
          .collection('tournaments').doc(tournamentId)
          .collection('matches').doc(matchDoc.id)
          .collection('games').get();

        const gameEntryGroups = await Promise.all(
          gamesSnap.docs.map(async (gameDoc) => {
            const gd = gameDoc.data();
            const gameDurationSec = (gd.duration as number) || 0;
            const gameMins = gameDurationSec / 60;
            if (gameMins < 5) return []; // skip corrupted / stub games

            const perfSnap = await adminDb
              .collection('tournaments').doc(tournamentId)
              .collection('matches').doc(matchDoc.id)
              .collection('games').doc(gameDoc.id)
              .collection('performances').get();

            const entries: RawEntry[] = [];
            for (const perfDoc of perfSnap.docs) {
              const pd = perfDoc.data();
              const lookupId = (pd.steamId as string) || perfDoc.id;
              const pInfo = playerMap[lookupId] ?? playerMap[perfDoc.id];
              if (!pInfo) continue;
              // Skip cross-team standin: player's registered team ≠ team they played for in this game
              if ((pd.teamId as string) && (pd.teamId as string) !== pInfo.teamId) continue;
              if (!(VALID_ROLES as readonly string[]).includes(pInfo.role)) continue;

              entries.push({
                gameMins,
                role:     pInfo.role,
                nickname: pInfo.nickname,
                teamId:   pInfo.teamId,
                perf: {
                  kills:             (pd.kills             as number) || 0,
                  deaths:            (pd.deaths            as number) || 0,
                  assists:           (pd.assists           as number) || 0,
                  gpm:               (pd.gpm               as number) || 0,
                  xpm:               (pd.xpm               as number) || 0,
                  lastHits:          (pd.lastHits          as number) || 0,
                  heroDamage:        (pd.heroDamage        as number) || 0,
                  towerDamage:       (pd.towerDamage       as number) || 0,
                  obsPlaced:         (pd.obsPlaced         as number) || 0,
                  senPlaced:         (pd.senPlaced         as number) || 0,
                  observerKills:     (pd.observerKills     as number) || 0,
                  sentryKills:       (pd.sentryKills       as number) || 0,
                  campsStacked:      (pd.campsStacked      as number) || 0,
                  firstBloodClaimed: (pd.firstBloodClaimed as boolean) || false,
                  runesPickedUp:     (pd.runesPickedUp     as number) || 0,
                },
              });
            }
            return entries;
          })
        );
        return gameEntryGroups.flat();
      })
  );
  const rawEntries: RawEntry[] = matchEntryGroups.flat();

  const updatedAt  = new Date().toISOString();
  const gameCount  = rawEntries.length;
  const rankingsRef = adminDb.collection('tournaments').doc(tournamentId).collection('performanceRankings');

  if (gameCount === 0) {
    const batch = adminDb.batch();
    batch.set(rankingsRef.doc('teams'), { entries: [], updatedAt, gameCount: 0 });
    for (const role of VALID_ROLES) {
      batch.set(rankingsRef.doc(ROLE_DOC_ID[role]), { entries: [], updatedAt, gameCount: 0 });
    }
    await batch.commit();
    console.log(`[PerformanceRankings] No game data found — wrote empty docs for ${tournamentId}`);
    return;
  }

  // ── 3. Global average game duration (normalisation base) ─────────────────
  const avgGameMins = rawEntries.reduce((s, e) => s + e.gameMins, 0) / rawEntries.length;

  // ── 4. Accumulate per-player totals ───────────────────────────────────────
  const playerAccum: Record<string, {
    role:       string;
    teamId:     string;
    totalScore: number;
    games:      number;
    killPts:    number;
    assistPts:  number;
    deathPts:   number;
    farmPts:    number;
    dmgPts:     number;
    wardPts:    number;
    dewardPts:  number;
    campPts:    number;
    miscPts:    number;
  }> = {};

  for (const entry of rawEntries) {
    const c = calcScore(entry.role, entry.perf, entry.gameMins, avgGameMins);
    if (!playerAccum[entry.nickname]) {
      playerAccum[entry.nickname] = {
        role: entry.role, teamId: entry.teamId,
        totalScore: 0, games: 0,
        killPts: 0, assistPts: 0, deathPts: 0, farmPts: 0, dmgPts: 0,
        wardPts: 0, dewardPts: 0, campPts: 0, miscPts: 0,
      };
    }
    const acc = playerAccum[entry.nickname];
    acc.totalScore += c.total;
    acc.games      += 1;
    acc.killPts    += c.killPts;
    acc.assistPts  += c.assistPts;
    acc.deathPts   += c.deathPts;
    acc.farmPts    += c.farmPts;
    acc.dmgPts     += c.dmgPts;
    acc.wardPts    += c.wardPts;
    acc.dewardPts  += c.dewardPts;
    acc.campPts    += c.campPts;
    acc.miscPts    += c.miscPts;
  }

  // ── 5. Build sorted per-role arrays ───────────────────────────────────────
  const roleEntries: Record<ValidRole, RankingEntry[]> = {
    Carry: [], Mid: [], Offlane: [], 'Soft Support': [], 'Hard Support': [],
  };

  for (const [nickname, acc] of Object.entries(playerAccum)) {
    const role = acc.role as ValidRole;
    if (!roleEntries[role]) continue;
    roleEntries[role].push({
      name:      nickname,
      teamName:  teamNameMap[acc.teamId] || acc.teamId,
      avgScore:  acc.totalScore / acc.games,
      games:     acc.games,
      killPts:   acc.killPts   / acc.games,
      assistPts: acc.assistPts / acc.games,
      deathPts:  acc.deathPts  / acc.games,
      farmPts:   acc.farmPts   / acc.games,
      dmgPts:    acc.dmgPts    / acc.games,
      wardPts:   acc.wardPts   / acc.games,
      dewardPts: acc.dewardPts / acc.games,
      campPts:   acc.campPts   / acc.games,
      miscPts:   acc.miscPts   / acc.games,
    });
  }
  for (const role of VALID_ROLES) {
    roleEntries[role].sort((a, b) => b.avgScore - a.avgScore);
  }

  // ── 6. Build sorted team rankings ─────────────────────────────────────────
  const teamAccum: Record<string, { totalScore: number; games: number }> = {};
  for (const acc of Object.values(playerAccum)) {
    if (!teamAccum[acc.teamId]) teamAccum[acc.teamId] = { totalScore: 0, games: 0 };
    teamAccum[acc.teamId].totalScore += acc.totalScore;
    teamAccum[acc.teamId].games      += acc.games;
  }
  const teamEntries: RankingEntry[] = Object.entries(teamAccum)
    .filter(([, v]) => v.games > 0)
    .map(([teamId, v]) => ({
      name:     teamNameMap[teamId] || teamId,
      teamName: teamNameMap[teamId] || teamId,
      avgScore: v.totalScore / v.games,
      games:    v.games,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);

  // ── 7. Batch-write to Firestore (7 documents, well within 500 limit) ──────
  const batch = adminDb.batch();
  batch.set(rankingsRef.doc('teams'), { entries: teamEntries, updatedAt, gameCount } satisfies PerformanceRankingsDoc);
  for (const role of VALID_ROLES) {
    batch.set(
      rankingsRef.doc(ROLE_DOC_ID[role]),
      { entries: roleEntries[role], updatedAt, gameCount } satisfies PerformanceRankingsDoc,
    );
  }
  await batch.commit();

  console.log(
    `[PerformanceRankings] Done — ${gameCount} performances, ${Object.keys(playerAccum).length} players, ` +
    `${teamEntries.length} teams for tournament ${tournamentId}`,
  );
}
