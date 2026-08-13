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
     */
    private offerVisibility;
    private openLobby;
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
