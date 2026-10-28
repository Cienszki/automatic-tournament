import 'server-only';
// Server side of the draft-preparation pages (/draft-prep-N): the tournament context (rosters,
// upcoming matches, standins) from Firestore, and per-account match histories, hero meta and hero
// matchups from OpenDota. Everything is compacted before it is cached or sent to the browser.

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb, ensureAdminInitialized } from '@/server/lib/admin';
import type { DpContext, DpHeroData, DpHistory, DpMatchRow, DpMeta, DpPastStandin, DpStandin, DpTeam } from './types';

const OD = 'https://api.opendota.com/api';
const STEAM64_OFFSET = 76561197960265728n;

export const sid64To32 = (s: string) => { try { return String(BigInt(s) - STEAM64_OFFSET); } catch { return ''; } };
export const sid32To64 = (s: unknown) => { if (s == null || s === '') return ''; try { return String(BigInt(String(s)) + STEAM64_OFFSET); } catch { return ''; } };

function odUrl(path: string) {
  const key = process.env.OPENDOTA_API_KEY;
  return `${OD}${path}${key ? `${path.includes('?') ? '&' : '?'}api_key=${key}` : ''}`;
}
async function odJson<T>(path: string): Promise<T> {
  // Responses can exceed the 2 MB fetch-cache limit; callers cache the compacted result instead
  const res = await fetch(odUrl(path), { cache: 'no-store', headers: { 'User-Agent': 'tournament-draft-prep' } });
  if (!res.ok) throw new Error(`OpenDota ${path.split('?')[0]}: ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Steam ids from profile links (smurf accounts are stored as links) ─────

async function resolveProfileUrl(url: string): Promise<string | null> {
  const direct = url.match(/\/profiles\/(\d{17})/);
  if (direct) return sid64To32(direct[1]);
  const vanity = url.match(/\/id\/([^/?#]+)/);
  const key = process.env.STEAM_API_KEY;
  if (!vanity || !key) return null;
  try {
    const r = await fetch(`https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${key}&vanityurl=${encodeURIComponent(vanity[1])}`, { cache: 'no-store' });
    const j = await r.json();
    return j?.response?.success === 1 ? sid64To32(j.response.steamid) : null;
  } catch { return null; }
}

// ── Tournament context ─────────────────────────────────────────────────────

const toIso = (v: any): string | undefined => {
  if (!v) return undefined;
  if (typeof v === 'string') return v;
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  if (typeof v._seconds === 'number') return new Date(v._seconds * 1000).toISOString();
  return undefined;
};

/** Teams with their registered rosters, matches not yet played, and the standins for them */
export async function buildContext(tournamentId: string | null): Promise<DpContext> {
  ensureAdminInitialized();
  const db = getAdminDb();
  const base = tournamentId ? db.collection('tournaments').doc(tournamentId) : null;
  const col = (name: string) => (base ? base.collection(name) : db.collection(name));
  const [teamsSnap, matchesSnap] = await Promise.all([col('teams').get(), col('matches').get()]);

  const alias = new Map<string, string>(); // player doc id → steamId64
  const teams: DpTeam[] = await Promise.all(teamsSnap.docs.map(async d => {
    const t = d.data();
    const players = new Map<string, DpTeam['players'][number]>();
    for (const [sid64, r] of Object.entries<any>(t.roster || {})) {
      players.set(sid64, { sid64, sid32: r?.steamId32 || sid64To32(sid64), name: r?.nickname || '?', role: r?.role, avatar: r?.avatar, smurfs: 0 });
    }
    try {
      const ps = await d.ref.collection('players').get();
      for (const pd of ps.docs) {
        const p = pd.data();
        const sid64 = p.steamId || p.steamId64 || sid32To64(p.steamId32) || pd.id;
        if (pd.id !== sid64) alias.set(pd.id, sid64);
        const prev = players.get(sid64);
        players.set(sid64, {
          sid64, sid32: p.steamId32 || prev?.sid32 || sid64To32(sid64), name: p.nickname || prev?.name || '?', role: p.role || prev?.role,
          avatar: p.avatarmedium || p.avatarfull || p.avatar || prev?.avatar, mmr: typeof p.mmr === 'number' ? p.mmr : undefined,
          smurfs: Array.isArray(p.smurfAccounts) ? p.smurfAccounts.length : 0,
        });
      }
    } catch { /* roster only */ }
    // registration time, so lists follow the teams section order
    const c = t.createdAt;
    const registeredAt = typeof c?.toMillis === 'function' ? c.toMillis() : typeof c === 'string' && Number.isFinite(Date.parse(c)) ? Date.parse(c) : undefined;
    return { id: d.id, name: (t.name || '').trim(), tag: t.tag || undefined, logoUrl: t.logoUrl || undefined, captainId: t.captainId || undefined, registeredAt, players: [...players.values()] };
  }));

  // Standin requests that are not decided yet (approved ones are copied into the match doc)
  const pending = new Map<string, DpStandin[]>();
  try {
    if (tournamentId) {
      const reqs = await col('standinRequests').get();
      for (const r of reqs.docs) {
        const s = r.data();
        if (!['pending', 'appealed'].includes(s.status)) continue;
        const sid32 = s.standinSteamId32 || (s.standinSteamProfileUrl ? await resolveProfileUrl(s.standinSteamProfileUrl) : null);
        if (!sid32 || !s.matchId) continue;
        const list = pending.get(s.matchId) ?? [];
        list.push({ teamId: s.teamId, replaces: alias.get(s.replacedPlayerId) ?? s.replacedPlayerId, sid32: String(sid32), name: s.standinNickname || '?', status: 'pending', games: Array.isArray(s.gameNumbers) ? s.gameNumbers : [] });
        pending.set(s.matchId, list);
      }
    }
  } catch { /* optional */ }

  // Everyone who has stood in for a team before (approved standins of any match, played or not)
  const past = new Map<string, Map<string, DpPastStandin>>();
  for (const d of matchesSnap.docs) {
    const m = d.data() as any;
    const when = toIso(m.completed_at) || toIso(m.completedAt) || toIso(m.scheduledFor);
    for (const s of Object.values<any>(m.approvedStandins || {})) {
      if (!s?.teamId || !s?.steamId32) continue;
      const byTeam = past.get(s.teamId) ?? new Map<string, DpPastStandin>();
      const prev = byTeam.get(String(s.steamId32));
      byTeam.set(String(s.steamId32), { sid32: String(s.steamId32), name: s.nickname || prev?.name || '?', n: (prev?.n ?? 0) + 1, last: [prev?.last, when].filter(Boolean).sort().pop() });
      past.set(s.teamId, byTeam);
    }
  }
  for (const t of teams) {
    const roster = new Set(t.players.map(p => p.sid32));
    t.pastStandins = [...(past.get(t.id)?.values() ?? [])].filter(s => !roster.has(s.sid32)).sort((a, b) => b.n - a.n || (b.last ?? '').localeCompare(a.last ?? ''));
  }

  const matches = matchesSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
    .filter(m => m.status !== 'completed' && !m.isBanForfeit && !m.isSwissByeMatch)
    .map(m => ({
      id: m.id,
      teamA: m.teamA?.id || m.teams?.[0] || '',
      teamB: m.teamB?.id || m.teams?.[1] || '',
      status: m.status || 'scheduled',
      scheduledFor: toIso(m.scheduledFor) || toIso(m.proposedTime) || toIso(m.deadline),
      bestOf: m.bestOf ?? (m.series_format ? Number(String(m.series_format).replace('bo', '')) : undefined),
      standins: [
        ...Object.values<any>(m.approvedStandins || {}).map(s => ({ teamId: s.teamId, replaces: alias.get(s.replacedPlayerId) ?? s.replacedPlayerId, sid32: String(s.steamId32), name: s.nickname || '?', status: 'approved' as const, games: Array.isArray(s.gameNumbers) ? s.gameNumbers : [] })),
        ...(pending.get(m.id) ?? []),
      ],
    }))
    .filter(m => m.teamA && m.teamB);
  return { teams: teams.filter(t => t.players.length), matches };
}

// ── Player match history (OpenDota) ─────────────────────────────────────────

// Game modes that say something about hero choice: AP, CM, RD, SD, AR, CD, ranked AP
const MODES = new Set([1, 2, 3, 4, 5, 16, 22]);
const LEAGUE_LOBBIES = new Set([1, 2, 9]); // practice lobby (leagues, inhouses), tournament, battle cup

interface OdMatch { match_id: number; start_time: number; hero_id: number; radiant_win: boolean | null; player_slot: number; lobby_type: number; game_mode: number; lane_role?: number | null }

// ── STRATZ: the position (1-5) each game was played at ─────────────────────

const STRATZ_MODES = new Set(['ALL_PICK', 'ALL_PICK_RANKED', 'CAPTAINS_MODE', 'RANDOM_DRAFT', 'SINGLE_DRAFT', 'ALL_RANDOM', 'CAPTAINS_DRAFT']);
const STRATZ_LEAGUE = new Set(['PRACTICE', 'TOURNAMENT', 'BATTLE_CUP']);
// Their limit is ~7 requests per second; keep well under it per server instance
let stratzNext = 0;
async function stratzSlot() { const now = Date.now(); const at = Math.max(now, stratzNext); stratzNext = at + 220; if (at > now) await new Promise(r => setTimeout(r, at - now)); }

interface StratzGame { pos: number; hero: number; win: boolean; start: number; league: boolean; ok: boolean }

/** Up to 500 games of the last 12 months with the position played (empty when STRATZ is unavailable) */
async function stratzGames(account: string): Promise<Map<number, StratzGame>> {
  const out = new Map<number, StratzGame>();
  const token = process.env.STRATZ_API_KEY; if (!token) return out;
  const since = Math.floor(Date.now() / 1000) - 365 * 86400;
  const query = 'query($id: Long!, $skip: Int!, $since: Long) { player(steamAccountId: $id) { matches(request: {take: 100, skip: $skip, startDateTime: $since}) { id startDateTime lobbyType gameMode players(steamAccountId: $id) { heroId position isVictory } } } }';
  for (let skip = 0; skip < 500; skip += 100) {
    await stratzSlot();
    const res = await fetch('https://api.stratz.com/graphql', {
      method: 'POST', cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'STRATZ_API' },
      body: JSON.stringify({ query, variables: { id: Number(account), skip, since } }),
    }).catch(() => null);
    if (!res?.ok) break;
    const j = await res.json().catch(() => null);
    const list: any[] = j?.data?.player?.matches ?? [];
    for (const m of list) {
      const p = m.players?.[0]; if (!p?.heroId) continue;
      const pos = Number(String(p.position ?? '').replace('POSITION_', '')) || 0;
      out.set(Number(m.id), { pos, hero: p.heroId, win: !!p.isVictory, start: m.startDateTime, league: STRATZ_LEAGUE.has(m.lobbyType), ok: STRATZ_MODES.has(m.gameMode) });
    }
    if (list.length < 100) break;
  }
  return out;
}

/**
 * One account's games, compacted: [matchId, start, hero, win, kind, lane, pos]. Throws when
 * OpenDota's match list can't be read, so the failure is retried instead of being cached as
 * "no games" (unstable_cache doesn't keep rejected results).
 */
export async function accountHistory(account: string): Promise<{ name?: string; avatar?: string; rankTier?: number; rows: DpMatchRow[]; positions?: number }> {
  const fields = ['hero_id', 'start_time', 'radiant_win', 'player_slot', 'lobby_type', 'game_mode', 'lane_role'].map(f => `project=${f}`).join('&');
  const [list, prof, sz] = await Promise.all([
    odJson<OdMatch[]>(`/players/${account}/matches?${fields}`),
    odJson<any>(`/players/${account}`).catch(() => null),
    stratzGames(account).catch(() => new Map<number, StratzGame>()),
  ]);
  const rows: DpMatchRow[] = [];
  const seen = new Set<number>();
  for (const m of list) {
    if (!MODES.has(m.game_mode) || !m.hero_id || m.radiant_win == null) continue;
    const radiant = m.player_slot < 128;
    seen.add(m.match_id);
    rows.push([m.match_id, m.start_time, m.hero_id, radiant === m.radiant_win ? 1 : 0, LEAGUE_LOBBIES.has(m.lobby_type) ? 1 : 0, m.lane_role ?? 0, sz.get(m.match_id)?.pos ?? 0]);
  }
  // games only STRATZ knows about
  for (const [id, g] of sz) if (!seen.has(id) && g.ok) rows.push([id, g.start, g.hero, g.win ? 1 : 0, g.league ? 1 : 0, 0, g.pos]);
  rows.sort((a, b) => a[1] - b[1]);
  return { name: prof?.profile?.personaname, avatar: prof?.profile?.avatarmedium, rankTier: prof?.rank_tier ?? undefined, rows, positions: sz.size };
}

/** A roster player's history: main account plus registered smurfs (their ids stay on the server) */
export async function playerAccounts(tournamentId: string | null, sid64: string): Promise<string[]> {
  ensureAdminInitialized();
  const db = getAdminDb();
  const base = tournamentId ? db.collection('tournaments').doc(tournamentId) : null;
  const teams = await (base ? base.collection('teams') : db.collection('teams')).get();
  const accounts = new Set<string>([sid64To32(sid64)]);
  for (const t of teams.docs) {
    const ps = await t.ref.collection('players').get().catch(() => null);
    for (const pd of ps?.docs ?? []) {
      const p = pd.data();
      const id = p.steamId || p.steamId64 || sid32To64(p.steamId32) || pd.id;
      if (id !== sid64 || !Array.isArray(p.smurfAccounts)) continue;
      for (const s of p.smurfAccounts) {
        const a = s?.steamId32 || (s?.steamId64 ? sid64To32(s.steamId64) : s?.steamProfileUrl ? await resolveProfileUrl(s.steamProfileUrl) : null);
        if (a) accounts.add(String(a));
      }
    }
  }
  return [...accounts].filter(a => /^\d{1,12}$/.test(a));
}

// ── Manual refresh of player histories ─────────────────────────────────────

/** Every account of a tournament: roster players, their registered smurfs, and standins who played */
export async function tournamentAccounts(tournamentId: string | null): Promise<string[]> {
  ensureAdminInitialized();
  const db = getAdminDb();
  const base = tournamentId ? db.collection('tournaments').doc(tournamentId) : null;
  const col = (name: string) => (base ? base.collection(name) : db.collection(name));
  const [teams, matches] = await Promise.all([col('teams').get(), col('matches').get()]);
  const out = new Set<string>();
  const add = (a: unknown) => { const v = a == null ? '' : String(a); if (/^\d{1,12}$/.test(v)) out.add(v); };
  for (const t of teams.docs) {
    for (const [sid64, r] of Object.entries<any>(t.data().roster || {})) add(r?.steamId32 || sid64To32(sid64));
    const ps = await t.ref.collection('players').get().catch(() => null);
    for (const pd of ps?.docs ?? []) {
      const p = pd.data();
      add(p.steamId32 || sid64To32(p.steamId || p.steamId64 || pd.id));
      for (const sm of Array.isArray(p.smurfAccounts) ? p.smurfAccounts : []) {
        add(sm?.steamId32 || (sm?.steamId64 ? sid64To32(sm.steamId64) : sm?.steamProfileUrl ? await resolveProfileUrl(sm.steamProfileUrl) : null));
      }
    }
  }
  for (const m of matches.docs) for (const st of Object.values<any>(m.data().approvedStandins || {})) add(st?.steamId32);
  return [...out];
}

/**
 * Ask OpenDota to re-download history from Steam (its "Refresh" button) — but ONLY for accounts
 * OpenDota currently shows nothing for (`fh_unavailable`), i.e. the "just made my data public"
 * case. Never for accounts it shows games for: if such a player has since turned their match data
 * private, the re-download makes OpenDota hide ALL their games (this wiped six pdl-s2 players on
 * 2026-10-28). OpenDota queues it: older games show up minutes to hours later.
 */
export async function requestOpenDotaRefresh(accounts: string[]): Promise<{ queued: number; skipped: number; failed: number }> {
  let queued = 0, skipped = 0, failed = 0;
  const queue = [...accounts];
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let a = queue.shift(); a; a = queue.shift()) {
      const prof = await odJson<any>(`/players/${a}`).catch(() => null);
      if (!prof) { failed++; continue; }
      if (prof.profile && prof.profile.fh_unavailable !== true) { skipped++; continue; }
      const res = await fetch(odUrl(`/players/${a}/refresh`), { method: 'POST', cache: 'no-store', headers: { 'User-Agent': 'tournament-draft-prep' } }).catch(() => null);
      if (res?.ok) queued++; else failed++;
    }
  }));
  return { queued, skipped, failed };
}

// The cached histories are keyed by a version kept in Firestore, so one bump empties the cache on
// every server instance. For a while after a refresh the key also changes every 15 minutes, so
// games OpenDota adds later still come through.
const historyDoc = () => getAdminDb().collection('draftPrepData').doc('history');
export const HISTORY_FRESH_WINDOW_MS = 2 * 3600e3;
let historyState: { at: number; version: number; refreshedAt: string | null } | null = null;

export async function historyCacheState(): Promise<{ version: number; refreshedAt: string | null }> {
  if (historyState && Date.now() - historyState.at < 30_000) return historyState;
  ensureAdminInitialized();
  const d = (await historyDoc().get().catch(() => null))?.data();
  historyState = { at: Date.now(), version: Number(d?.version) || 0, refreshedAt: (d?.refreshedAt as string | undefined) ?? null };
  return historyState;
}

export async function bumpHistoryVersion(by: string): Promise<string> {
  ensureAdminInitialized();
  const refreshedAt = new Date().toISOString();
  await historyDoc().set({ version: FieldValue.increment(1), refreshedAt, refreshedBy: by }, { merge: true });
  historyState = null;
  return refreshedAt;
}

/** Steam profile link (/profiles/… or /id/vanity) → account id (steamId32) */
export async function resolveAccount(url: string): Promise<string | null> {
  return resolveProfileUrl(url);
}

export function mergeHistories(parts: Array<{ account: string; data: Awaited<ReturnType<typeof accountHistory>> }>): DpHistory {
  const seen = new Set<number>();
  const rows: DpMatchRow[] = [];
  parts.forEach((p, i) => {
    for (const r of p.data.rows) { if (seen.has(r[0])) continue; seen.add(r[0]); rows.push([r[0], r[1], r[2], r[3], r[4], r[5], r[6] ?? 0, i]); }
  });
  rows.sort((a, b) => a[1] - b[1]);
  const main = parts[0]?.data;
  return { name: main?.name, avatar: main?.avatar, rankTier: main?.rankTier, accounts: parts.length, rows, positions: parts.reduce((a, p) => a + (p.data.positions ?? 0), 0) };
}

// ── Meta: patches + hero stats ──────────────────────────────────────────────

export async function buildMeta(): Promise<DpMeta> {
  const [patches, stats] = await Promise.all([odJson<any[]>('/constants/patch'), odJson<any[]>('/heroStats')]);
  return {
    patches: patches.map(p => ({ name: String(p.name), start: Math.floor(Date.parse(p.date) / 1000) })).sort((a, b) => a.start - b.start),
    heroes: stats.map(h => ({
      id: h.id, cm: h.cm_enabled !== false,
      proPick: h.pro_pick ?? 0, proWin: h.pro_win ?? 0, proBan: h.pro_ban ?? 0,
      hiPick: (h['7_pick'] ?? 0) + (h['8_pick'] ?? 0), hiWin: (h['7_win'] ?? 0) + (h['8_win'] ?? 0),
      pubPick: h.pub_pick ?? 0, pubWin: h.pub_win ?? 0,
    })),
  };
}

/** How `hero` did against every other hero in professional matches: [otherHero, games, winsOfHero] */
export async function heroMatchups(hero: number): Promise<Array<[number, number, number]>> {
  const list = await odJson<Array<{ hero_id: number; games_played: number; wins: number }>>(`/heroes/${hero}/matchups`);
  return list.map(x => [x.hero_id, x.games_played, x.wins]);
}

// ── Hero data from STRATZ: positions and matchups, kept in Firestore ────────
// Fetched by an admin (on tournament creation, and from the admin panel) in a few short steps so
// no single request runs long; read by everyone through /api/draft-prep/heroes.

const heroDoc = () => getAdminDb().collection('draftPrepData').doc('heroes');
const HERO_BATCH = 30;
const round2 = (x: number) => Math.round(x * 100) / 100;

async function stratzQuery(query: string): Promise<any> {
  const token = process.env.STRATZ_API_KEY;
  if (!token) throw new Error('Brak STRATZ_API_KEY');
  await stratzSlot();
  const res = await fetch('https://api.stratz.com/graphql', {
    method: 'POST', cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'STRATZ_API' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`STRATZ: ${res.status}`);
  return res.json();
}

/** When the stored hero data was completed (null = never) */
export async function heroDataUpdatedAt(): Promise<string | null> {
  ensureAdminInitialized();
  return ((await heroDoc().get()).data()?.updatedAt as string | undefined) ?? null;
}

/**
 * One step of the refresh. Step 0 stores games per position and the hero list; step k ≥ 1 the
 * matchups of the k-th batch of heroes. Returns the number of steps, and whether this was the last.
 */
export async function refreshHeroData(step: number): Promise<{ steps: number; done: boolean }> {
  ensureAdminInitialized();
  const doc = heroDoc();
  if (step === 0) {
    const j = await stratzQuery('{ heroStats { stats(groupByPosition: true) { heroId position matchCount } } }');
    const rows: any[] = j?.data?.heroStats?.stats ?? [];
    const pos: Record<string, number[]> = {};
    for (const r of rows) {
      const i = Number(String(r.position ?? '').replace('POSITION_', '')) - 1;
      if (i < 0 || i > 4 || !r.heroId) continue;
      (pos[r.heroId] ??= [0, 0, 0, 0, 0])[i] += r.matchCount ?? 0;
    }
    const heroes = Object.keys(pos).map(Number).sort((a, b) => a - b);
    if (!heroes.length) throw new Error('STRATZ nie zwrócił danych o pozycjach');
    await doc.set({ pos, heroes, startedAt: new Date().toISOString() }, { merge: true });
    return { steps: 1 + Math.ceil(heroes.length / HERO_BATCH), done: false };
  }
  const heroes: number[] = (await doc.get()).data()?.heroes ?? [];
  const steps = 1 + Math.ceil(heroes.length / HERO_BATCH);
  const batch = getAdminDb().batch();
  for (const h of heroes.slice((step - 1) * HERO_BATCH, step * HERO_BATCH)) {
    const j = await stratzQuery(`{ heroStats { heroVsHeroMatchup(heroId: ${h}, take: 200) { advantage { vs { heroId2 synergy matchCount } with { heroId2 synergy } } } } }`);
    const adv = j?.data?.heroStats?.heroVsHeroMatchup?.advantage?.[0];
    if (!adv?.vs) continue;
    const withMap = new Map<number, number>((adv.with ?? []).map((x: any) => [x.heroId2, x.synergy ?? 0]));
    // Firestore can't store nested arrays: one compact "hero:vs:with:games" list per hero
    const rows = (adv.vs as any[]).map(x => [x.heroId2, round2(x.synergy ?? 0), round2(withMap.get(x.heroId2) ?? 0), x.matchCount ?? 0].join(':')).join(',');
    batch.set(doc.collection('matchups').doc(String(h)), { rows });
  }
  await batch.commit();
  const done = step >= steps - 1;
  if (done) await doc.set({ updatedAt: new Date().toISOString() }, { merge: true });
  return { steps, done };
}

/** Everything stored, for the browser */
export async function loadHeroData(): Promise<DpHeroData> {
  ensureAdminInitialized();
  const doc = heroDoc();
  const [main, mus] = await Promise.all([doc.get(), doc.collection('matchups').get()]);
  const d = main.data();
  if (!d?.updatedAt) return { updatedAt: null, pos: {}, mu: {} };
  const mu: DpHeroData['mu'] = {};
  for (const m of mus.docs) {
    mu[m.id] = String(m.data().rows || '').split(',').filter(Boolean).map(r => r.split(':').map(Number) as [number, number, number, number]);
  }
  return { updatedAt: d.updatedAt, pos: d.pos ?? {}, mu };
}

/** Name search for manually added standins */
export async function searchPlayers(q: string) {
  const list = await odJson<Array<{ account_id: number; personaname: string; avatarfull?: string; last_match_time?: string }>>(`/search?q=${encodeURIComponent(q)}`);
  return list.slice(0, 12).map(p => ({ account: String(p.account_id), name: p.personaname, avatar: p.avatarfull, last: p.last_match_time }));
}
