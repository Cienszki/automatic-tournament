import { InhouseStore } from './core/store';
import type { InhouseGame, SlotCounts } from './core/types';
export interface CommandContext {
    game: InhouseGame;
    steamId32: string;
    playerName: string;
    args: string[];
    rest: string;
}
export interface CommandHooks {
    reply: (message: string) => Promise<void>;
    /** Begin the abortable pre-launch countdown. */
    startCountdown: (opts: {
        force: boolean;
        byName: string;
    }) => Promise<void>;
    /** Abort a running countdown. Returns false when nothing was running. */
    cancelCountdown: () => boolean;
    countdownRunning: () => boolean;
    isAdmin: (steamId32: string) => Promise<boolean>;
    /** Generate (or re-use) a one-time link code for this Steam ID. */
    issueLinkCode: (steamId32: string, playerName: string) => Promise<string>;
    /**
     * Link this Steam account to whoever answers to `discordQuery` on the guild.
     * Returns the one-line lobby-chat response; resolution and ambiguity handling
     * live in the runner so this router stays testable without a network.
     */
    linkByDiscordName: (steamId32: string, playerName: string, discordQuery: string) => Promise<{
        message: string;
    }>;
    /** Report which Discord profile this Steam account belongs to, if any. */
    linkInfo: (steamId32: string, playerName: string) => Promise<{
        message: string;
    }>;
    /** Public site URL, used in the `!link` fallback instructions. */
    siteUrl: string;
}
export declare class LobbyCommandRouter {
    private store;
    private hooks;
    private limiter;
    private commands;
    constructor(store: InhouseStore, hooks: CommandHooks);
    /** Returns true when the message was a command the router consumed. */
    handle(game: InhouseGame, steamId32: string, playerName: string, message: string): Promise<boolean>;
    private permitted;
    private add;
    private register;
    /**
     * Who is this Steam account linked to?
     *
     * Answers the question that otherwise has no answer from inside Dota: a
     * player has no way to tell whether their account is connected, or which
     * profile is collecting their games. Also the natural way to notice a
     * mislink — since linking takes no confirmation, this is the check that
     * surfaces one.
     */
    private linkInfo;
    /**
     * Connect a Steam account to a Discord one, from inside the lobby.
     *
     *   !link cienszki   → resolve the name on the guild and link immediately
     *   !link            → fall back to a one-time code typed on the website
     *
     * The named form is the one that matters. Sending a player to a website to
     * log in and type a code has three places to lose them, and they are in Dota
     * precisely because they don't want to be anywhere else. Linking is what
     * unlocks their history — the backfill reports how many past games it found —
     * so the flow has to cost one line of chat.
     *
     * Deliberately NOT a claim-and-confirm handshake: nobody is DM'd to approve.
     * Mislinking costs the mislinker their own stats, which is a price the
     * community owner has explicitly accepted in exchange for the friction.
     * Ambiguity is the real failure, and that IS refused — see the runner.
     */
    private link;
    private status;
    private start;
    private cancel;
    private help;
}
/** `!status` output: `8/10 — need 2. 1 slot reserved (2:14 left).` */
export declare function formatStatus(slots: SlotCounts, game: InhouseGame): string;
export declare function formatCountdown(ms: number): string;
