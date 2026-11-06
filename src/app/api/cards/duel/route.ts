/**
 * Card duels (src/server/card-lab/duels.ts). Participants read their duel live from
 * cardDuels/{id}/views/{uid}; everything they do goes through here.
 *   GET  ?id=…                                → the lobby for anyone with the link (no account needed)
 *   GET  ?t=…&ranking=1                       → the tournament's ranking
 *   GET  ?t=…&history=1                       → your finished duels (signed in)
 *   GET  ?t=…&mine=1                          → { invites, hosting, live } — for the front page (signed in)
 *   GET  ?t=…&q=<text>                        → accounts whose nick starts with it, card players first (signed in; to challenge)
 *   POST { t, action: 'create', to? }         → { id } — an open link, or a challenge for one player
 *   POST { id, action: 'take' | 'start' | 'leave' | 'ping' }
 *   POST { id, action: 'play', move }         → a move in the match (as seen in your view)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/server/lib/require-user';
import { ensureAdminInitialized, getAdminDb } from '@/server/lib/admin';
import { NEED_NAME, hasName, validKey } from '@/server/card-lab/collection';
import { createDuel, history, leave, myDuels, ping, play, publicLobby, ranking, startMatch, takeSeat } from '@/server/card-lab/duels';
import { BATCH_KINDS, type BatchStep, type PvpAction } from '@/lib/card-lab/pvp';

export const dynamic = 'force-dynamic';
const ID = /^[A-Za-z0-9_-]{6,40}$/;
const UID = /^[A-Za-z0-9_-]{1,128}$/;
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

const LOC = (v: unknown) => v === 'base' || v === 0 || v === 1 || v === 2;
const str = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length < 200;
function parseMove(m: Record<string, unknown> | null | undefined): PvpAction | null {
  switch (m?.kind) {
    case 'deploy': return str(m.cardId) ? { kind: 'deploy', cardId: m.cardId as string } : null;
    case 'deployMany': return Array.isArray(m.cardIds) && m.cardIds.length && m.cardIds.length <= 10 && m.cardIds.every(str) ? { kind: 'deployMany', cardIds: m.cardIds as string[] } : null;
    case 'move': return Array.isArray(m.uids) && m.uids.length && m.uids.length <= 7 && m.uids.every(str) && LOC(m.to) ? { kind: 'move', uids: m.uids as string[], to: m.to as 'base' } : null;
    case 'hit': return str(m.from) && str(m.to) ? { kind: 'hit', from: m.from as string, to: m.to as string } : null;
    case 'orders': case 'confirm': case 'end': case 'resign': return { kind: m.kind };
    case 'batch': {
      // A whole phase: only planning steps and the confirm/end that close it
      if (!Array.isArray(m.actions) || !m.actions.length || m.actions.length > 40) return null;
      const steps = (m.actions as Array<Record<string, unknown>>).map(x => ((BATCH_KINDS as readonly unknown[]).includes(x?.kind) ? parseMove(x) : null));
      return steps.every(Boolean) ? { kind: 'batch', actions: steps as BatchStep[] } : null;
    }
    default: return null;
  }
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  try {
    const id = p.get('id');
    if (id) {
      if (!ID.test(id)) return bad('Złe zapytanie');
      const lobby = await publicLobby(id);
      return lobby ? NextResponse.json(lobby) : bad('Nie ma takiego pojedynku', 404);
    }
    const t = p.get('t');
    if (!validKey(t)) return bad('Nieznany turniej');
    if (p.get('ranking')) return NextResponse.json({ players: await ranking(t) });
    const user = await requireUser(req); if (user instanceof NextResponse) return user;
    if (p.get('history')) return NextResponse.json({ games: await history(t, user.uid) });
    if (p.get('mine')) return NextResponse.json(await myDuels(t, user.uid));
    const q = (p.get('q') ?? '').trim().toLowerCase();
    if (!q) return NextResponse.json({ found: [] });
    // Any account whose nick or Discord name starts with what was typed ("cien" → Cienszki); those
    // who already have cards here first (few enough accounts to filter here)
    ensureAdminInitialized();
    const db = getAdminDb();
    const [accounts, owners] = await Promise.all([
      db.collection('accounts').select('nickname', 'discord', 'avatar').get(),
      db.collection('cardCollections').where('tournament', '==', t).select('uid').get(),
    ]);
    const playing = new Set(owners.docs.map(d => d.data().uid as string));
    const starts = (v: unknown) => typeof v === 'string' && v.toLowerCase().split(/[\s_.-]+/).concat(v.toLowerCase()).some(w => w.startsWith(q));
    const found = accounts.docs
      .filter(d => d.id !== user.uid && (starts(d.data().nickname) || starts(d.data().discord?.name) || starts(d.data().discord?.username)))
      .map(d => {
        const a = d.data();
        return { uid: d.id, name: (a.nickname ?? a.discord?.name ?? a.discord?.username ?? 'Gracz') as string, avatar: (a.avatar?.source === 'url' ? a.avatar.url : a.discord?.avatar ?? null) as string | null, cards: playing.has(d.id) };
      })
      .sort((x, y) => Number(y.cards) - Number(x.cards) || x.name.localeCompare(y.name, 'pl'))
      .slice(0, 8);
    return NextResponse.json({ found });
  } catch (e) { console.error('[duel] get failed:', e); return bad('Nie udało się wczytać', 500); }
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req); if (user instanceof NextResponse) return user;
  const b = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!b) return bad('Złe zapytanie');
  try {
    // Taking a seat is fine without one: the guest picks a name while getting ready (cards need it)
    if (b.action === 'create' && !(await hasName(user.uid))) return NextResponse.json(NEED_NAME, { status: 403 });
    if (b.action === 'create') {
      if (!validKey(b.t) || (b.to != null && !UID.test(String(b.to)))) return bad('Złe zapytanie');
      const r = await createDuel(b.t, user.uid, (b.to as string | undefined) ?? null);
      return 'error' in r ? bad(r.error, 409) : NextResponse.json(r);
    }
    const id = String(b.id ?? '');
    if (!ID.test(id)) return bad('Złe zapytanie');
    let r;
    switch (b.action) {
      case 'take': r = await takeSeat(id, user.uid); break;
      case 'start': r = await startMatch(id, user.uid); break;
      case 'leave': r = await leave(id, user.uid); break;
      case 'ping': r = await ping(id, user.uid); break;
      case 'play': {
        const m = parseMove(b.move as Record<string, unknown>);
        if (!m) return bad('Zły ruch');
        r = await play(id, user.uid, m); break;
      }
      default: return bad('Złe zapytanie');
    }
    return 'error' in r ? bad(r.error, r.status ?? 409) : NextResponse.json(r);
  } catch (e) { console.error('[duel] post failed:', e); return bad('Nie udało się', 500); }
}
