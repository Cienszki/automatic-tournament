// A card as a match holds it: plain data with no links back into the stats model. Cards built
// from the stats (buildSeriesCards) carry the whole team, whose players point back at the team, so
// they cannot be stored as JSON. A match copies each card into this form when it starts; it keeps
// everything the engine and the card face use (the same fields as a card frozen on an account,
// src/lib/card-lab/frozen.ts), and the team and player keep only what they show.
import type { GCard } from '@/lib/card-lab/cards';
import type { PlayerX, TeamX } from '@/lib/stats-lab/derive';

type TeamLike = { id: string; name: string; tag?: string; logoUrl?: string };
const team = (t?: TeamLike): TeamX | undefined =>
  (t ? ({ id: t.id, name: t.name, ...(t.tag ? { tag: t.tag } : {}), ...(t.logoUrl ? { logoUrl: t.logoUrl } : {}), players: [], games: [] } as unknown as TeamX) : undefined);

export function matchCard(c: GCard): GCard {
  return {
    id: c.id, pid: c.pid, name: c.name,
    player: { id: c.pid, name: c.name, ...(c.player?.avatar ? { avatar: c.player.avatar } : {}) } as unknown as PlayerX,
    team: team(c.team), role: c.role, pos: c.pos, ovr: c.ovr, attrs: c.attrs, heroId: c.heroId,
    series: { matchId: c.series.matchId, opp: team(c.series.opp), result: c.series.result, games: c.series.games, start: c.series.start, ...(c.series.label ? { label: c.series.label } : {}) },
    standin: c.standin, totw: c.totw,
  };
}
