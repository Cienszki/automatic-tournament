// src/discord/render.ts
//
// Every embed the bot posts. Kept apart from the interaction handlers so the
// wording and the plumbing can be changed independently — most of the edits
// this file sees will be copy, not logic.
//
// Polish throughout: this is a Polish community, and the lobby chat, the
// website and the Discord surfaces should read as one product rather than
// three. English words survive only where Dota itself uses them.

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type APIEmbedField,
} from 'discord.js';
import type { InhouseGame } from '../inhouse/core/types';

export const IDS = {
  newGame: 'ih:new',
  newPublic: 'ih:new:public',
  newPrivate: 'ih:new:private',
  link: 'ih:link',
  linkModal: 'ih:link:modal',
  linkInput: 'ih:link:steam',
  unlinkConfirm: 'ih:unlink:confirm',
  /** Suffixed with the game id. */
  join: 'ih:join:',
  invite: 'ih:invite:',
} as const;

const LOBBY_CAPACITY = 10;

/** Only the values an inhouse actually uses get a name; the rest show the raw id. */
const GAME_MODE_LABELS: Record<number, string> = {
  1: 'All Pick (classic)',
  2: 'Captains Mode',
  3: 'Random Draft',
  4: 'Single Draft',
  5: 'All Random',
  16: 'Captains Draft',
  22: 'All Pick',
};

const SERVER_REGION_LABELS: Record<number, string> = {
  1: 'US West',
  2: 'US East',
  3: 'Europe West',
  4: 'Korea',
  5: 'SEA',
  6: 'Dubai',
  7: 'Australia',
  8: 'Europe East (Sztokholm)',
  9: 'Austria',
  10: 'Brazylia',
  11: 'Południowa Afryka',
  12: 'Chiny',
  13: 'Chiny',
  14: 'Chile',
  15: 'Peru',
  16: 'Indie',
  17: 'Japonia',
  18: 'Rosja',
  19: 'Argentyna',
};

export function gameModeLabel(mode: number): string {
  return GAME_MODE_LABELS[mode] ?? `tryb ${mode}`;
}

export function serverRegionLabel(region: number): string {
  return SERVER_REGION_LABELS[region] ?? `region ${region}`;
}

/**
 * Ten slots, at a glance.
 *
 * Seated players, held slots and free slots are three different things and the
 * website's lobby ring already draws them as three colours — this is the same
 * information in the one rendering Discord can do everywhere, on every client,
 * with no image to generate.
 */
export function slotBar(seated: number, reserved: number): string {
  const held = Math.max(0, Math.min(reserved, LOBBY_CAPACITY - seated));
  const free = Math.max(0, LOBBY_CAPACITY - seated - held);
  return '🟩'.repeat(seated) + '🟨'.repeat(held) + '⬛'.repeat(free);
}

export interface CardModel {
  game: InhouseGame;
  /** Display names of everyone on a playing slot, in join order. */
  players: string[];
  seated: number;
  reserved: number;
}

const STATE_LABELS: Record<string, string> = {
  lobby_creating: 'tworzenie lobby…',
  open: 'otwarte — dołącz!',
  ready: 'komplet — start lada moment',
  in_progress: 'w trakcie',
};

function cardColour(game: InhouseGame, seated: number): number {
  if (game.state === 'in_progress') return 0x8b5cf6; // violet — being played
  if (seated >= LOBBY_CAPACITY) return 0xf59e0b; // amber — full, about to start
  return 0x22c55e; // green — taking players
}

/** The lobby card: the same facts as the website's card, in Discord's shapes. */
export function lobbyCardEmbed(model: CardModel): EmbedBuilder {
  const { game, players, seated, reserved } = model;
  const live = game.state === 'in_progress';

  const fields: APIEmbedField[] = [
    {
      name: 'Miejsca',
      value: `${slotBar(seated, reserved)}  **${seated}/${LOBBY_CAPACITY}**` +
        (reserved > 0 ? `\n🟨 ${reserved} zarezerwowane` : ''),
      inline: false,
    },
    { name: 'Nazwa lobby', value: game.lobbyName ? `\`${game.lobbyName}\`` : '—', inline: true },
    { name: 'Tryb', value: gameModeLabel(game.settings.gameMode), inline: true },
    { name: 'Serwer', value: serverRegionLabel(game.settings.serverRegion), inline: true },
  ];

  if (players.length) {
    fields.push({
      name: `Gracze (${players.length})`,
      value: players.map((p, i) => `${i + 1}. ${p}`).join('\n').slice(0, 1024),
      inline: false,
    });
  }

  return new EmbedBuilder()
    .setColor(cardColour(game, seated))
    .setTitle(`Gra #${game.gameNumber}${live ? ' — w trakcie' : ''}`)
    .setDescription(
      live
        ? 'Mecz się rozpoczął. Powodzenia!'
        : `Host: **${game.initiatorName || 'Gość'}** · status: ${STATE_LABELS[game.state] ?? game.state}`
    )
    .addFields(fields)
    .setFooter({ text: live ? 'Karta zniknie po zakończeniu meczu.' : 'Kliknij Dołącz, żeby dostać zaproszenie.' })
    .setTimestamp(new Date(game.createdAt));
}

/**
 * The join button, and only while joining is actually possible.
 *
 * `open` and `ready` only — the same two states the website's join accepts.
 * A card appears the moment the host presses the button, which is a second or
 * two before the worker has made the Dota lobby, and a Dołącz offered during
 * that window answers "to lobby już nie przyjmuje graczy" to a lobby that is
 * about to open. It also withdraws when the match starts. A button that is
 * there but always says no is worse than no button.
 */
export function lobbyCardComponents(game: InhouseGame): ActionRowBuilder<ButtonBuilder>[] {
  if (game.state !== 'open' && game.state !== 'ready') return [];

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${IDS.join}${game.id}`)
        .setLabel('Dołącz')
        .setEmoji('🎮')
        .setStyle(ButtonStyle.Success)
    ),
  ];
}

/** The permanent message at the top of the channel. */
export function posterEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Inhouse — graj z nami')
    .setDescription(
      'Jedno kliknięcie otwiera poprawnie skonfigurowane lobby Dote 2 i pilnuje go od początku do końca.\n\n' +
        '**➕ Nowa gra** — otwiera lobby. Zapytam, czy ogłosić je całemu serwerowi, czy zagrać tylko ze znajomymi.\n' +
        '**🔗 Połącz ze Steam** — dzięki temu dostaniesz zaproszenie do lobby jednym kliknięciem, a Twoje mecze trafią do statystyk.\n' +
        '**✨ Więcej…** — rankingi, medale, historia meczów i profile graczy na stronie.\n\n' +
        'Komendy działają na każdym kanale: `/ih`, `/link`, `/unlink`, `/ranking`, `/medale`.'
    );
}

export function posterComponents(siteUrl: string): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(IDS.newGame)
        .setLabel('Nowa gra')
        .setEmoji('➕')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(IDS.link)
        .setLabel('Połącz ze Steam')
        .setEmoji('🔗')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setLabel('Więcej… znacznie więcej')
        .setEmoji('✨')
        .setStyle(ButtonStyle.Link)
        .setURL(`${siteUrl}/inhouse`)
    ),
  ];
}

export function rankingEmbed(ranking: {
  gamesPlayed: Array<{ name: string; value: number }>;
  gamesPublished: Array<{ name: string; value: number }>;
  playerOfWeek: { name: string; gamesThisWeek: number } | null;
}): EmbedBuilder {
  const medalFor = (i: number): string => ['🥇', '🥈', '🥉'][i] ?? `\`${String(i + 1).padStart(2, ' ')}.\``;
  const board = (rows: Array<{ name: string; value: number }>, unit: string): string =>
    rows.length
      ? rows.map((r, i) => `${medalFor(i)} **${r.name}** — ${r.value} ${unit}`).join('\n')
      : 'Jeszcze nikt się nie załapał.';

  const embed = new EmbedBuilder()
    .setColor(0xfbbf24)
    .setTitle('🏆 Ranking inhouse')
    .addFields({ name: 'Najwięcej rozegranych gier', value: board(ranking.gamesPlayed, 'gier'), inline: false });

  if (ranking.gamesPublished.length) {
    embed.addFields({
      name: 'Najwięcej otwartych lobby',
      value: board(ranking.gamesPublished.slice(0, 5), 'lobby'),
      inline: false,
    });
  }

  if (ranking.playerOfWeek) {
    embed.addFields({
      name: '⭐ Gracz tygodnia',
      value: `**${ranking.playerOfWeek.name}** — ${ranking.playerOfWeek.gamesThisWeek} gier w zeszłym tygodniu`,
      inline: false,
    });
  }

  return embed;
}

export function medalsEmbed(
  displayName: string,
  data: { name: string | null; gamesPlayed: number; medals: Array<{ label: string; place: 1 | 2 | 3 | null; summary: string }> }
): EmbedBuilder {
  const icon = (place: 1 | 2 | 3 | null): string =>
    place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : '🎖️';

  const embed = new EmbedBuilder()
    .setColor(0xfbbf24)
    .setTitle(`Medale — ${data.name || displayName}`)
    .setDescription(`Rozegranych gier: **${data.gamesPlayed}**`);

  if (!data.medals.length) {
    embed.addFields({
      name: 'Brak medali',
      value: 'Jeszcze żadnych — ale wszystkie mecze są zapisywane, więc jest o co grać.',
      inline: false,
    });
    return embed;
  }

  embed.addFields({
    name: `Zdobyte medale (${data.medals.length})`,
    value: data.medals.map((m) => `${icon(m.place)} ${m.summary}`).join('\n').slice(0, 1024),
    inline: false,
  });
  return embed;
}
