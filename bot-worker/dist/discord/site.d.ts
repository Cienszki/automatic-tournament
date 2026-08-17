import type { GatewayConfig } from './config';
export type CreateResult = 
/** Credentials travel with the response so a private lobby's host has something to send their friends. */
{
    status: 'ok';
    gameId: string;
    lobbyName?: string | null;
    lobbyPassword?: string | null;
} | {
    status: 'banned';
} | {
    status: 'no_bots';
} | {
    status: 'too_many_open';
    max: number;
} | {
    status: 'unavailable';
} | {
    status: 'error';
};
export type JoinResult = {
    status: 'needs_link';
} | {
    status: 'unavailable';
} | {
    status: 'banned';
} | {
    status: 'not_open';
} | {
    status: 'locked';
} | {
    status: 'error';
} | {
    status: 'waitlisted';
    position: number;
} | {
    status: 'reserved' | 'already_reserved' | 'in_lobby';
    password: string | null;
    lobbyName: string | null;
    expiresAt: string | null;
    slotsOpen: number | null;
};
export type JoinInfo = {
    status: 'unavailable' | 'not_found' | 'not_open' | 'banned';
} | {
    status: 'ok';
    lobbyName: string | null;
    password: string | null;
    gameMode: number;
    serverRegion: number;
    canBeInvited: boolean;
    hasSteam: boolean;
    hasDiscord: boolean;
    name: string | null;
};
export type LinkOutcome = {
    status: 'linked';
    steamId32: string;
    gamesFound: number;
    total: number;
} | {
    status: 'already_linked';
    steamId32: string;
} | {
    status: 'claimed_by_other';
} | {
    status: 'unrecognised' | 'vanity_not_found' | 'lookup_failed';
} | {
    status: 'error';
};
export type LinkSource = 'discord_connection' | 'steam_openid' | 'lobby_code' | 'manual';
export interface IdentityState {
    linked: boolean;
    steamIds: string[];
    steamId32: string | null;
    discordName: string | null;
    gamesPlayed: number;
    /** How the first account was linked — null on older records. */
    linkSource: LinkSource | null;
}
export interface LeaderRow {
    discordId: string;
    name: string;
    value: number;
}
export interface Ranking {
    gamesPlayed: LeaderRow[];
    gamesPublished: LeaderRow[];
    playerOfWeek: {
        name: string;
        gamesThisWeek: number;
    } | null;
}
export type MedalsResult = {
    status: 'not_linked';
} | {
    status: 'ok';
    name: string | null;
    gamesPlayed: number;
    medals: Array<{
        id: string;
        label: string;
        place: 1 | 2 | 3 | null;
        summary: string;
    }>;
};
export declare class SiteClient {
    private config;
    constructor(config: GatewayConfig);
    private call;
    openLobby(opts: {
        discordId: string;
        discordName: string | null;
        published: boolean;
    }): Promise<CreateResult>;
    joinInfo(gameId: string, discordId: string, discordName: string | null): Promise<JoinInfo>;
    join(gameId: string, discordId: string, discordName: string | null): Promise<JoinResult>;
    link(discordId: string, discordName: string | null, steam: string): Promise<LinkOutcome>;
    unlink(discordId: string): Promise<{
        status: 'unlinked' | 'nothing_linked';
        removed: string[];
    } | null>;
    identity(discordId: string): Promise<IdentityState | null>;
    ranking(): Promise<Ranking | null>;
    medals(discordId: string): Promise<MedalsResult | null>;
}
