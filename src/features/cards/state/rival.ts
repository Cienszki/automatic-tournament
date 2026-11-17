// The computer opponent behind a message channel: the screen runs it in a web worker (Średni and
// Trudny think for a few hundred milliseconds a round), and falls back to calling it here when a
// worker cannot be made. It is only ever given its own view: the board and its own hand.
import type { GCard } from '@/lib/card-lab/cards';
import type { Agent } from '@/features/cards/domain/v2/ai/agents';
import { makeOpponent, type Level } from '@/features/cards/domain/v2/ai/levels';
import type { Strikes } from '@/features/cards/domain/v2/fight';
import type { MatchState, Plan } from '@/features/cards/domain/v2/types';
import type { MatchView } from '@/features/cards/domain/v2/view';
import { RIVAL } from './scene';

export type RivalRequest =
  | { type: 'init'; level: Level; pool: GCard[]; seed: number }
  | { type: 'decide'; id: number; view: MatchView }
  | { type: 'strike'; id: number; mid: MatchState };

export type RivalReply =
  | { id: number; plan: Plan; ms: number }
  | { id: number; strikes: Strikes; ms: number }
  | { id: number; error: string };

/** One computer player; each request is answered in order, so its choices stay seeded */
export function rivalCore(): (req: RivalRequest) => RivalReply | null {
  let agent: Agent | null = null;
  return (req) => {
    if (req.type === 'init') { agent = makeOpponent(req.level, { pool: req.pool, seed: req.seed }); return null; }
    if (!agent) return { id: req.id, error: 'not started' };
    const t = Date.now();
    try {
      if (req.type === 'decide') return { id: req.id, plan: agent.decide(req.view).plan, ms: Date.now() - t };
      return { id: req.id, strikes: agent.strike(req.mid, RIVAL), ms: Date.now() - t };
    } catch (e) {
      return { id: req.id, error: String(e) };
    }
  };
}
