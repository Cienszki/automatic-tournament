// What happened → who hears about it. Every function here reads the current state from Firestore
// and words the notification from that, never from what a browser sent, so the event hints in
// /api/notify can't be used to send made-up messages (and repeats are dropped by the note key).

import { ensureAdminInitialized, getAdminDb } from '@/server/lib/admin';
import { lobbyNameFor } from '@/lib/bot/lobby-name';
import type { MatchCaster } from '@/lib/casters';
import { createHash } from 'crypto';
import { steam32to64 } from '@/server/accounts/identity';
import { notify, notifySteam, plDate, plTime, teamInfo, teamUids, tournamentInfo, type TournamentInfo } from './notify';

const db = () => { ensureAdminInitialized(); return getAdminDb(); };


/** A match from `matches` or the legacy `playoff_matches` */
export async function getMatch(tournamentId: string, matchId: string) {
  const t = db().collection('tournaments').doc(tournamentId);
  for (const col of ['matches', 'playoff_matches']) {
    const s = await t.collection(col).doc(matchId).get();
    if (s.exists) return { ref: s.ref, data: s.data()! };
  }
  return null;
}

const casterUids = (m: FirebaseFirestore.DocumentData) => ((m.casters ?? []) as MatchCaster[]).map(c => c.uid);

/** Everyone with the caster role in the tournament (tournaments/{id}/casters/{uid}) */
async function allCasterUids(tournamentId: string): Promise<string[]> {
  const s = await db().collection('tournaments').doc(tournamentId).collection('casters').select().get();
  return s.docs.map(d => d.id);
}

/** Who casts the match already, so a free caster sees at once whether it still needs one */
function castLine(m: FirebaseFirestore.DocumentData): string {
  const c = ((m.casters ?? []) as MatchCaster[]).slice().sort((a, b) => Number(b.main) - Number(a.main));
  return c.length ? `Castuje: ${c.map(x => x.name).join(', ')}` : 'Nikt go jeszcze nie castuje';
}

/**
 * New or moved match times for the tournament's casters who don't cast those matches (theirs get
 * their own message): one message per caster, so a caster with a free evening can pick a match up.
 */
async function tellFreeCasters(t: TournamentInfo, matches: Array<{ id: string; data: FirebaseFirestore.DocumentData }>, fresh: boolean): Promise<number> {
  const timed = matches.filter(m => m.data.scheduledFor)
    .sort((p, q) => String(p.data.scheduledFor).localeCompare(String(q.data.scheduledFor)));
  if (!timed.length) return 0;
  const key = `${fresh ? 'new-matches' : 'new-times'}:${createHash('sha1').update(timed.map(m => `${m.id}@${m.data.scheduledFor}`).join(',')).digest('hex').slice(0, 16)}`;
  let sent = 0;
  for (const uid of await allCasterUids(t.id)) {
    const open = timed.filter(m => !casterUids(m.data).includes(uid));
    if (!open.length) continue;
    const one = open.length === 1 ? open[0].data : null;
    const lines = open.slice(0, 8).map(m => `${plDate(m.data.scheduledFor)} · ${m.data.teamA.name} vs ${m.data.teamB.name} · ${castLine(m.data)}`);
    sent += await notify([uid], {
      type: 'cast_schedule', key, href: `/${t.slug}/account`, tournament: t,
      title: one
        ? (fresh ? 'Nowy mecz do castowania' : `${one.teamA.name} vs ${one.teamB.name}: nowy termin`)
        : (fresh ? `Nowe mecze do castowania (${open.length})` : `Nowe terminy meczów (${open.length})`),
      body: one
        ? `**${plDate(one.scheduledFor)}**${fresh ? ` · ${one.teamA.name} vs ${one.teamB.name}` : ''}\n${castLine(one)}.`
        : lines.join('\n') + (open.length > lines.length ? `\n…i ${open.length - lines.length} więcej` : ''),
    });
  }
  return sent;
}

// ── Match time ──────────────────────────────────────────────────────────────

/** A captain proposed a new time, or the other captain answered */
export async function rescheduleEvent(tournamentId: string, matchId: string) {
  const [m, t] = await Promise.all([getMatch(tournamentId, matchId), tournamentInfo(tournamentId)]);
  const rr = m?.data.rescheduleRequest;
  if (!m || !t || !rr?.requestedBy) return 0;
  const from = rr.requestedBy === m.data.teamA?.id ? m.data.teamA : m.data.teamB;
  const other = rr.requestedBy === m.data.teamA?.id ? m.data.teamB : m.data.teamA;
  const [fromTeam, otherTeam] = await Promise.all([teamInfo(tournamentId, from?.id), teamInfo(tournamentId, other?.id)]);
  const key = `reschedule:${matchId}:${rr.createdAt}:${rr.status}`;
  const href = `/${t.slug}/account`;

  if (rr.status === 'pending') {
    return notify(await teamUids(otherTeam, 'captain'), {
      type: 'schedule', key, href, tournament: t,
      title: `Nowy termin meczu z ${from?.name ?? 'rywalem'}?`,
      body: `Drużyna ${from?.name} proponuje: **${plDate(rr.proposedDate)}**.\nTeraz mecz jest ${plDate(rr.originalDate)}.`,
    });
  }
  if (rr.status === 'approved') {
    const n = await notify(await teamUids(fromTeam, 'captain'), {
      type: 'schedule', key, href, tournament: t,
      title: 'Nowy termin przyjęty',
      body: `Drużyna ${other?.name} przyjęła twoją propozycję. Mecz: **${plDate(rr.proposedDate)}**.`,
    });
    // Casters planned their evening around the old time
    const mine = await notify(casterUids(m.data), {
      type: 'caster', key: `${key}:casters`, href, tournament: t,
      title: `${m.data.teamA?.name} vs ${m.data.teamB?.name}: nowy termin`,
      body: `Mecz przełożony na **${plDate(rr.proposedDate)}**.`,
    });
    // …and the new time may fit a caster who couldn't make the old one
    return n + mine + await tellFreeCasters(t, [{ id: matchId, data: { ...m.data, scheduledFor: m.data.scheduledFor ?? rr.proposedDate } }], false);
  }
  if (rr.status === 'rejected') {
    return notify(await teamUids(fromTeam, 'captain'), {
      type: 'schedule', key, href, tournament: t,
      title: 'Nowy termin odrzucony',
      body: `Drużyna ${other?.name} nie przyjęła propozycji. Mecz zostaje ${plDate(rr.originalDate)}.`,
    });
  }
  return 0;
}

// ── Standins ────────────────────────────────────────────────────────────────

/** A standin request was sent (to the other captain), decided, or its appeal resolved (to the asking captain) */
export async function standinEvent(tournamentId: string, requestId: string) {
  const [s, t] = await Promise.all([
    db().collection('tournaments').doc(tournamentId).collection('standinRequests').doc(requestId).get(),
    tournamentInfo(tournamentId),
  ]);
  const r = s.data();
  if (!r || !t) return 0;
  const href = `/${t.slug}/account`;
  const key = `standin:${requestId}:${r.status}:${r.updatedAt ?? ''}`;
  const swap = `${r.standinNickname} zamiast ${r.replacedPlayerNickname}`;
  const asking = await teamInfo(tournamentId, r.teamId);

  switch (r.status) {
    case 'pending': {
      const opponent = await teamInfo(tournamentId, r.opponentTeamId);
      return notify(await teamUids(opponent, 'captain'), {
        type: 'standin', key, href, tournament: t,
        title: `Prośba o standina: ${r.requestingTeamName ?? asking?.name}`,
        body: `Drużyna ${r.requestingTeamName ?? asking?.name} chce zagrać z graczem **${swap}**. Zgódź się albo odmów.`,
      });
    }
    case 'approved':
    case 'rejected':
    case 'appeal_approved':
    case 'appeal_rejected': {
      const yes = r.status === 'approved' || r.status === 'appeal_approved';
      const appeal = r.status.startsWith('appeal');
      return notify(await teamUids(asking, 'captain'), {
        type: 'standin', key, href, tournament: t,
        title: appeal ? (yes ? 'Odwołanie przyjęte' : 'Odwołanie odrzucone') : (yes ? 'Standin zatwierdzony' : 'Standin odrzucony'),
        body: yes
          ? `Możesz zagrać z graczem **${swap}**.`
          : `Nie możesz zagrać z graczem ${swap}.${r.rejectionReason || r.denialReason ? `\nPowód: ${r.rejectionReason || r.denialReason}` : ''}${appeal ? '' : '\nMożesz się odwołać do organizatorów.'}`,
      });
    }
  }
  return 0;
}

// ── Announcements ───────────────────────────────────────────────────────────

/** An organizers' post went public: everyone on a team of the tournament hears about it, once */
export async function announcementEvent(tournamentId: string, postId: string) {
  const tRef = db().collection('tournaments').doc(tournamentId);
  const [post, t, teams] = await Promise.all([tRef.collection('announcements').doc(postId).get(), tournamentInfo(tournamentId), tRef.collection('teams').select().get()]);
  const p = post.data();
  if (!p?.published || !t) return 0;
  const people = (await Promise.all(teams.docs.map(async d => teamUids(await teamInfo(tournamentId, d.id), 'all')))).flat();
  const text = String(p.excerpt || p.content || '').replace(/\s+/g, ' ').trim();
  return notify(people, {
    type: 'announcement', key: `announcement:${postId}`, href: `/${t.slug}/news`, tournament: t,
    title: String(p.title || 'Ogłoszenie'),
    body: text.length > 280 ? `${text.slice(0, 277)}…` : text,
  });
}

// ── Reminders (from the Conductor's 5-minute call to /api/manage/bot/orchestrate) ─

const SOON_MS = 60 * 60 * 1000;

/** "Mecz za godzinę" for both rosters and the match's casters; sent once per match and time */
export async function sendMatchReminders(now = Date.now()): Promise<number> {
  const tournaments = await db().collection('tournaments').where('status', '==', 'active').get();
  let sent = 0;
  for (const tDoc of tournaments.docs) {
    const matches = await tDoc.ref.collection('matches')
      .where('scheduledFor', '>=', new Date(now).toISOString())
      .where('scheduledFor', '<=', new Date(now + SOON_MS).toISOString())
      .get();
    const due = matches.docs.filter(d => d.data().status !== 'completed' && d.data().teamA?.id && d.data().teamB?.id);
    if (!due.length) continue;
    const t = await tournamentInfo(tDoc.id);
    if (!t) continue;
    const bot = (await tDoc.ref.collection('config').doc('bot').get()).data();
    for (const d of due) sent += await remind(t, d.id, d.data(), bot);
  }
  return sent;
}

async function remind(t: TournamentInfo, matchId: string, m: FirebaseFirestore.DocumentData, bot: FirebaseFirestore.DocumentData | undefined) {
  const [a, b] = await Promise.all([teamInfo(t.id, m.teamA.id), teamInfo(t.id, m.teamB.id)]);
  const lobby = bot?.enabled
    ? `\nLobby: **${lobbyNameFor(t.leagueName, a, b)}**${bot.passwordVisibleToPlayers !== false && bot.lobby?.password?.trim() ? `, hasło: **${bot.lobby.password.trim()}**` : ''}`
    : '';
  const key = `soon:${matchId}:${m.scheduledFor}`;
  const title = `${m.teamA.name} vs ${m.teamB.name} o ${plTime(m.scheduledFor)}`;
  // Everyone who plays: both rosters and the standins approved for this match
  const standins = Object.values((m.approvedStandins ?? {}) as Record<string, { steamId32?: string }>)
    .map(s => s.steamId32).filter((s): s is string => !!s && /^\d+$/.test(s)).map(steam32to64);
  const captains = [a?.captainId, b?.captainId];
  const note = { type: 'match_soon' as const, key, title, href: `/${t.slug}/account`, tournament: t, body: `Mecz zaczyna się za mniej niż godzinę.${lobby}` };
  return await notify(captains, note)
    + await notifySteam([...(a?.steamIds ?? []), ...(b?.steamIds ?? []), ...standins], note)
    + await notify(casterUids(m), { ...note, key: `${key}:casters`, body: `Castujesz ten mecz.${lobby}` });
}

// ── Times set by an admin ───────────────────────────────────────────────────

/**
 * An admin set or changed match times and chose to tell people: both captains and the match's
 * casters hear each time; the tournament's other casters get one message listing the new or moved
 * matches (`fresh` = a new round or new matches), so they can pick one up.
 */
export async function matchTimeEvent(tournamentId: string, matchIds: string[], fresh: boolean) {
  const t = await tournamentInfo(tournamentId);
  if (!t) return 0;
  const found = (await Promise.all(matchIds.map(id => getMatch(tournamentId, id)))).flatMap((m, i) => (m && m.data.teamA?.id && m.data.teamB?.id && m.data.status !== 'completed' && !m.data.isSwissByeMatch ? [{ id: matchIds[i], ...m }] : []));
  const href = `/${t.slug}/account`;
  let sent = 0;
  for (const m of found) {
    const x = m.data;
    const [a, b] = await Promise.all([teamInfo(tournamentId, x.teamA.id), teamInfo(tournamentId, x.teamB.id)]);
    const when = x.scheduledFor ? `**${plDate(x.scheduledFor)}**` : x.deadline ? `Ustalcie termin do ${plDate(x.deadline)}.` : 'Ustalcie termin z rywalem.';
    const key = `time:${m.id}:${x.scheduledFor ?? x.deadline ?? 'none'}`;
    sent += await notify([...await teamUids(a, 'captain'), ...await teamUids(b, 'captain')], {
      type: 'schedule', key, href, tournament: t,
      title: fresh ? `Nowy mecz: ${x.teamA.name} vs ${x.teamB.name}` : `Nowy termin: ${x.teamA.name} vs ${x.teamB.name}`,
      body: x.scheduledFor ? `Termin: ${when}` : when,
    });
    if (x.scheduledFor) sent += await notify(casterUids(x), {
      type: 'schedule', key: `${key}:casters`, href, tournament: t,
      title: `${x.teamA.name} vs ${x.teamB.name}: nowy termin`, body: `Mecz castujesz ${when}.`,
    });
  }
  // Every other caster of the tournament hears about new and moved times, in one message
  return sent + await tellFreeCasters(t, found, fresh);
}
