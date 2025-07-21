// src/lib/server-utils.ts
'use server';

/**
 * Resolves a Steam vanity URL to a Steam64 ID using the official Steam Web API.
 * This is the most reliable method for resolving custom URLs.
 * REQUIRES a NEXT_PUBLIC_STEAM_API_KEY environment variable to be set.
 * 
 * @param vanityName The custom part of the vanity URL (e.g., "Rhasnethtzent").
 * @returns A promise that resolves to the user's 64-bit Steam ID as a string.
 * @throws An error if the API key is missing or the vanity name cannot be resolved.
 */
async function resolveSteamVanityURL(vanityName: string): Promise<string> {
    const apiKey = process.env.NEXT_PUBLIC_STEAM_API_KEY;
    if (!apiKey) {
        throw new Error("NEXT_PUBLIC_STEAM_API_KEY environment variable is not set. This is required to resolve vanity URLs.");
    }

    const url = `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${apiKey}&vanityurl=${vanityName}&url_type=1`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Steam API request failed with status: ${response.status}`);
        }

        const data = await response.json();
        if (data.response.success === 1) {
            return data.response.steamid;
        } else {
            throw new Error(`Could not resolve Steam vanity URL: ${vanityName}. The profile may not exist or the vanity URL is incorrect.`);
        }
    } catch (error) {
        console.error("Error calling Steam API:", error);
        throw error; // Re-throw the error to be handled by the caller
    }
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
    const apiKey = process.env.NEXT_PUBLIC_STEAM_API_KEY;
    if (!apiKey) {
        throw new Error("NEXT_PUBLIC_STEAM_API_KEY environment variable is not set.");
    }

    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamId}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Steam API request failed with status: ${response.status}`);
        }

        const data = await response.json();
        const player = data.response.players[0];
        
        if (player) {
            return player;
        } else {
            throw new Error("Could not find player summary in Steam API response.");
        }
    } catch (error) {
        console.error("Error fetching Steam player summary:", error);
        throw error;
    }
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
