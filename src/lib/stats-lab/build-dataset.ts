import 'server-only';
import { getAdminDb, ensureAdminInitialized } from '@/server/lib/admin';
import { countsForStats } from '@/lib/match-flags';
import { PERF_NUM_FIELDS, type DsGame, type DsGroup, type DsMatch, type DsPlayer, type DsTeam, type StatsDataset } from './types';

const STEAM64_OFFSET = 76561197960265728n;

function sid32To64(sid32: unknown): string | null {
  if (sid32 == null || sid32 === '') return null;
  try { return String(BigInt(String(sid32)) + STEAM64_OFFSET); } catch { return null; }
}

function sid64FromProfileUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const m = url.match(/\/profiles\/(\d{17})/);
  return m ? m[1] : null;
}

function toMillis(v: any): number | undefined {
  if (!v) return undefined;
  if (typeof v === 'string') { const t = Date.parse(v); return isNaN(t) ? undefined : t; }
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v._seconds === 'number') return v._seconds * 1000;
  return undefined;
}

/**
 * Packs every completed game of a tournament (plus teams, players and series results) into
 * one compact payload. `tournamentId` null = legacy Letnia top-level collections.
 */
export async function buildStatsDataset(tournamentId: string | null): Promise<StatsDataset> {
  ensureAdminInitialized();
  const db = getAdminDb();
  const base = tournamentId ? db.collection('tournaments').doc(tournamentId) : null;
  const col = (name: string) => (base ? base.collection(name) : db.collection(name));

  const [matchesSnap, teamsSnap] = await Promise.all([col('matches').get(), col('teams').get()]);

  // ── Teams + roster players ────────────────────────────────────────────
  const teams: DsTeam[] = [];
  const players = new Map<string, DsPlayer>();
  // Legacy performances are keyed by the player-subcollection doc id, newer ones by steamId64:
  // map doc ids onto the steamId so one person is one player.
  const alias = new Map<string, string>();
  const addPlayer = (id: string | null | undefined, p: Omit<DsPlayer, 'id'>) => {
    if (!id || !p.name) return;
    const prev = players.get(id);
    // Roster entries win over standin entries; keep the first avatar we find
    if (prev && !prev.standin && p.standin) return;
    players.set(id, { ...prev, ...p, id, avatar: p.avatar || prev?.avatar });
  };

  await Promise.all(teamsSnap.docs.map(async (teamDoc) => {
    const t = teamDoc.data();
    teams.push({ id: teamDoc.id, name: (t.name || '').trim(), tag: t.tag || undefined, logoUrl: t.logoUrl || undefined });
    const roster: Record<string, any> = t.roster || {};
    for (const [steamId, info] of Object.entries(roster)) {
      addPlayer(steamId, { name: info?.nickname, teamId: teamDoc.id, role: info?.role, avatar: info?.avatar });
    }
    try {
      const ps = await teamDoc.ref.collection('players').get();
      for (const d of ps.docs) {
        const p = d.data();
        const entry = {
          name: p.nickname || roster[d.id]?.nickname,
          teamId: teamDoc.id,
          role: p.role || roster[d.id]?.role,
          avatar: p.avatarmedium || p.avatarfull || p.avatar,
        };
        const sid = p.steamId || p.steamId64 || sid32To64(p.steamId32);
        if (sid) {
          addPlayer(sid, entry);
          if (d.id !== sid) alias.set(d.id, sid);
        } else {
          addPlayer(d.id, entry);
        }
      }
    } catch { /* no subcollection */ }
  }));

  // ── Standins (name only — they are not on any roster) ─────────────────
  const matchDocs = matchesSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  for (const m of matchDocs) {
    for (const s of Object.values<any>(m.approvedStandins || {})) {
      addPlayer(sid32To64(s?.steamId32), { name: s?.nickname, standin: true });
    }
  }
  try {
    const [standins, requests] = await Promise.all([
      col('standins').get(),
      tournamentId ? col('standinRequests').get() : Promise.resolve(null),
    ]);
    for (const d of standins.docs) {
      const s = d.data();
      const sid = s.steamId || sid32To64(s.steamId32) || sid64FromProfileUrl(s.steamProfileUrl);
      addPlayer(sid, { name: s.nickname || s.name, standin: true, avatar: s.avatarmedium || s.avatar });
    }
    for (const d of requests?.docs ?? []) {
      const r = d.data();
      if (!['approved', 'appeal_approved'].includes(r.status)) continue;
      const sid = sid32To64(r.standinSteamId32) || sid64FromProfileUrl(r.standinSteamProfileUrl);
      addPlayer(sid, { name: r.standinNickname, standin: true });
    }
  } catch { /* optional collections */ }

  // ── Completed matches → games → performances ─────────────────────────
  // Real match docs (auto ids) before legacy playoff docs like "ub-r2-p2", which can hold the
  // same games — see the dedupe below.
  const legacyId = (id: string) => id.includes('-');
  const completedAll = matchDocs
    .filter(m => m.status === 'completed' && !m.isBanForfeit && !m.isSwissByeMatch && countsForStats(m)) // a replayed original: its rematch counts
    .sort((a, b) => Number(legacyId(a.id)) - Number(legacyId(b.id)));
  const allGameSnaps = await Promise.all(completedAll.map(m => col('matches').doc(m.id).collection('games').get()));
  // The same Dota game can sit under two match docs (a playoff match and its legacy copy): count
  // it once, under the first one, and drop a match whose every game was such a copy.
  const seenGames = new Set<string>();
  const keep = completedAll.map((_, i) => {
    const ids = allGameSnaps[i].docs.map(d => d.id);
    const fresh = ids.filter(id => !seenGames.has(id));
    ids.forEach(id => seenGames.add(id));
    return !ids.length || fresh.length > 0;
  });
  const completed = completedAll.filter((_, i) => keep[i]);
  const gameSnaps = allGameSnaps.filter((_, i) => keep[i]);
  const matches: DsMatch[] = completed.map(m => ({
    id: m.id,
    groupId: m.group_id || m.divisionId || undefined,
    teamA: m.teamA?.id || m.teams?.[0] || '',
    teamB: m.teamB?.id || m.teams?.[1] || '',
    scoreA: m.teamA?.score ?? 0,
    scoreB: m.teamB?.score ?? 0,
    winnerId: m.winnerId ?? null,
    round: m.round ?? undefined,
    matchday: m.matchday ?? undefined,
    isPlayoff: m.isPlayoff || undefined,
    playoffCode: m.playoffCode || undefined,
    completedAt: toMillis(m.completedAt) ?? toMillis(m.completed_at) ?? toMillis(m.scheduledFor),
  }));

  const gameRefs: Array<{ game: DsGame; ref: FirebaseFirestore.DocumentReference }> = [];
  const taken = new Set<string>();
  gameSnaps.forEach((snap, i) => {
    for (const d of snap.docs) {
      if (taken.has(d.id)) continue;
      taken.add(d.id);
      const g = d.data();
      if (g.is_forfeit || !g.radiant_team?.id || !g.dire_team?.id) continue;
      gameRefs.push({
        ref: d.ref,
        game: {
          id: d.id,
          matchId: completed[i].id,
          radiant: g.radiant_team.id,
          dire: g.dire_team.id,
          radiantWin: !!g.radiant_win,
          duration: g.duration || 0,
          start: g.start_time || 0,
          firstBlood: g.firstBloodTime ?? 0,
          pb: (g.picksBans || []).map((x: any) => [x.hero_id, x.is_pick ? 1 : 0, x.team, x.order ?? 0]),
        },
      });
    }
  });
  gameRefs.sort((a, b) => a.game.start - b.game.start);

  // One person, one id: performances may carry a real steamId64 in `steamId` while `playerId`
  // is `unknown_<steamId32>` (unmatched at import) or a legacy player-doc id.
  const canonicalId = (p: FirebaseFirestore.DocumentData, docId: string): string => {
    const candidates = [p.steamId, p.playerId, docId].map(v => (v == null ? '' : String(v)));
    for (const c of candidates) if (/^\d{17}$/.test(c)) return c;
    for (const c of candidates) {
      const m = c.match(/^unknown_(\d+)$/);
      if (m) { const sid = sid32To64(m[1]); if (sid) return sid; }
      if (alias.has(c)) return alias.get(c)!;
    }
    return candidates.find(Boolean) || docId;
  };

  const perfSnaps = await Promise.all(gameRefs.map(g => g.ref.collection('performances').get()));
  const perfs: StatsDataset['perfs'] = [];
  perfSnaps.forEach((snap, gi) => {
    for (const d of snap.docs) {
      const p = d.data();
      const row: [number, string, string, ...number[]] = [gi, canonicalId(p, d.id), p.teamId || ''];
      for (const f of PERF_NUM_FIELDS) {
        const v = p[f];
        row.push(typeof v === 'boolean' ? (v ? 1 : 0) : (typeof v === 'number' && isFinite(v) ? Math.round(v * 100) / 100 : 0));
      }
      perfs.push(row);
    }
  });

  // Division / group names (league + mmr-limited use `divisions`)
  const groups: DsGroup[] = [];
  if (tournamentId) {
    try {
      const divs = await col('divisions').get();
      for (const d of divs.docs) groups.push({ id: d.id, name: d.data().name || d.id, tier: d.data().tier ?? undefined });
    } catch { /* none */ }
  }

  // Only ship players who actually played
  const played = new Set(perfs.map(r => r[1]));
  const outPlayers = [...players.values()].filter(p => played.has(p.id));

  return {
    tournamentId: tournamentId ?? 'letnia',
    generatedAt: new Date().toISOString(),
    teams,
    groups,
    players: outPlayers,
    matches,
    games: gameRefs.map(g => g.game),
    perfs,
  };
}
