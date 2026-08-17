import { ActionRowBuilder, ButtonBuilder, EmbedBuilder } from 'discord.js';
import type { InhouseGame } from '../inhouse/core/types';
export declare const IDS: {
    readonly newGame: "ih:new";
    readonly newPublic: "ih:new:public";
    readonly newPrivate: "ih:new:private";
    readonly newCancel: "ih:new:cancel";
    readonly link: "ih:link";
    /** "I'll paste the URL myself" — the only path that may open the modal. */
    readonly linkManual: "ih:link:manual";
    readonly linkModal: "ih:link:modal";
    readonly linkInput: "ih:link:steam";
    readonly unlinkConfirm: "ih:unlink:confirm";
    /** Suffixed with the game id. */
    readonly join: "ih:join:";
    readonly invite: "ih:invite:";
};
export declare function gameModeLabel(mode: number): string;
export declare function serverRegionLabel(region: number): string;
/**
 * Ten slots, at a glance.
 *
 * Seated players, held slots and free slots are three different things and the
 * website's lobby ring already draws them as three colours — this is the same
 * information in the one rendering Discord can do everywhere, on every client,
 * with no image to generate.
 */
export declare function slotBar(seated: number, reserved: number): string;
export interface CardModel {
    game: InhouseGame;
    /** Display names of everyone on a playing slot, in join order. */
    players: string[];
    seated: number;
    reserved: number;
}
/** The lobby card: the same facts as the website's card, in Discord's shapes. */
export declare function lobbyCardEmbed(model: CardModel): EmbedBuilder;
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
export declare function lobbyCardComponents(game: InhouseGame): ActionRowBuilder<ButtonBuilder>[];
/**
 * The permanent message at the top of the channel.
 *
 * The artwork and the footer logo are served by the website rather than
 * uploaded as attachments: the poster is *edited* on every boot to keep its id
 * (and therefore its pin), and an edit that drops `files` drops the attachment
 * with it. A URL survives every edit and costs the deploy nothing — which
 * matters here, because only `dist/` ships to Railway.
 */
export declare function posterEmbed(siteUrl: string): EmbedBuilder;
export declare function posterComponents(siteUrl: string): ActionRowBuilder<ButtonBuilder>[];
export declare function rankingEmbed(ranking: {
    gamesPlayed: Array<{
        name: string;
        value: number;
    }>;
    gamesPublished: Array<{
        name: string;
        value: number;
    }>;
    playerOfWeek: {
        name: string;
        gamesThisWeek: number;
    } | null;
}): EmbedBuilder;
/**
 * The five names Discord can fit are the top of a much longer board — the
 * button is how anyone who is not in the top five finds themselves.
 */
export declare function rankingComponents(siteUrl: string): ActionRowBuilder<ButtonBuilder>[];
export declare function medalsEmbed(displayName: string, data: {
    name: string | null;
    gamesPlayed: number;
    medals: Array<{
        label: string;
        place: 1 | 2 | 3 | null;
        summary: string;
    }>;
}): EmbedBuilder;
