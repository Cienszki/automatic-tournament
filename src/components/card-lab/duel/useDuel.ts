'use client';

// The browser side of a duel: the participant's view live from Firestore (cardDuels/{id}/views/{uid}),
// moves and lobby actions to /api/cards/duel, and a check-in every 10 s (it keeps the lobby open
// and lets the server apply whatever came due — a turn that ran out, a hit not made in time).

import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '@/lib/firebase';
import type { DuelView, Person, PvpAction } from '@/lib/card-lab/pvp';

export interface PublicLobby {
  id: string; key: string; kind: 'open' | 'direct'; status: DuelView['status'];
  host: Person; invited: Person | null; guest: Person | null; players: [Person, Person] | null;
}

/** POST /api/cards/duel; resolves to the error (null = done) and the answer */
export async function duelPost<T = { ok: true }>(user: User, body: object): Promise<{ error: string | null; data: T | null }> {
  const r = await fetch('/api/cards/duel', {
    method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return r.ok ? { error: null, data: j as T } : { error: (j as { error?: string }).error || 'Coś poszło nie tak', data: null };
}

const PING_MS = 10_000;

/** `id` null = no duel (the front page between duels): nothing is loaded */
export function useDuel(id: string | null, user: User | null) {
  const [view, setView] = useState<DuelView | null>(null);
  const [lobby, setLobby] = useState<PublicLobby | null>(null);
  const [missing, setMissing] = useState(false);
  /** Server time − this computer's time */
  const [offset, setOffset] = useState(0);

  // What anyone with the link sees (also before signing in); refreshed while not taking part
  const loadLobby = useCallback(async () => {
    if (!id) return;
    const r = await fetch(`/api/cards/duel?id=${encodeURIComponent(id)}`);
    if (r.status === 404) { setMissing(true); return; }
    if (r.ok) setLobby(await r.json());
  }, [id]);
  useEffect(() => { setLobby(null); setMissing(false); }, [id]);
  useEffect(() => {
    if (!id) return;
    loadLobby();
    if (view) return;
    const t = setInterval(loadLobby, 5000);
    return () => clearInterval(t);
  }, [loadLobby, view]);

  // Your own view, live (exists once you host or hold the seat)
  useEffect(() => {
    if (!user || !id) { setView(null); return; }
    return onSnapshot(doc(db, 'cardDuels', id, 'views', user.uid), snap => {
      if (!snap.exists()) { setView(null); return; }
      const v = JSON.parse(snap.data().json as string) as DuelView;
      setOffset(v.at - Date.now());
      setView(v);
    }, () => setView(null));
  }, [id, user]);

  const post = useCallback(async (body: object) => (user && id ? (await duelPost(user, { id, ...body })).error : 'Zaloguj się'), [id, user]);
  const send = useCallback((m: PvpAction) => post({ action: 'play', move: m }), [post]);

  // Check in while taking part; also right after a deadline passes (so it applies without waiting)
  const active = view && (view.status === 'open' || view.status === 'seated' || view.status === 'play');
  const deadline = view?.game?.clock.deadline ?? null;
  const lastPing = useRef(0);
  useEffect(() => {
    if (!active) return;
    const ping = () => { lastPing.current = Date.now(); post({ action: 'ping' }); };
    ping();
    const t = setInterval(ping, PING_MS);
    return () => clearInterval(t);
  }, [active, post]);
  useEffect(() => {
    if (!active || !deadline) return;
    const wait = deadline - (Date.now() + offset) + 400;
    const t = setTimeout(() => { if (Date.now() - lastPing.current > 300) { lastPing.current = Date.now(); post({ action: 'ping' }); } }, Math.max(300, wait));
    return () => clearTimeout(t);
  }, [active, deadline, offset, post]);

  return { view, lobby, missing, offset, post, send, reloadLobby: loadLobby };
}
