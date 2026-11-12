// The caster corner's tournament data (see /api/caster-corner): every series with its stage,
// score, casters, lobby and standins; the rosters (draft-prep context, with MMR); and the other
// tournaments whose stats tell these players' history.

import { ensureAdminInitialized, getAdminDb } from '@/server/lib/admin';
import { casterMatches } from '@/server/casters/casters';
import { withMain, type MatchCaster } from '@/lib/casters';
import { buildContext } from '@/lib/draft-prep/server';
import type { CornerData } from '@/lib/caster-corner/types';

const toIso = (v: any): string | null => {
  if (!v) return null;
  if (typeof v === 'string') return Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null;
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  if (typeof v._seconds === 'number') return new Date(v._seconds * 1000).toISOString();
  return null;
};

export async function cornerData(t: string, uid: string): Promise<CornerData> {
  ensureAdminInitialized();
  const db = getAdminDb();
  const tRef = db.collection('tournaments').doc(t);
  const [tDoc, matchSnap, upcoming, rosters, others] = await Promise.all([
    tRef.get(), tRef.collection('matches').get(), casterMatches(t), buildContext(t), db.collection('tournaments').get(),
  ]);
  const lobbyOf = new Map(upcoming.map(m => [m.id, m.lobby]));
  const standinsOf = new Map(rosters.matches.map(m => [m.id, m.standins]));

  const matches = matchSnap.docs.map(d => {
    const m = d.data() as any;
    if (m.isSwissByeMatch || m.isBanForfeit || !m.teamA?.id || !m.teamB?.id) return null;
    return {
      id: d.id,
      teamA: m.teamA.id as string, teamB: m.teamB.id as string,
      scoreA: Number(m.teamA.score ?? 0), scoreB: Number(m.teamB.score ?? 0),
      status: (m.status ?? 'scheduled') as string,
      scheduledFor: toIso(m.scheduledFor) ?? toIso(m.proposedTime) ?? toIso(m.deadline),
      completedAt: toIso(m.completed_at) ?? toIso(m.completedAt),
      bestOf: Number(m.bestOf ?? (m.series_format ? String(m.series_format).replace('bo', '') : 3)) || 3,
      round: m.round ?? null, matchday: m.matchday ?? null,
      stage: m.lanStage ?? null, slot: m.lanSlot ?? null,
      isPlayoff: !!(m.isPlayoff || m.playoffCode || m.bracketMatchId),
      casters: withMain((m.casters ?? []) as MatchCaster[]),
      lobby: lobbyOf.get(d.id) ?? null,
      standins: standinsOf.get(d.id) ?? [],
    };
  }).filter((m): m is NonNullable<typeof m> => !!m)
    .sort((a, b) => (a.scheduledFor ?? '').localeCompare(b.scheduledFor ?? ''));

  // Earlier tournaments on the site (and the legacy Letnia, stored in the root collections)
  const careers = [
    ...others.docs
      .filter(d => d.id !== t && d.data().status !== 'registration' && !/test/i.test(d.data().slug ?? d.id))
      .map(d => {
        const name = (d.data().name ?? d.id) as string;
        // Facts name the tournament inline: a short official name reads better than "POLISH DOTA2 LEAGUE Season 1"
        return { key: d.id, name, short: name.length <= 18 ? name : (d.data().shortName ?? name) as string };
      }),
    { key: 'letnia', name: 'Letnia Liga', short: 'Letnia' },
  ];

  const td = tDoc.data() ?? {};
  return { type: td.type ?? td.format ?? null, name: td.name ?? '', me: uid, matches, rosters: rosters.teams, careers };
}
