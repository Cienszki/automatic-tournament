// Cards as they are stored on an account: a snapshot taken the moment the card is issued, so a card
// never changes afterwards (even if the stats or the rating formula do). Plain data, no model links.
// Also the deck layout rules, shared by the deck builder and the server that checks saved decks.

import type { PlayerX, TeamX } from '@/lib/stats-lab/derive';
import { ROLE_KEYS, type DeckRule, type GCard, type RoleKey } from './cards';

interface FrozenTeam { id: string; name: string; tag?: string; logoUrl?: string }
export interface FrozenCard {
  id: string; pid: string; name: string; avatar?: string;
  team?: FrozenTeam;
  role: RoleKey; pos: number; ovr: number; attrs: GCard['attrs']; heroId: number;
  series: { matchId: string; opp?: FrozenTeam; result: string; games: number; start: number; label?: string };
  standin: boolean; totw: boolean;
}

const team = (t?: TeamX | FrozenTeam): FrozenTeam | undefined =>
  t ? { id: t.id, name: t.name, ...(t.tag ? { tag: t.tag } : {}), ...(t.logoUrl ? { logoUrl: t.logoUrl } : {}) } : undefined;

export function freezeCard(c: GCard): FrozenCard {
  const t = team(c.team); const opp = team(c.series.opp);
  return {
    id: c.id, pid: c.pid, name: c.name, ...(c.player.avatar ? { avatar: c.player.avatar } : {}),
    ...(t ? { team: t } : {}),
    role: c.role, pos: c.pos, ovr: c.ovr, attrs: c.attrs, heroId: c.heroId,
    series: { matchId: c.series.matchId, ...(opp ? { opp } : {}), result: c.series.result, games: c.series.games, start: c.series.start, ...(c.series.label ? { label: c.series.label } : {}) },
    standin: c.standin, totw: c.totw,
  };
}

/** Back to the shape the card UI and the game use (player / team carry only what they show) */
export function thawCard(f: FrozenCard): GCard {
  const teamX = (t?: FrozenTeam) => (t ? ({ ...t, players: [], games: [] } as unknown as TeamX) : undefined);
  return {
    id: f.id, pid: f.pid, name: f.name,
    player: { id: f.pid, name: f.name, avatar: f.avatar } as unknown as PlayerX,
    team: teamX(f.team), role: f.role, pos: f.pos, ovr: f.ovr, attrs: f.attrs, heroId: f.heroId,
    series: { ...f.series, opp: teamX(f.series.opp) }, standin: f.standin, totw: f.totw,
  };
}

// ── Deck layout ─────────────────────────────────────────────────────────────

/** Slot key → card id (the deck as the player laid it out) */
export type DeckSlots = Record<string, string>;
/** A slot: the position it is for (null = any position) */
export interface SlotDef { key: string; role: RoleKey | null }

export function slotDefs(rule: DeckRule): SlotDef[] {
  return [
    ...ROLE_KEYS.flatMap(r => Array.from({ length: rule.perRole }, (_, i): SlotDef => ({ key: `${r}-${i}`, role: r }))),
    ...Array.from({ length: Math.max(0, rule.size - ROLE_KEYS.length * rule.perRole) }, (_, i): SlotDef => ({ key: `free-${i}`, role: null })),
  ];
}

/** Why this layout cannot be saved (null = fine): known slots, owned cards, positions, one per player */
export function slotsProblem(slots: DeckSlots, owned: Map<string, { pid: string; role: RoleKey }>, rule: DeckRule): string | null {
  const defs = new Map(slotDefs(rule).map(d => [d.key, d]));
  const pids = new Set<string>(); const ids = new Set<string>();
  for (const [key, id] of Object.entries(slots)) {
    const def = defs.get(key); if (!def) return 'Nieznane miejsce w talii';
    const c = owned.get(id); if (!c) return 'Tej karty nie ma w Twojej kolekcji';
    if (def.role && def.role !== c.role) return 'Karta na złej pozycji';
    if (ids.has(id) || pids.has(c.pid)) return 'Każdy gracz może być w talii tylko raz';
    ids.add(id); pids.add(c.pid);
  }
  return null;
}
