// src/lib/server-utils.ts
'use server';

import { communityProfile, STEAM_KEY_MESSAGE, steamKeyRejected } from './steam-community';

/**
 * Resolves a Steam vanity URL to a Steam64 ID: the official Steam Web API (STEAM_API_KEY, server-only),
 * then the public profile page, which needs no key.
 * 
 * @param vanityName The custom part of the vanity URL (e.g., "Rhasnethtzent").
 * @returns A promise that resolves to the user's 64-bit Steam ID as a string.
 * @throws An error if no profile has this name.
 */
async function resolveSteamVanityURL(vanityName: string): Promise<string> {
    const apiKey = process.env.STEAM_API_KEY;
    if (apiKey) {
        try {
            const response = await fetch(`https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${apiKey}&vanityurl=${encodeURIComponent(vanityName)}&url_type=1`);
            if (response.ok) {
                const data = await response.json();
                if (data.response?.success === 1 && data.response?.steamid) return data.response.steamid;
            } else if (steamKeyRejected(response.status)) {
                console.error(`[resolveSteamVanityURL] ${STEAM_KEY_MESSAGE}`);
            }
        } catch (error) {
            console.warn("[resolveSteamVanityURL] Steam API failed:", (error as Error).message);
        }
    }
    // The public profile page needs no key
    const profile = await communityProfile({ vanity: vanityName });
    if (profile) return profile.steamId64;
    throw new Error(`Nie znaleziono profilu Steam „${vanityName}”. Sprawdź link do profilu.`);
}

/**
 * Extracts the Steam64 ID from a Steam profile URL.
 * Handles both standard profile URLs and custom vanity URLs.
 *
 * @param url The Steam profile URL.
 * @returns A promise that resolves to the 64-bit Steam ID as a string.
 * @throws An error if the URL is invalid or cannot be resolved.
 */
export async function getSteam64IdFromUrl(url: string): Promise<string> {
    const vanityMatch = url.match(/steamcommunity\.com\/id\/([^/]+)/);
    const profileMatch = url.match(/steamcommunity\.com\/profiles\/(\d+)/);

    if (profileMatch) {
        return profileMatch[1];
    } else if (vanityMatch) {
        const vanityName = vanityMatch[1].replace(/\/$/, '');
        return await resolveSteamVanityURL(vanityName);
    } else {
        throw new Error("Invalid Steam profile URL format.");
    }
}

/**
 * Fetches a player's Steam summary, including various avatar sizes.
 *
 * @param steamId The player's 64-bit Steam ID.
 * @returns A promise that resolves to the player's summary object from the Steam API.
 * @throws An error if the summary cannot be fetched.
 */
export async function getSteamPlayerSummary(steamId: string): Promise<any> {
    const apiKey = process.env.STEAM_API_KEY;
    if (apiKey) {
        try {
            const response = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamId}`);
            if (response.ok) {
                const player = (await response.json()).response?.players?.[0];
                if (player) return player;
            } else if (steamKeyRejected(response.status)) {
                console.error(`[getSteamPlayerSummary] ${STEAM_KEY_MESSAGE}`);
            }
        } catch (error) {
            console.warn("[getSteamPlayerSummary] Steam API failed:", (error as Error).message);
        }
    }
    // The public profile page, in the API's shape
    const p = await communityProfile({ steamId64: steamId });
    if (!p) throw new Error("Nie znaleziono profilu Steam.");
    return { steamid: p.steamId64, personaname: p.name, avatar: p.avatar, avatarmedium: p.avatarMedium, avatarfull: p.avatarFull, profileurl: `https://steamcommunity.com/profiles/${p.steamId64}` };
}

/**
 * Converts a Steam profile URL into an OpenDota Account ID (Steam32 ID) with high reliability.
 * It uses the official Steam API for vanity URLs to ensure accuracy.
 *
 * @param url The Steam profile URL.
 * @returns A promise that resolves to the numeric OpenDota Account ID.
 * @throws An error if the URL is invalid or the player cannot be found.
 */
export async function getOpenDotaAccountIdFromUrl(url: string): Promise<number> {
  const steam64Id = await getSteam64IdFromUrl(url);
  const steam32Id = Number(BigInt(steam64Id) - 76561197960265728n);
  return steam32Id;
}
