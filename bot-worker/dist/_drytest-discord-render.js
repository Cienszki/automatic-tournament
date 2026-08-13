"use strict";
// The Discord surfaces, rendered without Discord.
//
// Embeds are built locally by discord.js and only then sent, so everything the
// channel will show can be checked here: the slot bar, the card at each stage
// of a game's life, the join button appearing and disappearing, and the field
// limits Discord enforces (1024 characters per field, 25 fields).
//
// Usage: node dist/_drytest-discord-render.js

const {
  slotBar,
  lobbyCardEmbed,
  lobbyCardComponents,
  posterEmbed,
  posterComponents,
  rankingEmbed,
  medalsEmbed,
} = require('./discord/render.js');

let failures = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: ${actual}${ok ? '' : `  (expected ${expected})`}`);
}
function ok(label, condition, detail = '') {
  if (!condition) failures++;
  console.log(`  ${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `: ${detail}` : ''}`);
}

function game(overrides = {}) {
  return {
    id: 'g1',
    gameNumber: 42,
    state: 'open',
    initiatorName: 'Wichura',
    lobbyName: 'zorza',
    createdAt: new Date().toISOString(),
    settings: { gameMode: 22, serverRegion: 8 },
    slotSnapshot: null,
    discord: {},
    ...overrides,
  };
}

console.log('\n1. Slot bar — always ten segments, three states');
check('empty lobby', slotBar(0, 0), '⬛'.repeat(10));
check('seven seated', slotBar(7, 0), '🟩'.repeat(7) + '⬛'.repeat(3));
check('five seated, two held', slotBar(5, 2), '🟩🟩🟩🟩🟩🟨🟨⬛⬛⬛');
check('full', slotBar(10, 0), '🟩'.repeat(10));
// Reservations can outlive the slots they held; the bar must not overflow.
// Counted in code points: ⬛ is a BMP character but 🟩/🟨 are surrogate pairs,
// so string length is not segment count.
const segments = (bar) => [...bar].length;
check('over-reserved stays ten segments', segments(slotBar(9, 4)), 10);
check('over-reserved drops the surplus', slotBar(9, 4), '🟩'.repeat(9) + '🟨');
check('every combination is ten segments',
  [[0, 0], [3, 2], [7, 3], [10, 0], [4, 9]].every(([s, r]) => segments(slotBar(s, r)) === 10), true);

console.log('\n2. Lobby card while filling');
const filling = lobbyCardEmbed({
  game: game(),
  players: ['Wichura', 'Nocnik', 'Kv1'],
  seated: 3,
  reserved: 1,
}).toJSON();
ok('title carries the game number', filling.title.includes('#42'), filling.title);
ok('host is named', filling.description.includes('Wichura'));
ok('slot field present', filling.fields.some((f) => f.name === 'Miejsca'));
ok('lobby name shown', filling.fields.some((f) => f.value.includes('zorza')));
ok('mode resolved to a name', filling.fields.some((f) => f.value === 'All Pick'));
ok('region resolved to a name', filling.fields.some((f) => f.value.includes('Europe East')));
ok('roster listed', filling.fields.some((f) => f.name.startsWith('Gracze') && f.value.includes('Nocnik')));
check('join button offered', lobbyCardComponents(game()).length, 1);

console.log('\n2b. No join button before the Dota lobby exists');
// The card is posted the instant the host presses the button, a second or two
// before the worker has made the lobby. A Dołącz offered in that window told
// the player "to lobby już nie przyjmuje graczy" about a lobby about to open.
check('lobby_creating offers nothing to press', lobbyCardComponents(game({ state: 'lobby_creating' })).length, 0);
check('open offers the button', lobbyCardComponents(game({ state: 'open' })).length, 1);
check('ready still offers it', lobbyCardComponents(game({ state: 'ready' })).length, 1);

console.log('\n3. Lobby card once the match starts');
const live = game({ state: 'in_progress' });
const started = lobbyCardEmbed({ game: live, players: ['a', 'b'], seated: 10, reserved: 0 }).toJSON();
ok('title says it is live', started.title.includes('w trakcie'), started.title);
check('join button withdrawn', lobbyCardComponents(live).length, 0);

console.log('\n4. Discord field limits');
const crowd = Array.from({ length: 10 }, (_, i) => `Gracz o naprawdę długim nicku numer ${i + 1}`);
const packed = lobbyCardEmbed({ game: game(), players: crowd, seated: 10, reserved: 0 }).toJSON();
ok('no field exceeds 1024 chars', packed.fields.every((f) => f.value.length <= 1024));
ok('at most 25 fields', packed.fields.length <= 25);

const manyMedals = Array.from({ length: 40 }, (_, i) => ({
  label: `Medal ${i}`,
  place: null,
  summary: `Medal numer ${i} · za coś bardzo konkretnego · sierpień 2026`,
}));
const medals = medalsEmbed('Wichura', { name: 'Wichura', gamesPlayed: 58, medals: manyMedals }).toJSON();
ok('medal list is truncated to the limit', medals.fields.every((f) => f.value.length <= 1024));

console.log('\n5. Poster and ranking');
const poster = posterEmbed().toJSON();
ok('poster explains the buttons', poster.description.includes('Nowa gra'));
const rows = posterComponents('https://dota2inhouse.pl');
check('one row of buttons', rows.length, 1);
check('three buttons', rows[0].toJSON().components.length, 3);
const linkButton = rows[0].toJSON().components[2];
check('third is a link to /inhouse', linkButton.url, 'https://dota2inhouse.pl/inhouse');

const ranking = rankingEmbed({
  gamesPlayed: [
    { name: 'Wichura', value: 58 },
    { name: 'Nocnik', value: 41 },
    { name: 'Kv1', value: 12 },
  ],
  gamesPublished: [{ name: 'Nocnik', value: 9 }],
  playerOfWeek: { name: 'Kv1', gamesThisWeek: 7 },
}).toJSON();
ok('podium icons used', ranking.fields[0].value.includes('🥇'));
ok('player of the week included', ranking.fields.some((f) => f.name.includes('Gracz tygodnia')));

const empty = rankingEmbed({ gamesPlayed: [], gamesPublished: [], playerOfWeek: null }).toJSON();
ok('empty ranking still renders', empty.fields[0].value.length > 0, empty.fields[0].value);

const noMedals = medalsEmbed('Wichura', { name: null, gamesPlayed: 0, medals: [] }).toJSON();
ok('no medals reads as encouragement, not an error', noMedals.fields[0].name === 'Brak medali');

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
