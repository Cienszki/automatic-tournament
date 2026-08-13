// src/discord/site.ts
//
// The website's bot API, as a typed client.
//
// Every action a button performs — opening a lobby, joining one, linking a
// Steam account — is an HTTP call to the site rather than a Firestore write
// made here. That is the whole design: the open-lobby cap, the lobby-name
// table, the reservation transaction, the waitlist and the Steam invite are
// implemented once, on the website, and Discord is a second face on the same
// code. A gateway that wrote Firestore directly would be a second
// implementation of rules that are already subtle, and it would drift.
//
// See the website's src/app/api/inhouse/bot/* for the other end.

import { logger } from '../logger';
import type { GatewayConfig } from './config';

const REQUEST_TIMEOUT_MS = 15_000;

export type CreateResult =
  /** Credentials travel with the response so a private lobby's host has something to send their friends. */
  | { status: 'ok'; gameId: string; lobbyName?: string | null; lobbyPassword?: string | null }
  | { status: 'banned' }
  | { status: 'no_bots' }
  | { status: 'too_many_open'; max: number }
  | { status: 'unavailable' }
  | { status: 'error' };

export type JoinResult =
  | { status: 'needs_link' }
  | { status: 'unavailable' }
  | { status: 'banned' }
  | { status: 'not_open' }
  | { status: 'locked' }
  | { status: 'error' }
  | { status: 'waitlisted'; position: number }
  | {
      status: 'reserved' | 'already_reserved' | 'in_lobby';
      password: string | null;
      lobbyName: string | null;
      expiresAt: string | null;
      slotsOpen: number | null;
    };

export type JoinInfo =
  | { status: 'unavailable' | 'not_found' | 'not_open' | 'banned' }
  | {
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

export type LinkOutcome =
  | { status: 'linked'; steamId32: string; gamesFound: number; total: number }
  | { status: 'already_linked'; steamId32: string }
  | { status: 'claimed_by_other' }
  | { status: 'unrecognised' | 'vanity_not_found' | 'lookup_failed' }
  | { status: 'error' };

export interface IdentityState {
  linked: boolean;
  steamIds: string[];
  steamId32: string | null;
  discordName: string | null;
  gamesPlayed: number;
}

export interface LeaderRow {
  discordId: string;
  name: string;
  value: number;
}

export interface Ranking {
  gamesPlayed: LeaderRow[];
  gamesPublished: LeaderRow[];
  playerOfWeek: { name: string; gamesThisWeek: number } | null;
}

export type MedalsResult =
  | { status: 'not_linked' }
  | {
      status: 'ok';
      name: string | null;
      gamesPlayed: number;
      medals: Array<{ id: string; label: string; place: 1 | 2 | 3 | null; summary: string }>;
    };

export class SiteClient {
  constructor(private config: GatewayConfig) {}

  private async call<T>(path: string, init: RequestInit): Promise<T | null> {
    const url = `${this.config.siteUrl}${path}`;
    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.siteSecret}`,
          ...(init.headers ?? {}),
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        logger.error(`[Discord] ${init.method ?? 'GET'} ${path} → ${response.status}`);
        return null;
      }
      return (await response.json()) as T;
    } catch (error) {
      logger.error(`[Discord] ${init.method ?? 'GET'} ${path} failed`, error);
      return null;
    }
  }

  async openLobby(opts: {
    discordId: string;
    discordName: string | null;
    published: boolean;
  }): Promise<CreateResult> {
    const result = await this.call<CreateResult>('/api/inhouse/bot/lobby', {
      method: 'POST',
      body: JSON.stringify({ ...opts, newcomerFriendly: false }),
    });
    return result ?? { status: 'error' };
  }

  async joinInfo(gameId: string, discordId: string, discordName: string | null): Promise<JoinInfo> {
    const params = new URLSearchParams({ gameId, discordId });
    if (discordName) params.set('discordName', discordName);
    const result = await this.call<JoinInfo>(`/api/inhouse/bot/join?${params}`, { method: 'GET' });
    return result ?? { status: 'unavailable' };
  }

  async join(gameId: string, discordId: string, discordName: string | null): Promise<JoinResult> {
    const result = await this.call<JoinResult>('/api/inhouse/bot/join', {
      method: 'POST',
      body: JSON.stringify({ gameId, discordId, discordName }),
    });
    return result ?? { status: 'error' };
  }

  async link(discordId: string, discordName: string | null, steam: string): Promise<LinkOutcome> {
    const result = await this.call<LinkOutcome>('/api/inhouse/bot/identity', {
      method: 'POST',
      body: JSON.stringify({ action: 'link', discordId, discordName, steam }),
    });
    return result ?? { status: 'error' };
  }

  async unlink(discordId: string): Promise<{ status: 'unlinked' | 'nothing_linked'; removed: string[] } | null> {
    return this.call('/api/inhouse/bot/identity', {
      method: 'POST',
      body: JSON.stringify({ action: 'unlink', discordId }),
    });
  }

  async identity(discordId: string): Promise<IdentityState | null> {
    return this.call<IdentityState>(
      `/api/inhouse/bot/identity?discordId=${encodeURIComponent(discordId)}`,
      { method: 'GET' }
    );
  }

  async ranking(): Promise<Ranking | null> {
    return this.call<Ranking>('/api/inhouse/bot/stats?view=ranking', { method: 'GET' });
  }

  async medals(discordId: string): Promise<MedalsResult | null> {
    return this.call<MedalsResult>(
      `/api/inhouse/bot/stats?view=medals&discordId=${encodeURIComponent(discordId)}`,
      { method: 'GET' }
    );
  }
}
