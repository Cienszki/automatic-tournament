// Prints one v2 match round by round, to watch how the computer plays.
//   npx tsx scripts/tools/card-sim/v2/watch.ts [--slug wiosenna] [--seed 1] [--a planner] [--b planner] [--packs 40]
import { simCollection } from '@/lib/card-lab/cards';
import { baseMight, OBJECTIVES } from '@/lib/card-lab/outposts';
import type { AgentName } from '@/features/cards/domain/v2/ai/agents';
import { DEFAULT_RULES } from '@/features/cards/domain/v2/rules';
import type { MatchEvent } from '@/features/cards/domain/v2/types';
import { stream } from '../rng';
import { slugPool } from './cells';
import { buildDeck, roleMix, totalCost, totalMight } from './decks';
import { playMatch } from './match';

const arg = (n: string, d: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const slug = arg('--slug', 'wiosenna'); const seed = Number(arg('--seed', '1')); const packs = Number(arg('--packs', '40'));
const agents = [arg('--a', 'planner'), arg('--b', 'planner')] as [AgentName, AgentName];
const { cards, guessPool } = slugPool(slug);
const decks = [0, 1].map((i) => buildDeck('best', simCollection(cards, packs, stream(seed, 'watch', i)), DEFAULT_RULES)!) as [typeof cards, typeof cards];
decks.forEach((d, i) => console.log(`side ${i} (${agents[i]}): cost ${totalCost(d)}, might ${totalMight(d)}, roles C/M/O/SS/HS ${roleMix(d)}`));
const rec = playMatch({ decks, agents, rules: DEFAULT_RULES, seed, pool: guessPool, keepEvents: true });
const name = (c: { name: string; role: string }) => `${c.name}(${c.role.replace('Soft Support', 'SS').replace('Hard Support', 'HS')} ${baseMight(c as never)})`;
const obj = (at: number) => OBJECTIVES[rec.objectives[at]].name;
const line = (e: MatchEvent): string | null => {
  switch (e.kind) {
    case 'play': return `  ${e.side} plays ${name(e.card)} -> ${obj(e.to)}${e.replaced ? ` replacing ${name(e.replaced)}` : ''}`;
    case 'move': return `  ${e.side} moves ${name(e.card)} ${obj(e.from)} -> ${obj(e.to)}${e.free ? ` (free: ${e.free})` : ''}`;
    case 'gank': return `  ${e.side} gank by ${name(e.mid)} at ${obj(e.at)}: ${e.blocked ? 'blocked by Offlane' : e.target ? `${name(e.target)} back to ${e.toHand ? 'hand' : 'graveyard'}` : 'nobody there'}`;
    case 'control': return `  ${obj(e.at)}: ${e.power[0]} vs ${e.power[1]} -> ${e.controller === null ? 'nobody' : `side ${e.controller}`}`;
    case 'damage': return null;
    case 'end': return `  END: ${e.result.winner === null ? 'draw' : `side ${e.result.winner} wins`} (${e.result.reason})`;
    default: return null;
  }
};
rec.events!.forEach((evs, r) => {
  console.log(`Round ${r + 1}`);
  for (const e of evs) { const l = line(e); if (l) console.log(l); }
  console.log(`  HP ${rec.hp[r][0]} : ${rec.hp[r][1]}`);
});
