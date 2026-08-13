import { ActionRowBuilder, ButtonBuilder, EmbedBuilder } from 'discord.js';
import type { InhouseGame } from '../inhouse/core/types';
export declare const IDS: {
    readonly newGame: "ih:new";
    readonly newPublic: "ih:new:public";
    readonly newPrivate: "ih:new:private";
    readonly link: "ih:link";
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
 * The join button, and only while joining is possible.
 *
 * It disappears the moment the match starts rather than failing on press: a
 * button that is there but always says no is worse than no button.
 */
export declare function lobbyCardComponents(game: InhouseGame): ActionRowBuilder<ButtonBuilder>[];
/** The permanent message at the top of the channel. */
export declare function posterEmbed(): EmbedBuilder;
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
export declare function medalsEmbed(displayName: string, data: {
    name: string | null;
    gamesPlayed: number;
    medals: Array<{
        label: string;
        place: 1 | 2 | 3 | null;
        summary: string;
    }>;
}): EmbedBuilder;
