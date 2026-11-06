// Packs for everyone when a round is over: once every match of a league kolejka / Swiss round /
// calendar week (MMR-limited) / the playoffs is played and its games are in, so the team of that
// round is final, every card collection of the tournament gets `cardSettings.roundPacks` packs and
// a notification. Runs inside the 5-minute orchestrate call.
//
// State per tournament in cardRewards/{tournamentId} (server only):
//   done[]   rounds already rewarded (or already over when the tournament was first seen: no
//            packs for the past, only for rounds that end from then on)
//   ready{}  round → when it first looked complete; packs go out ~25 min later, so the stats and
//            card caches (10 min each) already hold that round's team-of-the-round cards
//   checkedAt, closed (a finished tournament with everything rewarded)
// A tournament is first looked at once somebody has cards in it.
// Every grant is also logged in cardGrants (the admin's history).

import { FieldValue } from 'firebase-admin/firestore';
import { ensureAdminInitialized, getAdminDb } from '@/server/lib/admin';
import { countsForStats } from '@/lib/match-flags';
import { fmtShort, mondayOf } from '@/lib/stats-lab/season';
import { cardSettingsOf, roundWord } from '@/lib/card-lab/settings';
import { count } from '@/lib/plural';
import { notify, tournamentInfo } from '@/server/notify/notify';
import { addPacksToAll } from './collection';

const CHECK_EVERY = 15 * 60_000;
const SETTLE = 25 * 60_000;
/** A round whose games never arrive (a result typed in by hand) is rewarded anyway after this */
const GIVE_UP = 24 * 3600_000;

interface Round { key: string; label: string; matches: FirebaseFirestore.DocumentData[]; open: boolean }

const ms = (v: unknown): number | null => {
  if (!v) return null;
  if (typeof v === 'string') { const t = Date.parse(v); return Number.isFinite(t) ? t : null; }
  const x = v as { toMillis?: () => number; seconds?: number };
  return x.toMillis ? x.toMillis() : typeof x.seconds === 'number' ? x.seconds * 1000 : typeof v === 'number' ? v : null;
};

/** The tournament's rounds as its "team of the …" slices them (see seasonPeriods), with their matches */
export function roundsOf(matches: FirebaseFirestore.DocumentData[], type: string | undefined, tournamentDone: boolean, now: number): Round[] {
  const by = new Map<string, Round>();
  const add = (key: string, label: string, m: FirebaseFirestore.DocumentData) => {
    if (!by.has(key)) by.set(key, { key, label, matches: [], open: false });
    by.get(key)!.matches.push(m);
  };
  const multiRound = type === 'league' && new Set(matches.filter(m => !m.isPlayoff).map(m => m.round || 1)).size > 1;
  const thisWeek = mondayOf(now / 1000);
  for (const m of matches) {
    if (!countsForStats(m) || !(m.teamA?.id || m.teams?.[0]) || !(m.teamB?.id || m.teams?.[1])) continue;
    if (m.isPlayoff) { add('po', 'Playoffy', m); continue; }
    if (type === 'league') {
      const r = m.round || 1, md = m.matchday || 1;
      add(`r${r}-k${md}`, multiRound ? `Runda ${r} · kolejka ${md}` : `Kolejka ${md}`, m);
    } else if (type === 'swiss') {
      const r = m.round || m.matchday || 1;
      add(`r${r}`, `Runda ${r}`, m);
    } else {
      // Calendar weeks: a match belongs to the week it is (or was) played in; unscheduled ones to none
      const at = m.status === 'completed' ? ms(m.completedAt) ?? ms(m.scheduledFor) : ms(m.scheduledFor);
      if (at == null) continue;
      const mon = mondayOf(at / 1000);
      const sun = new Date(new Date(mon + 'T12:00:00Z').getTime() + 6 * 864e5).toISOString().slice(0, 10);
      add(mon, `Tydzień ${fmtShort(mon)} – ${fmtShort(sun)}`, m);
      if (mon >= thisWeek) by.get(mon)!.open = true; // the week is not over yet
    }
  }
  // The bracket's later matches may not exist yet: playoffs are over when the tournament is
  if (by.has('po') && !tournamentDone) by.get('po')!.open = true;
  return [...by.values()];
}

/** Every match played and every played series' games in (forfeits and byes have none) */
export async function complete(tid: string, r: Round, now: number): Promise<boolean> {
  if (r.open || !r.matches.length || r.matches.some(m => m.status !== 'completed')) return false;
  const last = Math.max(...r.matches.map(m => ms(m.completedAt) ?? ms(m.updatedAt) ?? now));
  if (now - last > GIVE_UP) return true;
  const col = getAdminDb().collection('tournaments').doc(tid).collection('matches');
  const played = r.matches.filter(m => !m.isBanForfeit && !m.isSwissByeMatch && !m.isForfeit);
  const games = await Promise.all(played.map(m => col.doc(m.id).collection('games').limit(1).get()));
  return games.every(g => !g.empty);
}

/** Returns how many collections got packs; `only` limits it to one tournament */
export async function roundRewards(now = Date.now(), only?: string): Promise<number> {
  ensureAdminInitialized();
  const db = getAdminDb();
  const ts = await db.collection('tournaments').where('status', 'in', ['active', 'playoffs', 'completed']).get();
  let given = 0;
  for (const t of ts.docs) {
    if (only && t.id !== only) continue;
    const data = t.data();
    const metaRef = db.collection('cardRewards').doc(t.id);
    const meta = (await metaRef.get()).data();
    if (meta?.closed || (data.status === 'completed' && !meta)) continue; // finished before we watched it
    if (meta && now - (ms(meta.checkedAt) ?? 0) < CHECK_EVERY) continue;
    try {
      // Nobody collects cards here yet: nothing to give, and no match reads
      if (!meta && (await db.collection('cardCollections').where('tournament', '==', t.id).limit(1).get()).empty) continue;
      const matchSnap = await db.collection('tournaments').doc(t.id).collection('matches').get();
      const rounds = roundsOf(matchSnap.docs.map(d => ({ id: d.id, ...d.data() })), data.type, data.status === 'completed', now);
      const done = new Set<string>(meta?.done ?? []);
      const doneNow = new Set<string>();
      for (const r of rounds) if (!done.has(r.key) && await complete(t.id, r, now)) doneNow.add(r.key);
      if (!meta) { // first look: what is already over is not rewarded
        await metaRef.set({ done: [...doneNow], ready: {}, checkedAt: now, seededAt: now });
        continue;
      }
      const ready: Record<string, number> = { ...(meta.ready ?? {}) };
      const settings = cardSettingsOf(data);
      for (const r of rounds) {
        if (done.has(r.key)) continue;
        if (!doneNow.has(r.key)) { delete ready[r.key]; continue; }
        if (!ready[r.key]) { ready[r.key] = now; continue; }
        if (now - ready[r.key] < SETTLE) continue;
        // Claim the round first, so two overlapping runs can't both give packs
        const claimed = await db.runTransaction(async tx => {
          const cur = (await tx.get(metaRef)).data();
          if ((cur?.done ?? []).includes(r.key)) return false;
          tx.update(metaRef, { done: FieldValue.arrayUnion(r.key) });
          return true;
        });
        done.add(r.key); delete ready[r.key];
        if (!claimed || settings.roundPacks <= 0) continue;
        const n = settings.roundPacks;
        const uids = await addPacksToAll(t.id, n);
        await db.collection('cardGrants').add({ tournament: t.id, kind: 'round', round: r.key, label: r.label, n, uids: uids.length, by: null, at: FieldValue.serverTimestamp() });
        const info = await tournamentInfo(t.id);
        await notify(uids, {
          type: 'packs', key: `packs:round:${t.id}:${r.key}`, tournament: info,
          title: `${count(n, 'paczka', 'paczki', 'paczek')} do otwarcia`,
          body: `${r.label} za nami. Nowe karty ${roundWord(data.type).teamOf} są już w paczkach.`,
          href: `/${info?.slug ?? data.slug}/cards`,
        });
        given += uids.length;
      }
      const allDone = data.status === 'completed' && rounds.every(r => done.has(r.key));
      await metaRef.update({ ready, checkedAt: now, ...(allDone ? { closed: true } : {}) });
    } catch (e) {
      console.error(`[cards] round rewards for ${t.id} failed:`, e);
    }
  }
  return given;
}
