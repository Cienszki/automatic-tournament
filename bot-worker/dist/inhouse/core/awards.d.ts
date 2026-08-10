/**
 * Award definitions, evaluated against OpenDota's parsed match data.
 *
 * Hard rule: **never awarded for good play.** Every entry here is either
 * self-deprecating or neutral. The pool is large and rotating so nobody can
 * farm one, and `selectAwards` never emits the same award twice in a match.
 *
 * `extract` returns the metric value for a player, or null when the data isn't
 * present (OpenDota only fills many of these once the replay is parsed).
 */
export interface AwardDefinition {
    id: string;
    emoji: string;
    /** Higher value wins the award, unless `lowest` is set. */
    lowest?: boolean;
    /** Ignore candidates below this value, so nobody "wins" with a 0. */
    minimum: number;
    extract: (player: Record<string, unknown>) => number | null;
    render: (name: string, value: number) => string;
}
export declare const AWARDS: readonly AwardDefinition[];
export interface Award {
    id: string;
    steamId32: string;
    text: string;
}
/**
 * Pick up to `limit` awards for a finished match.
 *
 * Each award goes to at most one player and each player wins at most one award,
 * so a single dominant performance can't sweep the recap. Award order is
 * randomised so the same ones don't always appear first.
 */
export declare function selectAwards(players: Array<{
    steamId32: string;
    name: string;
    data: Record<string, unknown>;
}>, limit?: number): Award[];
