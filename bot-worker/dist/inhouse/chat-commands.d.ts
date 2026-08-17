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
    /**
     * Everyone the GC currently reports in the lobby, under the names shown in
     * the Dota lobby UI — not the ones we have stored. `!kick` matches on these
     * because they are the only names the person typing can actually see.
     *
     * Async because those names are not free: the lobby member objects the GC
     * sends us carry no name at all (our patched CSODOTALobbyMember has room for
     * id, team and slot and nothing else), so each one is resolved from Steam.
     */
    lobbyPlayers: () => Promise<LobbyMember[]>;
    /** Change the lobby's game mode in place. False when there is no lobby yet. */
    setGameMode: (gameMode: number) => Promise<boolean>;
    /** Remove someone from the lobby entirely. */
    kick: (steamId32: string) => Promise<void>;
    /** Move someone out of their team slot into the unassigned pool. */
    kickFromTeam: (steamId32: string) => Promise<void>;
}
/** A lobby occupant as the GC sees them, which is how the players see them too. */
export interface LobbyMember {
    steamId32: string;
    name: string | null;
    team: 'radiant' | 'dire' | 'spectator' | 'unassigned' | 'broadcaster';
    /** True for the bot's own account — never a kick target. */
    isSelf: boolean;
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
     * Who is the host — deliberately open to everyone.
     *
     * Half the host-only commands get typed by someone who isn't the host, and
     * "Only the host can use !kick" is a useless answer if nobody in the lobby
     * knows who that is. This is also what the failed-launch notice points at.
     */
    private host;
    /**
     * !ap / !cm / !sd / !cd — swap the mode without remaking the lobby.
     *
     * Refused once the game is locked: the mode is baked in at launch, and
     * changing it under a lobby that is already counting down would either do
     * nothing or produce a game nobody agreed to.
     */
    private setMode;
    /**
     * !kick <fragment nicku> — remove someone from the lobby.
     *
     * Matches on the names the GC reports, because those are the names on screen;
     * the names we have stored may be Discord nicknames the kicker has never seen.
     * A prefix is enough, but it has to be unambiguous — kicking the wrong person
     * out of a ten-person lobby is not something an "I guessed" can undo, so an
     * ambiguous fragment lists the candidates and does nothing.
     */
    private kick;
    /**
     * !slot / !sloty / !slots — empty both team slots in one go.
     *
     * The per-player version of this is a right-click in the lobby UI, which is
     * ten right-clicks when the teams need redoing. Nobody leaves the lobby; they
     * all land in the unassigned pool and re-seat themselves.
     */
    private clearSlots;
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
    /**
     * Split by audience rather than alphabetically: lobby chat scrolls, and a
     * flat list of a dozen commands tells nobody which ones they can actually
     * use. Sent as two lines so neither is truncated.
     */
    private help;
}
/** `Host: Kowalski. !host powie to jeszcze raz.` — one line, reused by several commands. */
export declare function hostLine(game: InhouseGame): string;
export type LobbyMatch = {
    status: 'ok';
    player: LobbyMember;
} | {
    status: 'none';
} | {
    status: 'self';
} | {
    status: 'ambiguous';
    candidates: string[];
};
/**
 * Resolve a typed fragment to exactly one lobby member.
 *
 * Three passes, narrowest first: an exact name wins outright (so someone whose
 * whole name is a prefix of a longer one is still reachable), then prefix, then
 * substring. Anything matching more than one player at the winning precision is
 * refused rather than guessed — see `kick`.
 */
export declare function matchLobbyPlayer(players: LobbyMember[], query: string): LobbyMatch;
/** `!status` output: `8/10 — need 2. 1 slot reserved (2:14 left).` */
export declare function formatStatus(slots: SlotCounts, game: InhouseGame): string;
export declare function formatCountdown(ms: number): string;
