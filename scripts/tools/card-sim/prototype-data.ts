// Writes the card data the match-screen prototypes (WP-54) play with, so that the prototype needs
// no server, no database and no network:
//
//   npx tsx scripts/tools/card-sim/prototype-data.ts
//
// Output: src/app/prototype/cards/_data/wiosenna.json
//   cards  every card the file refers to, as stored cards (frozen.ts) without the six attributes,
//          which neither the engine nor the card face reads, and without team logo addresses:
//          the fixture's logo links are Firebase Storage links with their tokens removed, so they
//          could only fail, and a team is drawn from its tag instead
//   pool   ids of the cards the computer guesses unseen rival cards from: what packs can give
//          now, plus every team-of-the-round card
//   decks  six ready decks (ids), each legal under DEFAULT_RULES and built by the `best` builder
//          from a simulated 20-pack collection. Seeds are searched so that every deck holds a
//          team-of-the-round card and at least two pairs of real teammates: the bonuses must be
//          visible in a prototype match.
// The result depends only on the fixture and the constants below.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { packPool, simCollection, type GCard } from '@/lib/card-lab/cards';
import { freezeCard } from '@/lib/card-lab/frozen';
import { deckProblem } from '@/features/cards/domain/v2/deck';
import { DEFAULT_RULES } from '@/features/cards/domain/v2/rules';
import { loadCards } from './load-cards';
import { stream } from './rng';
import { buildDeck, teamPaired } from './v2/decks';

const SLUG = 'wiosenna';
const PACKS = 20;
const DECKS = 6;
const OUT = join(__dirname, '..', '..', '..', 'src', 'app', 'prototype', 'cards', '_data', `${SLUG}.json`);

const cards = loadCards(SLUG);
const pool: GCard[] = [
  ...[...packPool(cards).values()].flat().map((e) => e.base),
  ...cards.filter((c) => c.totw),
];

const decks: GCard[][] = [];
for (let seed = 1; decks.length < DECKS && seed < 5000; seed++) {
  const deck = buildDeck('best', simCollection(cards, PACKS, stream(seed, 'prototype')), DEFAULT_RULES);
  if (!deck || deckProblem(deck, DEFAULT_RULES) !== null) continue;
  if (!deck.some((c) => c.totw) || teamPaired(deck) < 4) continue;
  decks.push(deck);
}
if (decks.length < DECKS) throw new Error(`only ${decks.length} decks found`);

const used = new Map<string, GCard>();
for (const c of [...pool, ...decks.flat()]) used.set(c.id, c);
const noLogo = <T extends { logoUrl?: string }>(t: T | undefined) => { if (!t) return undefined; const { logoUrl: _dropped, ...rest } = t; return rest; };
const slim = [...used.values()].map((c) => {
  const { attrs: _unused, team, series, ...rest } = freezeCard(c);
  return { ...rest, ...(team ? { team: noLogo(team) } : {}), series: { ...series, ...(series.opp ? { opp: noLogo(series.opp) } : {}) } };
});

mkdirSync(join(OUT, '..'), { recursive: true });
writeFileSync(OUT, `${JSON.stringify({ slug: SLUG, cards: slim, pool: pool.map((c) => c.id), decks: decks.map((d) => d.map((c) => c.id)) })}\n`);
console.log(`${OUT}: ${slim.length} cards, pool ${pool.length}, ${decks.length} decks`);
for (const d of decks) console.log(`  deck: ${d.filter((c) => c.totw).length} TOTW, ${teamPaired(d)} cards with a teammate, roles ${d.map((c) => c.pos).sort().join('')}`);
