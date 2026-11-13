// The Discord surfaces, rendered without Discord (was dist/_drytest-discord-render.js).
// Embeds are built locally by discord.js and only then sent, so everything the channel
// will show can be checked here: the slot bar, the card at each stage of a game's life,
// the join button appearing and disappearing, and Discord's field limits (1024
// characters per field, 25 fields).

import { describe, expect, it } from 'vitest';
import {
  lobbyCardComponents,
  lobbyCardEmbed,
  medalsEmbed,
  posterComponents,
  posterEmbed,
  rankingEmbed,
  slotBar,
} from './render';
import type { InhouseGame } from '../inhouse/core/types';

function game(overrides: Record<string, unknown> = {}): InhouseGame {
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
  } as unknown as InhouseGame;
}

/** Counted in code points: ⬛ is one UTF-16 unit but 🟩/🟨 are surrogate pairs. */
const segments = (bar: string) => [...bar].length;

describe('slot bar', () => {
  it('is always ten segments in three states', () => {
    expect(slotBar(0, 0)).toBe('⬛'.repeat(10));
    expect(slotBar(7, 0)).toBe('🟩'.repeat(7) + '⬛'.repeat(3));
    expect(slotBar(5, 2)).toBe('🟩🟩🟩🟩🟩🟨🟨⬛⬛⬛');
    expect(slotBar(10, 0)).toBe('🟩'.repeat(10));
  });

  it('does not overflow when reservations outlive the slots they held', () => {
    expect(segments(slotBar(9, 4))).toBe(10);
    expect(slotBar(9, 4)).toBe('🟩'.repeat(9) + '🟨');
    for (const [s, r] of [[0, 0], [3, 2], [7, 3], [10, 0], [4, 9]]) expect(segments(slotBar(s, r))).toBe(10);
  });
});

describe('lobby card', () => {
  it('shows the game, host, slots, lobby name, mode, region and roster while filling', () => {
    const card = lobbyCardEmbed({ game: game(), players: ['Wichura', 'Nocnik', 'Kv1'], seated: 3, reserved: 1 }).toJSON();
    expect(card.title).toContain('#42');
    expect(card.description).toContain('Wichura');
    const fields = card.fields ?? [];
    expect(fields.some((f) => f.name === 'Miejsca')).toBe(true);
    expect(fields.some((f) => f.value.includes('zorza'))).toBe(true);
    expect(fields.some((f) => f.value === 'All Pick')).toBe(true);
    expect(fields.some((f) => f.value.includes('Europe East'))).toBe(true);
    expect(fields.some((f) => f.name.startsWith('Gracze') && f.value.includes('Nocnik'))).toBe(true);
    expect(lobbyCardComponents(game())).toHaveLength(1);
  });

  it('offers no join button before the Dota lobby exists, and offers it while open or ready', () => {
    // The card is posted the instant the host presses the button, a second or two before
    // the worker has made the lobby; a join offered then was refused.
    expect(lobbyCardComponents(game({ state: 'lobby_creating' }))).toHaveLength(0);
    expect(lobbyCardComponents(game({ state: 'open' }))).toHaveLength(1);
    expect(lobbyCardComponents(game({ state: 'ready' }))).toHaveLength(1);
  });

  it('says the match is live and withdraws the join button once it starts', () => {
    const live = game({ state: 'in_progress' });
    const card = lobbyCardEmbed({ game: live, players: ['a', 'b'], seated: 10, reserved: 0 }).toJSON();
    expect(card.title).toContain('w trakcie');
    expect(lobbyCardComponents(live)).toHaveLength(0);
  });
});

describe('Discord field limits', () => {
  it('keeps every field within 1024 characters and at most 25 fields', () => {
    const crowd = Array.from({ length: 10 }, (_, i) => `Gracz o naprawdę długim nicku numer ${i + 1}`);
    const card = lobbyCardEmbed({ game: game(), players: crowd, seated: 10, reserved: 0 }).toJSON();
    expect((card.fields ?? []).every((f) => f.value.length <= 1024)).toBe(true);
    expect((card.fields ?? []).length).toBeLessThanOrEqual(25);
  });

  it('truncates a long medal list to the limit', () => {
    const medals = Array.from({ length: 40 }, (_, i) => ({ label: `Medal ${i}`, place: null, summary: `Medal numer ${i} · za coś bardzo konkretnego · sierpień 2026` }));
    const embed = medalsEmbed('Wichura', { name: 'Wichura', gamesPlayed: 58, medals } as never).toJSON();
    expect((embed.fields ?? []).every((f) => f.value.length <= 1024)).toBe(true);
  });
});

describe('poster and ranking', () => {
  it('explains the buttons and links the third one to /inhouse', () => {
    // The old dry-run called posterEmbed() with no URL; it has taken the site URL since.
    expect(posterEmbed('https://dota2inhouse.pl').toJSON().description).toContain('Nowa gra');
    const rows = posterComponents('https://dota2inhouse.pl');
    expect(rows).toHaveLength(1);
    const buttons = rows[0].toJSON().components as Array<{ url?: string }>;
    expect(buttons).toHaveLength(3);
    expect(buttons[2].url).toBe('https://dota2inhouse.pl/inhouse');
  });

  it('uses podium icons and includes the player of the week', () => {
    const ranking = rankingEmbed({
      gamesPlayed: [{ name: 'Wichura', value: 58 }, { name: 'Nocnik', value: 41 }, { name: 'Kv1', value: 12 }],
      gamesPublished: [{ name: 'Nocnik', value: 9 }],
      playerOfWeek: { name: 'Kv1', gamesThisWeek: 7 },
    } as never).toJSON();
    expect(ranking.fields?.[0].value).toContain('🥇');
    expect(ranking.fields?.some((f) => f.name.includes('Gracz tygodnia'))).toBe(true);
  });

  it('renders an empty ranking, and no medals as encouragement rather than an error', () => {
    const empty = rankingEmbed({ gamesPlayed: [], gamesPublished: [], playerOfWeek: null } as never).toJSON();
    expect(empty.fields?.[0].value.length).toBeGreaterThan(0);
    const none = medalsEmbed('Wichura', { name: null, gamesPlayed: 0, medals: [] } as never).toJSON();
    expect(none.fields?.[0].name).toBe('Brak medali');
  });
});
