"use strict";
// src/discord/render.ts
//
// Every embed the bot posts. Kept apart from the interaction handlers so the
// wording and the plumbing can be changed independently — most of the edits
// this file sees will be copy, not logic.
//
// Polish throughout: this is a Polish community, and the lobby chat, the
// website and the Discord surfaces should read as one product rather than
// three. English words survive only where Dota itself uses them.
Object.defineProperty(exports, "__esModule", { value: true });
exports.IDS = void 0;
exports.gameModeLabel = gameModeLabel;
exports.serverRegionLabel = serverRegionLabel;
exports.slotBar = slotBar;
exports.lobbyCardEmbed = lobbyCardEmbed;
exports.lobbyCardComponents = lobbyCardComponents;
exports.posterEmbed = posterEmbed;
exports.posterComponents = posterComponents;
exports.rankingEmbed = rankingEmbed;
exports.rankingComponents = rankingComponents;
exports.medalsEmbed = medalsEmbed;
const discord_js_1 = require("discord.js");
exports.IDS = {
    newGame: 'ih:new',
    newPublic: 'ih:new:public',
    newPrivate: 'ih:new:private',
    newCancel: 'ih:new:cancel',
    link: 'ih:link',
    /** "I'll paste the URL myself" — the only path that may open the modal. */
    linkManual: 'ih:link:manual',
    linkModal: 'ih:link:modal',
    linkInput: 'ih:link:steam',
    unlinkConfirm: 'ih:unlink:confirm',
    /** Suffixed with the game id. */
    join: 'ih:join:',
    invite: 'ih:invite:',
};
const LOBBY_CAPACITY = 10;
/**
 * Bump by hand to force Discord to re-fetch the poster artwork.
 *
 * Discord serves every embed image through media.discordapp.net and caches the
 * result against the source URL, effectively permanently — editing the embed
 * does not make it re-check the origin. So if the URL ever answered with
 * something that wasn't the image, that wrong answer is what the poster shows
 * from then on, no matter what the origin returns afterwards. Which is exactly
 * what happened here: during the domain cutover `/ih.png` was answered by the
 * old Firebase app with an HTML page (200, text/html), and Discord cached it.
 *
 * A new query string is a new cache key, and is the only reliable way out.
 */
const POSTER_ART_VERSION = '2';
/** Only the values an inhouse actually uses get a name; the rest show the raw id. */
const GAME_MODE_LABELS = {
    1: 'All Pick (classic)',
    2: 'Captains Mode',
    3: 'Random Draft',
    4: 'Single Draft',
    5: 'All Random',
    16: 'Captains Draft',
    22: 'All Pick',
};
const SERVER_REGION_LABELS = {
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
function gameModeLabel(mode) {
    return GAME_MODE_LABELS[mode] ?? `tryb ${mode}`;
}
function serverRegionLabel(region) {
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
function slotBar(seated, reserved) {
    const held = Math.max(0, Math.min(reserved, LOBBY_CAPACITY - seated));
    const free = Math.max(0, LOBBY_CAPACITY - seated - held);
    return '🟩'.repeat(seated) + '🟨'.repeat(held) + '⬛'.repeat(free);
}
const STATE_LABELS = {
    lobby_creating: 'tworzenie lobby…',
    open: 'otwarte — dołącz!',
    ready: 'komplet — start lada moment',
    in_progress: 'w trakcie',
};
function cardColour(game, seated) {
    // Yellow first, and before the "taking players" green: the card appears the
    // moment the host presses the button, a second or two before the Dota lobby
    // actually exists. Green there says "come in" to a lobby that isn't ready and
    // has no Dołącz button yet, which reads as a broken button rather than a wait.
    if (game.state === 'lobby_creating')
        return 0xfacc15; // yellow — hold on
    if (game.state === 'in_progress')
        return 0x8b5cf6; // violet — being played
    if (seated >= LOBBY_CAPACITY)
        return 0xf59e0b; // amber — full, about to start
    return 0x22c55e; // green — taking players
}
/** The lobby card: the same facts as the website's card, in Discord's shapes. */
function lobbyCardEmbed(model) {
    const { game, players, seated, reserved } = model;
    const live = game.state === 'in_progress';
    const fields = [
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
    return new discord_js_1.EmbedBuilder()
        .setColor(cardColour(game, seated))
        .setTitle(`Gra #${game.gameNumber}${live ? ' — w trakcie' : ''}`)
        .setDescription(live
        ? 'Mecz się rozpoczął. Powodzenia!'
        : `Host: **${game.initiatorName || 'Gość'}** · status: ${STATE_LABELS[game.state] ?? game.state}`)
        .addFields(fields)
        .setFooter({ text: cardFooter(game) })
        .setTimestamp(new Date(game.createdAt));
}
/**
 * The footer has to agree with the buttons, or it invents a bug.
 *
 * During `lobby_creating` there is deliberately no Dołącz button yet (see
 * `lobbyCardComponents`), so telling people to click one is the fastest way to
 * make a two-second wait look like something broken.
 */
function cardFooter(game) {
    if (game.state === 'in_progress')
        return 'Karta zniknie po zakończeniu meczu.';
    if (game.state === 'lobby_creating')
        return 'Tworzę lobby w Docie — przycisk Dołącz pojawi się za chwilę.';
    return 'Kliknij Dołącz, żeby dostać zaproszenie.';
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
function lobbyCardComponents(game) {
    if (game.state !== 'open' && game.state !== 'ready')
        return [];
    return [
        new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`${exports.IDS.join}${game.id}`)
            .setLabel('Dołącz')
            .setEmoji('🎮')
            .setStyle(discord_js_1.ButtonStyle.Success)),
    ];
}
/**
 * The permanent message at the top of the channel.
 *
 * The artwork and the footer logo are served by the website rather than
 * uploaded as attachments: the poster is *edited* on every boot to keep its id
 * (and therefore its pin), and an edit that drops `files` drops the attachment
 * with it. A URL survives every edit and costs the deploy nothing — which
 * matters here, because only `dist/` ships to Railway.
 */
function posterEmbed(siteUrl) {
    return new discord_js_1.EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('Inhouse — lobby dla społeczności')
        .setURL(siteUrl)
        .setDescription('**▶️ Nowa gra** — rozpocznij nową poczekalnię, do wyboru publiczna lub prywatna.\n' +
        '**🔗 Połącz ze Steam** — dzięki temu nie musisz szukać poczekalni, nasz bot sam Cię zaprosi.\n' +
        '**✨ Pełen panel** — pełna klasyfikacja, medale, historia meczów i profile graczy na stronie.')
        .addFields({
        name: 'Komendy',
        value: '- `/ih` — nowa poczekalnia\n' +
            '- `/link` — połącz konto Steam\n' +
            '- `/unlink` — odłącz konta Steam\n' +
            '- `/ranking` — klasyfikacja\n' +
            '- `/medale` — Twoje medale\n\n' +
            'Działają na każdym kanale.',
        inline: false,
    })
        .setImage(`${siteUrl}/ih.png?v=${POSTER_ART_VERSION}`)
        .setFooter({
        text: 'dota2inhouse.pl',
        iconURL: `${siteUrl}/pd2ih_logo.png?v=${POSTER_ART_VERSION}`,
    });
}
function posterComponents(siteUrl) {
    return [
        new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(exports.IDS.newGame)
            .setLabel('Nowa gra')
            .setEmoji('▶️')
            .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
            .setCustomId(exports.IDS.link)
            .setLabel('Połącz ze Steam')
            .setEmoji('🔗')
            .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
            .setLabel('Pełen panel')
            .setEmoji('✨')
            .setStyle(discord_js_1.ButtonStyle.Link)
            .setURL(`${siteUrl}/inhouse`)),
    ];
}
function rankingEmbed(ranking) {
    const medalFor = (i) => ['🥇', '🥈', '🥉'][i] ?? `\`${String(i + 1).padStart(2, ' ')}.\``;
    const board = (rows, unit) => rows.length
        ? rows.map((r, i) => `${medalFor(i)} **${r.name}** — ${r.value} ${unit}`).join('\n')
        : 'Jeszcze nikt się nie załapał.';
    const embed = new discord_js_1.EmbedBuilder()
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
/**
 * The five names Discord can fit are the top of a much longer board — the
 * button is how anyone who is not in the top five finds themselves.
 */
function rankingComponents(siteUrl) {
    return [
        new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setLabel('więcej na stronie…')
            .setEmoji('🏆')
            .setStyle(discord_js_1.ButtonStyle.Link)
            .setURL(`${siteUrl}/inhouse/leaderboards`)),
    ];
}
function medalsEmbed(displayName, data) {
    const icon = (place) => place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : '🎖️';
    const embed = new discord_js_1.EmbedBuilder()
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
