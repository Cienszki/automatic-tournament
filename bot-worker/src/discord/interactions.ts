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

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Interaction,
  type ModalSubmitInteraction,
} from 'discord.js';
import { logger } from '../logger';
import type { GatewayConfig } from './config';
import type { SiteClient, JoinInfo } from './site';
import {
  IDS,
  gameModeLabel,
  medalsEmbed,
  posterComponents,
  posterEmbed,
  rankingComponents,
  rankingEmbed,
  serverRegionLabel,
} from './render';

const EPHEMERAL = { flags: MessageFlags.Ephemeral } as const;

export class InteractionRouter {
  constructor(
    private site: SiteClient,
    private config: GatewayConfig
  ) {}

  async handle(interaction: Interaction): Promise<void> {
    try {
      if (interaction.isButton()) return await this.onButton(interaction);
      if (interaction.isModalSubmit()) return await this.onModal(interaction);
      if (interaction.isChatInputCommand()) return await this.onCommand(interaction);
    } catch (error) {
      logger.error('[Discord] Interaction failed', error);
      await this.apologise(interaction);
    }
  }

  /** Last resort, so a thrown handler doesn't leave a spinner forever. */
  private async apologise(interaction: Interaction): Promise<void> {
    if (!interaction.isRepliable()) return;
    const message = 'Coś poszło nie tak. Spróbuj jeszcze raz za chwilę.';
    try {
      if (interaction.deferred || interaction.replied) await interaction.editReply({ content: message });
      else await interaction.reply({ content: message, ...EPHEMERAL });
    } catch {
      /* the interaction is already gone */
    }
  }

  // ─── Buttons ───────────────────────────────────────────────────────────────

  private async onButton(interaction: ButtonInteraction): Promise<void> {
    const id = interaction.customId;

    if (id === IDS.newGame) return this.offerVisibility(interaction);
    if (id === IDS.newPublic) return this.openLobby(interaction, true);
    if (id === IDS.newPrivate) return this.openLobby(interaction, false);
    if (id === IDS.newCancel) return this.cancelNewGame(interaction);
    if (id === IDS.link) return this.showLinkModal(interaction);
    if (id === IDS.unlinkConfirm) return this.unlink(interaction);
    if (id.startsWith(IDS.join)) return this.showJoinHelp(interaction, id.slice(IDS.join.length));
    if (id.startsWith(IDS.invite)) return this.requestInvite(interaction, id.slice(IDS.invite.length));
  }

  /**
   * The one question the website never asks: who is this lobby for?
   *
   * Site lobbies publish themselves, because someone opening one from the
   * public board has already decided. In Discord a host may well mean "just us
   * five" — so ask, once, before anything is created.
   *
   * The way out matters as much as the two answers. Plenty of people press
   * "Nowa gra" to see what it does, and without a third button their only exits
   * are opening a lobby they never wanted — which burns a bot account and one of
   * the few open-lobby slots — or leaving the prompt hanging. Nothing has been
   * created at this point, so cancelling really is free.
   */
  private async offerVisibility(interaction: ButtonInteraction | ChatInputCommandInteraction): Promise<void> {
    await interaction.reply({
      content:
        '**Kogo zapraszasz?**\n' +
        '🌍 **Cały serwer** — lobby pojawi się na kanale i na stronie, każdy może dołączyć.\n' +
        '🔒 **Tylko znajomi** — nikt inny go nie zobaczy, wyślij im nazwę i hasło sam.\n\n' +
        '_Jeszcze nic nie powstało — możesz spokojnie wyjść._',
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(IDS.newPublic)
            .setLabel('Cały serwer')
            .setEmoji('🌍')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(IDS.newPrivate)
            .setLabel('Tylko znajomi')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(IDS.newCancel)
            .setLabel('Jednak się rozmyśliłem')
            .setEmoji('↩️')
            .setStyle(ButtonStyle.Secondary)
        ),
      ],
      ...EPHEMERAL,
    });
  }

  /** Nothing was created, so there is nothing to undo — just clear the prompt. */
  private async cancelNewGame(interaction: ButtonInteraction): Promise<void> {
    await interaction.update({
      content: 'Jasne — nic nie otwieram. Kliknij **Nowa gra**, kiedy będziesz gotowy.',
      components: [],
    });
  }

  private async openLobby(interaction: ButtonInteraction, published: boolean): Promise<void> {
    await interaction.update({ content: 'Otwieram lobby…', components: [] });

    const result = await this.site.openLobby({
      discordId: interaction.user.id,
      discordName: displayNameOf(interaction),
      published,
    });

    switch (result.status) {
      case 'ok': {
        if (published) {
          // Nothing to say: the card lands in the channel within a second and
          // is a better confirmation than any message. Angle brackets are the
          // reason the URL is gone entirely — a link here dragged the site's
          // whole preview card into the reply.
          await interaction.deleteReply().catch(() => interaction.editReply({ content: 'Gotowe.' }));
          return;
        }

        // A private lobby gets no card, so this is the only place its host can
        // learn what to send their friends.
        const credentials =
          result.lobbyName && result.lobbyPassword
            ? `Nazwa: \`${result.lobbyName}\` · hasło: \`${result.lobbyPassword}\``
            : `Nazwa i hasło: <${this.config.siteUrl}/inhouse/${result.gameId}>`;
        await interaction.editReply({
          content: `Gotowe — lobby prywatne, nikt inny go nie zobaczy.\n${credentials}`,
        });
        return;
      }
      case 'too_many_open':
        await interaction.editReply({
          content:
            `Są już otwarte ${result.max} lobby — więcej naraz nie otwieramy, bo przy trzech ` +
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

  private async showLinkModal(interaction: ButtonInteraction | ChatInputCommandInteraction): Promise<void> {
    const modal = new ModalBuilder()
      .setCustomId(IDS.linkModal)
      .setTitle('Połącz konto Steam')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId(IDS.linkInput)
            .setLabel('Link do Twojego profilu Steam')
            .setPlaceholder('https://steamcommunity.com/id/twojnick')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
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
  private async showJoinHelp(interaction: ButtonInteraction, gameId: string): Promise<void> {
    await interaction.deferReply(EPHEMERAL);

    const info: JoinInfo = await this.site.joinInfo(gameId, interaction.user.id, displayNameOf(interaction));

    if (info.status !== 'ok') {
      await interaction.editReply({ content: joinInfoProblem(info.status) });
      return;
    }

    const lines = [
      `**Nazwa lobby:** \`${info.lobbyName ?? '—'}\``,
      `**Hasło:** \`${info.password ?? '—'}\``,
      `**Tryb:** ${gameModeLabel(info.gameMode)} · **serwer:** ${serverRegionLabel(info.serverRegion)}`,
      '',
      'W Docie 2: **Graj** → **Lobby** → *Znajdź lobby*, wpisz nazwę i wejdź hasłem.',
    ];

    const row = new ActionRowBuilder<ButtonBuilder>();
    if (info.canBeInvited) {
      lines.push('', '…albo daj się zaprosić jednym kliknięciem — **musisz mieć włączoną Dotę 2**, ' +
        'inaczej zaproszenie przepadnie.');
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`${IDS.invite}${gameId}`)
          .setLabel('Zaproś mnie')
          .setEmoji('📨')
          .setStyle(ButtonStyle.Success)
      );
    } else {
      lines.push('', 'Żeby dostawać zaproszenia jednym kliknięciem, połącz konto Steam.');
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(IDS.link)
          .setLabel('Konta Steam niepołączone')
          .setEmoji('🔗')
          .setStyle(ButtonStyle.Secondary)
      );
    }

    await interaction.editReply({ content: lines.join('\n'), components: [row] });
  }

  /**
   * "Zaproś mnie", and every repeat press of it.
   *
   * A Steam invite is fire-and-forget: sent to a client that is closed, or to
   * someone who was mid-menu, it is gone with nothing to click. So this is
   * deliberately re-runnable — the reply always keeps a button that calls
   * straight back here, and the website re-fires the invite for a player who
   * already holds a slot instead of only re-showing their credentials. One
   * missed invite must never be the end of the road.
   */
  private async requestInvite(interaction: ButtonInteraction, gameId: string): Promise<void> {
    await interaction.deferUpdate();

    const result = await this.site.join(gameId, interaction.user.id, displayNameOf(interaction));
    const held = (expiresAt: string | null): string =>
      expiresAt ? ` Miejsce trzymam do <t:${Math.floor(Date.parse(expiresAt) / 1000)}:t>.` : '';

    /** The way back to this handler, on every reply that could need it. */
    const retry = (label: string): ActionRowBuilder<ButtonBuilder>[] => [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${IDS.invite}${gameId}`)
          .setLabel(label)
          .setEmoji('📨')
          .setStyle(ButtonStyle.Secondary)
      ),
    ];

    switch (result.status) {
      case 'reserved':
        await interaction.editReply({
          content:
            `Zaproszenie wysłane — sprawdź Dotę.${held(result.expiresAt)}\n` +
            `Jeśli nie przyszło, wejdź ręcznie: \`${result.lobbyName ?? '—'}\` / \`${result.password ?? '—'}\` ` +
            'albo kliknij poniżej, a wyślę je jeszcze raz.',
          components: retry('Wyślij zaproszenie ponownie'),
        });
        return;
      case 'already_reserved':
        await interaction.editReply({
          content:
            `Masz już miejsce w tym lobby — wysłałem zaproszenie jeszcze raz, sprawdź Dotę. ` +
            '**Dota 2 musi być włączona**, inaczej zaproszenie przepadnie.\n' +
            `Ręcznie: \`${result.lobbyName ?? '—'}\` / \`${result.password ?? '—'}\``,
          components: retry('Wyślij jeszcze raz'),
        });
        return;
      case 'in_lobby':
        await interaction.editReply({
          content: `Jesteś już w tym lobby. \`${result.lobbyName ?? '—'}\` / \`${result.password ?? '—'}\``,
          components: [],
        });
        return;
      case 'waitlisted':
        await interaction.editReply({
          content:
            `Komplet — jesteś ${result.position}. na liście rezerwowej. ` +
            'Zaproszenie już poszło, więc jeśli ktoś wyjdzie, wchodzisz od ręki.',
          components: retry('Wyślij zaproszenie ponownie'),
        });
        return;
      case 'needs_link':
        await interaction.editReply({
          content: 'Najpierw połącz konto Steam — bez tego nie mam Cię kogo zaprosić.',
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId(IDS.link)
                .setLabel('Połącz ze Steam')
                .setEmoji('🔗')
                .setStyle(ButtonStyle.Primary)
            ),
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

  private async unlink(interaction: ButtonInteraction): Promise<void> {
    await interaction.update({ content: 'Odłączam…', components: [] });

    const result = await this.site.unlink(interaction.user.id);
    if (!result) {
      await interaction.editReply({ content: 'Nie udało się odłączyć kont. Spróbuj później.' });
      return;
    }

    await interaction.editReply({
      content:
        result.status === 'unlinked'
          ? `Odłączono ${result.removed.length} konto(-a) Steam. Twoje rozegrane mecze zostają w historii, ` +
            'ale nie są już przypisane do Ciebie — połącz konto ponownie, żeby je odzyskać.'
          : 'Nie masz połączonego żadnego konta Steam.',
    });
  }

  // ─── Modal ─────────────────────────────────────────────────────────────────

  private async onModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (interaction.customId !== IDS.linkModal) return;
    await interaction.deferReply(EPHEMERAL);

    const pasted = interaction.fields.getTextInputValue(IDS.linkInput);
    const outcome = await this.site.link(interaction.user.id, displayNameOf(interaction), pasted);

    switch (outcome.status) {
      case 'linked':
        await interaction.editReply({
          content:
            `Połączono ✅${outcome.total > 1 ? ` (kont Steam: ${outcome.total})` : ''}\n` +
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
          content:
            'To konto Steam jest już przypisane do innego profilu Discord. ' +
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
          content:
            'Nie rozpoznaję tego linku. Wklej adres swojego profilu, np. ' +
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

  private async onCommand(interaction: ChatInputCommandInteraction): Promise<void> {
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

  private async confirmUnlink(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply({
      content:
        '**Na pewno?** Odłączę **wszystkie** Twoje konta Steam. ' +
        'Statystyki policzone z tych kont przestaną być Twoje, dopóki nie połączysz ich z powrotem.',
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(IDS.unlinkConfirm)
            .setLabel('Odłącz wszystkie')
            .setStyle(ButtonStyle.Danger)
        ),
      ],
      ...EPHEMERAL,
    });
  }

  /** Public by design — a ranking nobody else can see is not a ranking. */
  private async postRanking(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const ranking = await this.site.ranking();
    if (!ranking) {
      await interaction.editReply({ content: 'Nie mogę teraz pobrać rankingu. Spróbuj za chwilę.' });
      return;
    }
    await interaction.editReply({
      embeds: [rankingEmbed(ranking)],
      components: rankingComponents(this.config.siteUrl),
    });
  }

  /**
   * Also public — but an unlinked player gets a quiet ephemeral instead, and
   * nothing is posted. Being told in front of the channel that you have no
   * medals because you never linked is a bad first interaction.
   */
  private async postMedals(interaction: ChatInputCommandInteraction): Promise<void> {
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
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                  .setCustomId(IDS.link)
                  .setLabel('Połącz ze Steam')
                  .setEmoji('🔗')
                  .setStyle(ButtonStyle.Primary)
              ),
            ]
          : [],
        ...EPHEMERAL,
      });
      return;
    }

    await interaction.editReply({ embeds: [medalsEmbed(displayNameOf(interaction) ?? 'gracz', result)] });
  }

  /** Admin escape hatch: put the poster back if it was deleted by hand. */
  private async repostPoster(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.channel || !interaction.channel.isSendable()) {
      await interaction.reply({ content: 'Nie mogę pisać na tym kanale.', ...EPHEMERAL });
      return;
    }
    await interaction.reply({ content: 'Wysyłam nowy poster…', ...EPHEMERAL });
    await interaction.channel.send({
      embeds: [posterEmbed(this.config.siteUrl)],
      components: posterComponents(this.config.siteUrl),
    });
  }
}

/** The per-server nickname when there is one — the name everything else prefers. */
function displayNameOf(
  interaction: ButtonInteraction | ChatInputCommandInteraction | ModalSubmitInteraction
): string | null {
  const member = interaction.member;
  if (member && 'displayName' in member && typeof member.displayName === 'string') {
    return member.displayName;
  }
  if (member && 'nick' in member && typeof member.nick === 'string' && member.nick) {
    return member.nick;
  }
  return interaction.user.globalName ?? interaction.user.username ?? null;
}

function joinInfoProblem(status: 'unavailable' | 'not_found' | 'not_open' | 'banned'): string {
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
