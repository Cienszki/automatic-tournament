export interface DiscordLookupConfig {
    /** Bot token. Null disables name lookup — `!link` falls back to a code. */
    token: string | null;
    guildId: string | null;
}
export interface DiscordMemberMatch {
    discordId: string;
    /** Server nickname if set, else global name, else username — the name people know them by. */
    displayName: string;
}
export type DiscordLookupResult = {
    ok: true;
    match: DiscordMemberMatch;
} | {
    ok: false;
    reason: 'not_configured' | 'not_found' | 'error';
}
/** Several people answer to this name — refuse rather than guess which. */
 | {
    ok: false;
    reason: 'ambiguous';
    candidates: string[];
};
/**
 * Find exactly one guild member matching a typed name.
 *
 * Discord's search does prefix matching across username and nickname, so it
 * returns candidates rather than an answer — the disambiguation below is ours.
 * Tiers are tried strongest-first, and a tier with several hits is reported
 * ambiguous instead of falling through to a weaker one: if two people are both
 * *exactly* "cienszki", picking the one whose username also happens to prefix-
 * match would be an arbitrary guess with someone else's stats attached.
 */
export declare function findGuildMember(cfg: DiscordLookupConfig, query: string): Promise<DiscordLookupResult>;
