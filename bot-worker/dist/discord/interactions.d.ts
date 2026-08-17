import { type Interaction } from 'discord.js';
import type { GatewayConfig } from './config';
import type { SiteClient } from './site';
export declare class InteractionRouter {
    private site;
    private config;
    constructor(site: SiteClient, config: GatewayConfig);
    handle(interaction: Interaction): Promise<void>;
    /** Last resort, so a thrown handler doesn't leave a spinner forever. */
    private apologise;
    private onButton;
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
    private offerVisibility;
    /** Nothing was created, so there is nothing to undo — just clear the prompt. */
    private cancelNewGame;
    private openLobby;
    /**
     * "Połącz ze Steam", before it asks for anything.
     *
     * Two questions have to be answered before a text box is the right response,
     * and both used to be skipped:
     *
     *   1. **Are they already linked?** Being asked to paste a Steam URL you
     *      supplied months ago reads as the bot having forgotten you. Check first,
     *      and if there is a link, say what it is — including *how* it got there,
     *      since the commonest answer is "you never did this, your Discord Steam
     *      connection did it for you" and nobody remembers that happening.
     *   2. **Do they have to type at all?** They usually don't. The website's
     *      Discord OAuth already asks for the `connections` scope, so anyone with
     *      Steam connected in their Discord settings is linked by pressing one
     *      button and approving a consent screen — no profile URL, no copy-paste,
     *      and their whole match history is backfilled on the way back.
     *
     * The gateway cannot read connections itself: `/users/{id}/connections` needs
     * a *user* token with that scope, and a bot token can never have one. Sending
     * them through the site's existing flow is the whole of the mechanism.
     */
    private offerLink;
    private showLinkModal;
    /**
     * The join help, and the whole point of the Dołącz button.
     *
     * Both paths are offered, exactly as on the website: the lobby name and
     * password for anyone (that is how most people join), and a one-click invite
     * for players whose Steam account we know. The Dota-must-be-running warning
     * is not a detail — an invite sent to a closed client is simply lost, and
     * that is the single most common reason "the invite never came".
     */
    private showJoinHelp;
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
    private requestInvite;
    private unlink;
    private onModal;
    private onCommand;
    private confirmUnlink;
    /** Public by design — a ranking nobody else can see is not a ranking. */
    private postRanking;
    /**
     * Also public — but an unlinked player gets a quiet ephemeral instead, and
     * nothing is posted. Being told in front of the channel that you have no
     * medals because you never linked is a bad first interaction.
     */
    private postMedals;
    /** Admin escape hatch: put the poster back if it was deleted by hand. */
    private repostPoster;
}
