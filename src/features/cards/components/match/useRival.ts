'use client';

// The computer opponent as promises: its plan and its fight choice come from a web worker, so the
// page never freezes while it thinks; `thinking` is true while it does (the mark by its name).
// Without workers (an old browser, a test) the same code runs here, a moment later.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GCard } from '@/lib/card-lab/cards';
import type { Level } from '@/features/cards/domain/v2/ai/levels';
import type { Strikes } from '@/features/cards/domain/v2/fight';
import type { MatchState, Plan } from '@/features/cards/domain/v2/types';
import type { MatchView } from '@/features/cards/domain/v2/view';
import { rivalCore, type RivalReply, type RivalRequest } from '@/features/cards/state/rival';

type Ask = Exclude<RivalRequest, { type: 'init' }>;
type AskBody = { type: 'decide'; view: MatchView } | { type: 'strike'; mid: MatchState };
interface Pending { req: Ask; done: (r: RivalReply) => void }
interface Channel { send: (r: RivalRequest) => void; close: () => void }

function open(onReply: (r: RivalReply) => void): Channel {
  try {
    if (typeof Worker !== 'undefined') {
      const w = new Worker(new URL('./rival.worker.ts', import.meta.url));
      w.onmessage = (e: MessageEvent<RivalReply>) => onReply(e.data);
      return { send: (r) => w.postMessage(r), close: () => w.terminate() };
    }
  } catch { /* no workers here: the same code on this thread */ }
  const core = rivalCore();
  let closed = false;
  return { send: (r) => setTimeout(() => { const out = core(r); if (out && !closed) onReply(out); }, 30), close: () => { closed = true; } };
}

export function useRival(init: { level: Level; pool: GCard[]; seed: number }) {
  const channel = useRef<Channel | null>(null);
  const pending = useRef(new Map<number, Pending>());
  const nextId = useRef(1);
  const initMsg = useRef<RivalRequest>({ type: 'init', ...init });
  const [busy, setBusy] = useState(0);

  const ensure = useCallback((): Channel => {
    if (channel.current) return channel.current;
    const ch = open((r) => {
      const p = pending.current.get(r.id);
      if (!p) return;
      pending.current.delete(r.id);
      setBusy(pending.current.size);
      p.done(r);
    });
    channel.current = ch;
    ch.send(initMsg.current);
    // A worker closed and opened again (React's development double mount): what it owed is asked again
    for (const p of pending.current.values()) ch.send(p.req);
    return ch;
  }, []);

  useEffect(() => {
    if (pending.current.size) ensure();
    return () => { channel.current?.close(); channel.current = null; };
  }, [ensure]);

  const ask = useCallback(<T,>(req: AskBody, pick: (r: RivalReply) => T, fallback: T): Promise<T> => new Promise<T>((resolve) => {
    const id = nextId.current++;
    const full = { ...req, id } as Ask;
    pending.current.set(id, { req: full, done: (r) => resolve('error' in r ? fallback : pick(r)) });
    setBusy(pending.current.size);
    ensure().send(full);
  }), [ensure]);

  const decide = useCallback((view: MatchView) => ask<Plan>({ type: 'decide', view }, (r) => ('plan' in r ? r.plan : []), []), [ask]);
  const strike = useCallback((mid: MatchState) => ask<Strikes>({ type: 'strike', mid }, (r) => ('strikes' in r ? r.strikes : []), []), [ask]);
  return { decide, strike, thinking: busy > 0 };
}
