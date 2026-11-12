// Casters: a role per tournament, granted by its admins (tournaments/{id}/casters/{uid}, written
// only here). Every caster with a linked Steam account sits on the tournament's lobby whitelist
// (config/bot.whitelist, entries marked `caster: true`), which the lobby bot watches live — so they
// are never kicked from a bot lobby. A caster takes the matches they cast; those carry
// `casters: MatchCaster[]` (src/lib/casters.ts: main caster + co-casters, with Steam32 so the bot
// invites them) and the captains hear who casts and where it streams.

import { FieldValue } from 'firebase-admin/firestore';
import { ensureAdminInitialized, getAdminDb } from '@/server/lib/admin';
import { getAccount } from '@/server/accounts/store';
import { steamAvatar } from '@/server/accounts/identity';
import { steam64ToSteam32 } from '@/lib/steam-id-utils';
import { lobbyNameFor } from '@/lib/bot/lobby-name';
import { coCasters, mainCaster, withMain, type MatchCaster } from '@/lib/casters';
import { getMatch } from '@/server/notify/events';
import { notify, plDate, teamInfo, teamUids, tournamentInfo } from '@/server/notify/notify';

const db = () => { ensureAdminInitialized(); return getAdminDb(); };
const casters = (t: string) => db().collection('tournaments').doc(t).collection('casters');

export interface CasterDoc { uid: string; name: string; avatar: string | null; steamId64: string | null; discord: string | null; stream: string | null }

/** The caster's card from their account as it is now (name, picture, Steam, stream) */
export async function profile(uid: string): Promise<CasterDoc> {
  const acc = await getAccount(uid);
  const steam = acc.steam?.[0]?.id ?? null;
  let avatar: string | null = null;
  if (acc.avatar?.source === 'url') avatar = acc.avatar.url ?? null;
  else if (acc.avatar?.source === 'steam' && steam) avatar = await steamAvatar(steam);
  if (!avatar) avatar = acc.discord?.avatar ?? null;
  return { uid, name: acc.nickname ?? acc.discord?.name ?? 'Caster', avatar, steamId64: steam, discord: acc.discord?.username ?? null, stream: acc.stream ?? null };
}
const onMatch = (p: CasterDoc, main: boolean): MatchCaster => ({
  uid: p.uid, name: p.name, avatar: p.avatar, stream: p.stream, steamId32: p.steamId64 ? steam64ToSteam32(p.steamId64) : null, main,
});

export const isCaster = async (t: string, uid: string) => (await casters(t).doc(uid).get()).exists;

/** The tournament's casters as their accounts are NOW (Steam or Discord linked later shows at once);
 *  a stored card that went stale is rewritten */
export async function listCasters(t: string): Promise<CasterDoc[]> {
  const s = await casters(t).get();
  const list = await Promise.all(s.docs.map(async d => {
    const p = await profile(d.id);
    const was = d.data() as CasterDoc;
    if (p.name !== was.name || p.avatar !== was.avatar || p.steamId64 !== was.steamId64 || p.discord !== was.discord || p.stream !== was.stream) await d.ref.set(p, { merge: true });
    return p;
  }));
  return list.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
}

/** After someone links or unlinks Steam / Discord or renames: their caster cards and the lobby whitelists follow */
export async function refreshCaster(uid: string) {
  const ts = await db().collection('tournaments').get();
  for (const t of ts.docs) {
    if (!(await casters(t.id).doc(uid).get()).exists) continue;
    await casters(t.id).doc(uid).set(await profile(uid), { merge: true });
    await syncWhitelist(t.id);
  }
}

export async function addCaster(t: string, uid: string, by: string) {
  const p = await profile(uid);
  const fresh = !(await casters(t).doc(uid).get()).exists;
  await casters(t).doc(uid).set({ ...p, addedBy: by, addedAt: FieldValue.serverTimestamp() }, { merge: true });
  await syncWhitelist(t);
  const info = await tournamentInfo(t);
  if (fresh && info) {
    await notify([uid], {
      type: 'caster', key: `caster-role:${t}:${uid}`, tournament: info, href: `/${info.slug}/account`,
      title: `Jesteś casterem turnieju ${info.name}`,
      body: p.steamId64
        ? 'Wybierz mecze, które poprowadzisz. Bot zaprosi cię do ich lobby.'
        : 'Wybierz mecze, które poprowadzisz. Połącz konto ze Steam, żeby bot zapraszał cię do lobby.',
    });
  }
  return p;
}

export async function removeCaster(t: string, uid: string) {
  await casters(t).doc(uid).delete();
  // Off the matches still to come (played ones keep who cast them)
  const upcoming = await db().collection('tournaments').doc(t).collection('matches').where('scheduledFor', '>=', new Date().toISOString()).get();
  await Promise.all(upcoming.docs
    .filter(d => ((d.data().casters ?? []) as MatchCaster[]).some(c => c.uid === uid))
    .map(d => d.ref.update({ casters: withMain((d.data().casters as MatchCaster[]).filter(c => c.uid !== uid)) })));
  await syncWhitelist(t);
}

/** Casters' Steam accounts on the lobby whitelist; entries admins added by hand stay as they are */
export async function syncWhitelist(t: string) {
  const list = await listCasters(t);
  const ref = db().collection('tournaments').doc(t).collection('config').doc('bot');
  await db().runTransaction(async tx => {
    const cur = (await tx.get(ref)).data();
    if (!cur) return; // no bot set up for this tournament
    const manual = ((cur.whitelist ?? []) as Array<{ steamId32: string; caster?: boolean }>).filter(e => !e.caster);
    const have = new Set(manual.map(e => e.steamId32));
    const entries = list.filter(c => c.steamId64).map(c => ({
      steamId32: steam64ToSteam32(c.steamId64!), steamId64: c.steamId64!, displayName: c.name,
      ...(c.avatar ? { avatarUrl: c.avatar } : {}), note: 'Caster', caster: true, casterUid: c.uid,
      addedAt: new Date().toISOString(), addedBy: 'casters',
    })).filter(e => !have.has(e.steamId32));
    tx.update(ref, { whitelist: [...manual, ...entries] });
  });
}

/** take: main caster if the match has none, else co-caster · drop: the earliest co-caster takes over · main: hand the lead over */
export type CastAction = 'take' | 'drop' | { main: string };

export async function setCasting(t: string, uid: string, matchId: string, action: CastAction): Promise<{ casters: MatchCaster[] } | { error: string }> {
  if (!(await isCaster(t, uid))) return { error: 'Nie masz roli castera w tym turnieju.' };
  const m = await getMatch(t, matchId);
  if (!m) return { error: 'Nie ma takiego meczu.' };
  if (m.data.status === 'completed') return { error: 'Ten mecz już się odbył.' };
  const p = await profile(uid);

  const res = await db().runTransaction<{ casters: MatchCaster[]; before: MatchCaster | null } | { error: string }>(async tx => {
    const cur = withMain(((await tx.get(m.ref)).data()?.casters ?? []) as MatchCaster[]);
    const before = mainCaster(cur);
    let next: MatchCaster[];
    if (action === 'take') {
      // Fresh name, picture, stream and Steam on every take
      next = cur.some(c => c.uid === uid) ? cur.map(c => (c.uid === uid ? onMatch(p, c.main) : c)) : [...cur, onMatch(p, !before)];
    } else if (action === 'drop') {
      next = withMain(cur.filter(c => c.uid !== uid));
    } else {
      if (before?.uid !== uid) return { error: 'Tylko główny caster może oddać prowadzenie.' };
      if (!cur.some(c => c.uid === action.main)) return { error: 'Ten caster nie castuje tego meczu.' };
      next = withMain(cur, action.main);
    }
    tx.update(m.ref, { casters: next });
    return { casters: next, before };
  });
  if ('error' in res) return res;

  if (action === 'take') {
    // Profile changed since the role was given? Keep the caster list (and the whitelist) current
    await casters(t).doc(uid).set(p, { merge: true });
    if (p.steamId64) await syncWhitelist(t);
  }
  // The captains hear when the match gets a (new) main caster: who it is and where it streams
  const main = mainCaster(res.casters);
  const info = await tournamentInfo(t);
  if (main && main.uid !== res.before?.uid && info) {
    const [a, b] = await Promise.all([teamInfo(t, m.data.teamA?.id), teamInfo(t, m.data.teamB?.id)]);
    const co = coCasters(res.casters).map(c => c.name);
    await notify([...await teamUids(a, 'captain'), ...await teamUids(b, 'captain')], {
      type: 'caster', key: `casting:${matchId}:${main.uid}`, tournament: info, href: `/${info.slug}?view=schedule`,
      title: `${main.name} poprowadzi wasz mecz`,
      body: `${m.data.teamA?.name} vs ${m.data.teamB?.name}, ${plDate(m.data.scheduledFor)}.`
        + (co.length ? `\nCo-caster: ${co.join(', ')}.` : '')
        + (main.stream ? `\nTransmisja: ${main.stream}` : ''),
    });
  }
  return { casters: res.casters };
}

/** The caster's desk: matches still to come in this tournament, soonest first, with the lobby to look for */
export async function casterMatches(t: string) {
  const tRef = db().collection('tournaments').doc(t);
  const [s, teams, bot, info] = await Promise.all([
    tRef.collection('matches').where('scheduledFor', '>=', new Date(Date.now() - 3 * 3600_000).toISOString()).orderBy('scheduledFor').limit(60).get(),
    tRef.collection('teams').select('name', 'tag', 'logoUrl').get(),
    tRef.collection('config').doc('bot').get(),
    tournamentInfo(t),
  ]);
  const byId = new Map(teams.docs.map(d => [d.id, d.data() as { name?: string; tag?: string; logoUrl?: string }]));
  const cfg = bot.data();
  const password = cfg?.enabled && cfg.passwordVisibleToPlayers !== false ? (cfg.lobby?.password ?? '').trim() || null : null;
  return s.docs
    .filter(d => d.data().status !== 'completed' && d.data().teamA?.id && d.data().teamB?.id)
    .map(d => {
      const x = d.data();
      const side = (m: { id: string; name: string; logoUrl?: string }) => ({ id: m.id, name: byId.get(m.id)?.name ?? m.name, tag: byId.get(m.id)?.tag ?? null, logoUrl: byId.get(m.id)?.logoUrl ?? m.logoUrl ?? null });
      const a = side(x.teamA), b = side(x.teamB);
      return {
        id: d.id, scheduledFor: x.scheduledFor as string, teamA: a, teamB: b,
        casters: withMain((x.casters ?? []) as MatchCaster[]), round: x.round ?? null,
        lobby: cfg?.enabled && info ? { name: lobbyNameFor(info.leagueName, { name: a.name, tag: a.tag ?? undefined }, { name: b.name, tag: b.tag ?? undefined }), password } : null,
      };
    });
}
export type CasterMatch = Awaited<ReturnType<typeof casterMatches>>[number];
