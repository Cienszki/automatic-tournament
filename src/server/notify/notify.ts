// Notifications for accounts. Each one is an inbox item (accounts/{uid}/inbox/{id}, written only
// here; the bell reads it through /api/inbox), plus a Discord DM when the person chose that for
// its type (accounts/{uid}.notify.discord[type], defaults in NOTIFY_TYPES).
//
// Every notification has a `key` naming the event (e.g. "reschedule:<match>:<request>:pending").
// The item id comes from key + account, so sending the same event twice is a no-op: callers may
// re-derive and re-send freely (the event hints from the browser rely on that).

import { createHash } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { ensureAdminInitialized, getAdminDb } from '@/server/lib/admin';
import { NOTIFY_TYPES, type NotifyType } from '@/lib/notify-types';
import { sendDm } from './discord-dm';
import { steam64ToSteam32 } from '@/lib/steam-id-utils';

export const SITE = 'https://dota2inhouse.pl';

export interface Note {
  type: NotifyType;
  key: string;
  title: string;
  body: string;
  /** Path on our site, e.g. /pdl-s2/account */
  href?: string | null;
  tournament?: TournamentInfo | null;
}
export interface TournamentInfo { id: string; name: string; slug: string; color: number | null; leagueName: string }

const db = () => { ensureAdminInitialized(); return getAdminDb(); };

const hexColor = (c: unknown) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? parseInt(c.slice(1), 16) : null);

export async function tournamentInfo(id: string): Promise<TournamentInfo | null> {
  const t = (await db().collection('tournaments').doc(id).get()).data();
  if (!t) return null;
  return { id, name: t.name ?? '', slug: t.slug ?? id, color: hexColor(t.theme?.primaryColor), leagueName: t.lobbySettings?.leagueName || t.name || '' };
}

/** Sends one notification to these accounts; returns how many got it for the first time */
export async function notify(uids: Iterable<string | null | undefined>, n: Note): Promise<number> {
  const to = [...new Set([...uids].filter((u): u is string => !!u))];
  let fresh = 0;
  for (const uid of to) {
    const id = createHash('sha1').update(`${n.key}|${uid}`).digest('hex').slice(0, 24);
    const ref = db().collection('accounts').doc(uid).collection('inbox').doc(id);
    try {
      await ref.create({
        type: n.type, key: n.key, title: n.title, body: n.body, href: n.href ?? null,
        tournamentId: n.tournament?.id ?? null, tournament: n.tournament?.name ?? null,
        createdAt: FieldValue.serverTimestamp(), readAt: null, dm: null,
      });
    } catch (e) {
      if ((e as { code?: number }).code === 6) continue; // ALREADY_EXISTS: this event already reached them
      console.error('[notify] inbox write failed:', e);
      continue;
    }
    fresh++;
    await deliverDm(uid, ref, n).catch(e => console.warn('[notify] dm step failed:', e));
  }
  return fresh;
}

async function deliverDm(uid: string, ref: FirebaseFirestore.DocumentReference, n: Note) {
  const acc = (await db().collection('accounts').doc(uid).get()).data();
  const discordId = acc?.discord?.id as string | undefined;
  const wants = (acc?.notify?.discord?.[n.type] as boolean | undefined) ?? NOTIFY_TYPES[n.type].discord;
  if (!discordId || !wants) return;
  const res = await sendDm(discordId, {
    title: n.title, body: n.body,
    url: n.href ? `${SITE}${n.href}` : null,
    footer: n.tournament?.name ?? null,
    color: n.tournament?.color ?? null,
  });
  await ref.update({ dm: res });
  // Remember why DMs don't arrive, so the settings can say what to do about it
  if (res === 'blocked') await db().collection('accounts').doc(uid).set({ dmProblem: 'blocked' }, { merge: true });
  else if (res === 'sent' && acc?.dmProblem) await db().collection('accounts').doc(uid).update({ dmProblem: FieldValue.delete() });
}

/**
 * The same notification for people known only by their Steam accounts (a roster, standins):
 * those with an account get it as usual; the others get a Discord DM when the inhouse bot knows
 * their Discord (inhousePlayers/{discordId}.steamIds, Steam32), once per event (dmLog).
 */
export async function notifySteam(steamIds64: Iterable<string>, n: Note): Promise<number> {
  const ids = [...new Set([...steamIds64].filter(s => /^\d{17}$/.test(s)))];
  if (!ids.length) return 0;
  const links = await db().getAll(...ids.map(id => db().collection('steamLinks').doc(id)));
  const uids = links.map(l => l.data()?.uid as string | undefined).filter((u): u is string => !!u);
  let sent = await notify(uids, n);

  const rest = ids.filter((_, i) => !links[i].data()?.uid).map(steam64ToSteam32);
  for (let i = 0; i < rest.length; i += 30) {
    const chunk = rest.slice(i, i + 30);
    const players = await db().collection('inhousePlayers').where('steamIds', 'array-contains-any', chunk).get();
    for (const p of players.docs) {
      // A Discord user who has an account after all (logged in with Discord, Steam not linked)
      const owner = (await db().collection('discordLinks').doc(p.id).get()).data()?.uid as string | undefined;
      if (owner) { sent += await notify([owner], n); continue; }
      if (NOTIFY_TYPES[n.type].discord && await dmOnce(p.id, n)) sent++;
    }
  }
  return sent;
}

/** A DM to someone without an account; false when this event already reached them */
async function dmOnce(discordId: string, n: Note): Promise<boolean> {
  const ref = db().collection('dmLog').doc(createHash('sha1').update(`${n.key}|${discordId}`).digest('hex').slice(0, 24));
  try { await ref.create({ key: n.key, discordId, at: FieldValue.serverTimestamp() }); }
  catch (e) { if ((e as { code?: number }).code === 6) return false; throw e; }
  const res = await sendDm(discordId, { title: n.title, body: n.body, url: n.href ? `${SITE}${n.href}` : null, footer: n.tournament?.name ?? null, color: n.tournament?.color ?? null });
  await ref.update({ dm: res });
  return res === 'sent';
}

// ── Who to tell ─────────────────────────────────────────────────────────────

/** Accounts linked to these Steam64 ids */
export async function uidsForSteam(steamIds: Iterable<string>): Promise<string[]> {
  const ids = [...new Set([...steamIds].filter(s => /^\d{17}$/.test(s)))];
  if (!ids.length) return [];
  const snaps = await db().getAll(...ids.map(id => db().collection('steamLinks').doc(id)));
  return snaps.map(s => s.data()?.uid as string | undefined).filter((u): u is string => !!u);
}

export interface TeamInfo { id: string; name: string; tag: string; captainId: string | null; steamIds: string[] }

export async function teamInfo(tournamentId: string, teamId: string): Promise<TeamInfo | null> {
  if (!teamId) return null;
  const ref = db().collection('tournaments').doc(tournamentId).collection('teams').doc(teamId);
  const [t, players] = await Promise.all([ref.get(), ref.collection('players').get()]);
  if (!t.exists) return null;
  const d = t.data()!;
  const steamIds = new Set<string>(Object.keys(d.roster ?? {}));
  players.docs.forEach(p => { const s = p.data().steamId64 ?? p.data().steamId; if (s) steamIds.add(String(s)); });
  return { id: teamId, name: d.name ?? '', tag: d.tag ?? '', captainId: d.captainId || null, steamIds: [...steamIds] };
}

/** The captain, or the captain and every player with a linked Steam account */
export async function teamUids(team: TeamInfo | null, who: 'captain' | 'all'): Promise<string[]> {
  if (!team) return [];
  if (who === 'captain') return team.captainId ? [team.captainId] : [];
  return [...new Set([...(team.captainId ? [team.captainId] : []), ...await uidsForSteam(team.steamIds)])];
}

// ── Wording ─────────────────────────────────────────────────────────────────

/** "środa 18 listopada, 20:00" in Polish time */
export function plDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const p = Object.fromEntries(new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(d).map(x => [x.type, x.value]));
  return `${p.weekday} ${p.day} ${p.month}, ${p.hour}:${p.minute}`;
}
export const plTime = (iso: string) => new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
