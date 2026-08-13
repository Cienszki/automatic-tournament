"use strict";
// src/discord/interactions.ts
//
// Every button, modal and command the bot answers.
//
// Two rules run through all of it:
//
//   1. **Nothing here decides anything.** Opening a lobby, joining one and
//      linking a Steam account are all calls to the website's own endpoints, so
//      the open-lobby cap, the reservation transaction and the linking rules
//      have exactly one implementation (see site.ts).
//   2. **Defer before calling the site.** Discord gives an interaction three
//      seconds to be acknowledged, and opening a lobby is a reconcile, a lease
//      and several writes. Deferring first is the difference between a working
//      button and "Ta interakcja nie powiodła się".
Object.defineProperty(exports, "__esModule", { value: true });
exports.InteractionRouter = void 0;
const discord_js_1 = require("discord.js");
const logger_1 = require("../logger");
const render_1 = require("./render");
const EPHEMERAL = { flags: discord_js_1.MessageFlags.Ephemeral };
class InteractionRouter {
    site;
    config;
    constructor(site, config) {
        this.site = site;
        this.config = config;
    }
    async handle(interaction) {
        try {
            if (interaction.isButton())
                return await this.onButton(interaction);
            if (interaction.isModalSubmit())
                return await this.onModal(interaction);
            if (interaction.isChatInputCommand())
                return await this.onCommand(interaction);
        }
        catch (error) {
            logger_1.logger.error('[Discord] Interaction failed', error);
            await this.apologise(interaction);
        }
    }
    /** Last resort, so a thrown handler doesn't leave a spinner forever. */
    async apologise(interaction) {
        if (!interaction.isRepliable())
            return;
        const message = 'Coś poszło nie tak. Spróbuj jeszcze raz za chwilę.';
        try {
            if (interaction.deferred || interaction.replied)
                await interaction.editReply({ content: message });
            else
                await interaction.reply({ content: message, ...EPHEMERAL });
        }
        catch {
            /* the interaction is already gone */
        }
    }
    // ─── Buttons ───────────────────────────────────────────────────────────────
    async onButton(interaction) {
        const id = interaction.customId;
        if (id === render_1.IDS.newGame)
            return this.offerVisibility(interaction);
        if (id === render_1.IDS.newPublic)
            return this.openLobby(interaction, true);
        if (id === render_1.IDS.newPrivate)
            return this.openLobby(interaction, false);
        if (id === render_1.IDS.link)
            return this.showLinkModal(interaction);
        if (id === render_1.IDS.unlinkConfirm)
            return this.unlink(interaction);
        if (id.startsWith(render_1.IDS.join))
            return this.showJoinHelp(interaction, id.slice(render_1.IDS.join.length));
        if (id.startsWith(render_1.IDS.invite))
            return this.requestInvite(interaction, id.slice(render_1.IDS.invite.length));
    }
    /**
     * The one question the website never asks: who is this lobby for?
     *
     * Site lobbies publish themselves, because someone opening one from the
     * public board has already decided. In Discord a host may well mean "just us
     * five" — so ask, once, before anything is created.
     */
    async offerVisibility(interaction) {
        await interaction.reply({
            content: '**Kogo zapraszasz?**\n' +
                '🌍 **Cały serwer** — lobby pojawi się na kanale i na stronie, każdy może dołączyć.\n' +
                '🔒 **Tylko znajomi** — nikt inny go nie zobaczy, wyślij im nazwę i hasło sam.',
            components: [
                new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(render_1.IDS.newPublic)
                    .setLabel('Cały serwer')
                    .setEmoji('🌍')
                    .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
                    .setCustomId(render_1.IDS.newPrivate)
                    .setLabel('Tylko znajomi')
                    .setEmoji('🔒')
                    .setStyle(discord_js_1.ButtonStyle.Secondary)),
            ],
            ...EPHEMERAL,
        });
    }
    async openLobby(interaction, published) {
        await interaction.update({ content: 'Otwieram lobby…', components: [] });
        const result = await this.site.openLobby({
            discordId: interaction.user.id,
            discordName: displayNameOf(interaction),
            published,
        });
        const gameUrl = (gameId) => `${this.config.siteUrl}/inhouse/${gameId}`;
        switch (result.status) {
            case 'ok':
                await interaction.editReply({
                    content: published
                        ? `Gotowe — lobby otwarte i ogłoszone na kanale. Szczegóły: ${gameUrl(result.gameId)}\n` +
                            'Bot tworzy je teraz w Docie; karta pojawi się za chwilę.'
                        : `Gotowe — lobby prywatne, nikt go nie zobaczy. Nazwa i hasło: ${gameUrl(result.gameId)}\n` +
                            'Wyślij je znajomym, albo zaproś ich przez `Dołącz` na stronie.',
                });
                return;
            case 'too_many_open':
                await interaction.editReply({
                    content: `Są już otwarte ${result.max} lobby — więcej naraz nie otwieramy, bo przy trzech ` +
                        `nigdzie nie zbiera się dziesiątka. Dołącz do któregoś na kanale, albo poczekaj aż się zacznie.`,
                });
                return;
            case 'no_bots':
                await interaction.editReply({
                    content: 'Wszystkie konta bota są teraz zajęte. Spróbuj ponownie, gdy któraś gra się skończy.',
                });
                return;
            case 'banned':
                await interaction.editReply({ content: 'Nie możesz teraz otwierać lobby.' });
                return;
            default:
                await interaction.editReply({
                    content: 'Nie udało się otworzyć lobby. Spróbuj jeszcze raz, a jeśli to się powtórzy — daj znać adminom.',
                });
        }
    }
    async showLinkModal(interaction) {
        const modal = new discord_js_1.ModalBuilder()
            .setCustomId(render_1.IDS.linkModal)
            .setTitle('Połącz konto Steam')
            .addComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.TextInputBuilder()
            .setCustomId(render_1.IDS.linkInput)
            .setLabel('Link do Twojego profilu Steam')
            .setPlaceholder('https://steamcommunity.com/id/twojnick')
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(true)));
        await interaction.showModal(modal);
    }
    /**
     * The join help, and the whole point of the Dołącz button.
     *
     * Both paths are offered, exactly as on the website: the lobby name and
     * password for anyone (that is how most people join), and a one-click invite
     * for players whose Steam account we know. The Dota-must-be-running warning
     * is not a detail — an invite sent to a closed client is simply lost, and
     * that is the single most common reason "the invite never came".
     */
    async showJoinHelp(interaction, gameId) {
        await interaction.deferReply(EPHEMERAL);
        const info = await this.site.joinInfo(gameId, interaction.user.id, displayNameOf(interaction));
        if (info.status !== 'ok') {
            await interaction.editReply({ content: joinInfoProblem(info.status) });
            return;
        }
        const lines = [
            `**Nazwa lobby:** \`${info.lobbyName ?? '—'}\``,
            `**Hasło:** \`${info.password ?? '—'}\``,
            `**Tryb:** ${(0, render_1.gameModeLabel)(info.gameMode)} · **serwer:** ${(0, render_1.serverRegionLabel)(info.serverRegion)}`,
            '',
            'W Docie 2: **Graj** → **Lobby** → *Znajdź lobby*, wpisz nazwę i wejdź hasłem.',
        ];
        const row = new discord_js_1.ActionRowBuilder();
        if (info.canBeInvited) {
            lines.push('', '…albo daj się zaprosić jednym kliknięciem — **musisz mieć włączoną Dotę 2**, ' +
                'inaczej zaproszenie przepadnie.');
            row.addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`${render_1.IDS.invite}${gameId}`)
                .setLabel('Zaproś mnie')
                .setEmoji('📨')
                .setStyle(discord_js_1.ButtonStyle.Success));
        }
        else {
            lines.push('', 'Żeby dostawać zaproszenia jednym kliknięciem, połącz konto Steam.');
            row.addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(render_1.IDS.link)
                .setLabel('Konta Steam niepołączone')
                .setEmoji('🔗')
                .setStyle(discord_js_1.ButtonStyle.Secondary));
        }
        await interaction.editReply({ content: lines.join('\n'), components: [row] });
    }
    async requestInvite(interaction, gameId) {
        await interaction.deferUpdate();
        const result = await this.site.join(gameId, interaction.user.id, displayNameOf(interaction));
        const held = (expiresAt) => expiresAt ? ` Miejsce trzymam do <t:${Math.floor(Date.parse(expiresAt) / 1000)}:t>.` : '';
        switch (result.status) {
            case 'reserved':
                await interaction.editReply({
                    content: `Zaproszenie wysłane — sprawdź Dotę.${held(result.expiresAt)}\n` +
                        `Jeśli nie przyszło, wejdź ręcznie: \`${result.lobbyName ?? '—'}\` / \`${result.password ?? '—'}\`.`,
                    components: [],
                });
                return;
            case 'already_reserved':
            case 'in_lobby':
                await interaction.editReply({
                    content: `Masz już miejsce w tym lobby. \`${result.lobbyName ?? '—'}\` / \`${result.password ?? '—'}\``,
                    components: [],
                });
                return;
            case 'waitlisted':
                await interaction.editReply({
                    content: `Komplet — jesteś ${result.position}. na liście rezerwowej. ` +
                        'Zaproszenie już poszło, więc jeśli ktoś wyjdzie, wchodzisz od ręki.',
                    components: [],
                });
                return;
            case 'needs_link':
                await interaction.editReply({
                    content: 'Najpierw połącz konto Steam — bez tego nie mam Cię kogo zaprosić.',
                    components: [
                        new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                            .setCustomId(render_1.IDS.link)
                            .setLabel('Połącz ze Steam')
                            .setEmoji('🔗')
                            .setStyle(discord_js_1.ButtonStyle.Primary)),
                    ],
                });
                return;
            case 'not_open':
                await interaction.editReply({ content: 'To lobby już nie przyjmuje graczy.', components: [] });
                return;
            case 'locked':
                await interaction.editReply({ content: 'Gra właśnie startuje — za późno na dołączenie.', components: [] });
                return;
            case 'banned':
                await interaction.editReply({ content: 'Nie możesz teraz dołączać do lobby.', components: [] });
                return;
            default:
                await interaction.editReply({
                    content: 'Nie udało się zarezerwować miejsca. Spróbuj jeszcze raz.',
                    components: [],
                });
        }
    }
    async unlink(interaction) {
        await interaction.update({ content: 'Odłączam…', components: [] });
        const result = await this.site.unlink(interaction.user.id);
        if (!result) {
            await interaction.editReply({ content: 'Nie udało się odłączyć kont. Spróbuj później.' });
            return;
        }
        await interaction.editReply({
            content: result.status === 'unlinked'
                ? `Odłączono ${result.removed.length} konto(-a) Steam. Twoje rozegrane mecze zostają w historii, ` +
                    'ale nie są już przypisane do Ciebie — połącz konto ponownie, żeby je odzyskać.'
                : 'Nie masz połączonego żadnego konta Steam.',
        });
    }
    // ─── Modal ─────────────────────────────────────────────────────────────────
    async onModal(interaction) {
        if (interaction.customId !== render_1.IDS.linkModal)
            return;
        await interaction.deferReply(EPHEMERAL);
        const pasted = interaction.fields.getTextInputValue(render_1.IDS.linkInput);
        const outcome = await this.site.link(interaction.user.id, displayNameOf(interaction), pasted);
        switch (outcome.status) {
            case 'linked':
                await interaction.editReply({
                    content: `Połączono ✅${outcome.total > 1 ? ` (kont Steam: ${outcome.total})` : ''}\n` +
                        (outcome.gamesFound
                            ? `Znalazłem **${outcome.gamesFound}** Twoich wcześniejszych gier — są już na Twoim profilu.`
                            : 'Od teraz Twoje mecze będą się liczyć do statystyk, a zaproszenia przyjdą jednym kliknięciem.'),
                });
                return;
            case 'already_linked':
                await interaction.editReply({ content: 'To konto jest już połączone z Twoim profilem.' });
                return;
            case 'claimed_by_other':
                await interaction.editReply({
                    content: 'To konto Steam jest już przypisane do innego profilu Discord. ' +
                        'Jeśli to Twoje konto, odezwij się do adminów.',
                });
                return;
            case 'vanity_not_found':
                await interaction.editReply({
                    content: 'Nie znalazłem takiego profilu na Steamie. Sprawdź link i spróbuj ponownie.',
                });
                return;
            case 'unrecognised':
                await interaction.editReply({
                    content: 'Nie rozpoznaję tego linku. Wklej adres swojego profilu, np. ' +
                        '`https://steamcommunity.com/id/twojnick` albo `https://steamcommunity.com/profiles/7656…`.',
                });
                return;
            default:
                await interaction.editReply({
                    content: 'Nie udało się teraz sprawdzić profilu na Steamie. Spróbuj za chwilę.',
                });
        }
    }
    // ─── Slash commands ────────────────────────────────────────────────────────
    async onCommand(interaction) {
        switch (interaction.commandName) {
            case 'inhouse':
            case 'ih':
                return this.offerVisibility(interaction);
            case 'link':
                return this.showLinkModal(interaction);
            case 'unlink':
                return this.confirmUnlink(interaction);
            case 'ranking':
                return this.postRanking(interaction);
            case 'medale':
            case 'medals':
                return this.postMedals(interaction);
            case 'poster':
                return this.repostPoster(interaction);
        }
    }
    async confirmUnlink(interaction) {
        await interaction.reply({
            content: '**Na pewno?** Odłączę **wszystkie** Twoje konta Steam. ' +
                'Statystyki policzone z tych kont przestaną być Twoje, dopóki nie połączysz ich z powrotem.',
            components: [
                new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(render_1.IDS.unlinkConfirm)
                    .setLabel('Odłącz wszystkie')
                    .setStyle(discord_js_1.ButtonStyle.Danger)),
            ],
            ...EPHEMERAL,
        });
    }
    /** Public by design — a ranking nobody else can see is not a ranking. */
    async postRanking(interaction) {
        await interaction.deferReply();
        const ranking = await this.site.ranking();
        if (!ranking) {
            await interaction.editReply({ content: 'Nie mogę teraz pobrać rankingu. Spróbuj za chwilę.' });
            return;
        }
        await interaction.editReply({ embeds: [(0, render_1.rankingEmbed)(ranking)] });
    }
    /**
     * Also public — but an unlinked player gets a quiet ephemeral instead, and
     * nothing is posted. Being told in front of the channel that you have no
     * medals because you never linked is a bad first interaction.
     */
    async postMedals(interaction) {
        await interaction.deferReply();
        const result = await this.site.medals(interaction.user.id);
        if (!result || result.status === 'not_linked') {
            await interaction.deleteReply().catch(() => undefined);
            await interaction.followUp({
                content: !result
                    ? 'Nie mogę teraz pobrać medali. Spróbuj za chwilę.'
                    : 'Nie masz połączonego konta Steam, więc nie mam czego pokazać. Kliknij poniżej, żeby to zmienić.',
                components: result
                    ? [
                        new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                            .setCustomId(render_1.IDS.link)
                            .setLabel('Połącz ze Steam')
                            .setEmoji('🔗')
                            .setStyle(discord_js_1.ButtonStyle.Primary)),
                    ]
                    : [],
                ...EPHEMERAL,
            });
            return;
        }
        await interaction.editReply({ embeds: [(0, render_1.medalsEmbed)(displayNameOf(interaction) ?? 'gracz', result)] });
    }
    /** Admin escape hatch: put the poster back if it was deleted by hand. */
    async repostPoster(interaction) {
        if (!interaction.channel || !interaction.channel.isSendable()) {
            await interaction.reply({ content: 'Nie mogę pisać na tym kanale.', ...EPHEMERAL });
            return;
        }
        await interaction.reply({ content: 'Wysyłam nowy poster…', ...EPHEMERAL });
        await interaction.channel.send({
            embeds: [(0, render_1.posterEmbed)()],
            components: (0, render_1.posterComponents)(this.config.siteUrl),
        });
    }
}
exports.InteractionRouter = InteractionRouter;
/** The per-server nickname when there is one — the name everything else prefers. */
function displayNameOf(interaction) {
    const member = interaction.member;
    if (member && 'displayName' in member && typeof member.displayName === 'string') {
        return member.displayName;
    }
    if (member && 'nick' in member && typeof member.nick === 'string' && member.nick) {
        return member.nick;
    }
    return interaction.user.globalName ?? interaction.user.username ?? null;
}
function joinInfoProblem(status) {
    switch (status) {
        case 'not_found':
            return 'Nie ma już takiego lobby.';
        case 'not_open':
            return 'To lobby już nie przyjmuje graczy.';
        case 'banned':
            return 'Nie możesz teraz dołączać do lobby.';
        default:
            return 'Nie mogę teraz sprawdzić tego lobby. Spróbuj za chwilę.';
    }
}
