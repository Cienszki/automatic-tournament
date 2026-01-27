// src/lib/steam-id-utils.ts
// Utilities for extracting and converting Steam IDs from profile URLs

/**
 * Steam ID formats:
 * - Steam64: 76561198XXXXXXXXX (17 digits, starts with 76561198)
 * - Steam32: XXXXXXXXX (9-10 digits, used by OpenDota)
 * - Steam3: [U:1:XXXXXXXXX]
 */

const STEAM_ID_64_BASE = 76561197960265728n;

/**
 * Convert Steam64 ID to Steam32 ID
 * Steam32 = Steam64 - 76561197960265728
 */
export function steam64ToSteam32(steam64: string): string {
    try {
        const steam64BigInt = BigInt(steam64);
        const steam32 = steam64BigInt - STEAM_ID_64_BASE;
        return steam32.toString();
    } catch (error) {
        throw new Error(`Invalid Steam64 ID: ${steam64}`);
    }
}

/**
 * Convert Steam32 ID to Steam64 ID
 * Steam64 = Steam32 + 76561197960265728
 */
export function steam32ToSteam64(steam32: string): string {
    try {
        const steam32BigInt = BigInt(steam32);
        const steam64 = steam32BigInt + STEAM_ID_64_BASE;
        return steam64.toString();
    } catch (error) {
        throw new Error(`Invalid Steam32 ID: ${steam32}`);
    }
}

/**
 * Extract Steam64 ID from a Steam profile URL
 * Supports:
 * - https://steamcommunity.com/profiles/76561198XXXXXXXXX
 * - https://steamcommunity.com/id/customurl
 */
export async function extractSteamIdFromUrl(
    profileUrl: string
): Promise<{
    steamId64: string;
    steamId32: string;
    customUrl?: string;
}> {
    // Validate URL format
    if (!profileUrl.includes('steamcommunity.com')) {
        throw new Error('Invalid Steam profile URL - must be a steamcommunity.com URL');
    }

    // Case 1: Direct Steam64 ID in URL (profiles/76561198...)
    const profileMatch = profileUrl.match(/\/profiles\/(\d{17})/);
    if (profileMatch) {
        const steam64 = profileMatch[1];

        // Validate it looks like a Steam64 ID (starts with 7656119x)
        if (!steam64.startsWith('7656119')) {
            throw new Error('Invalid Steam64 ID format');
        }

        const steamId32 = steam64ToSteam32(steam64);
        return { steamId64: steam64, steamId32 };
    }

    // Case 2: Custom URL (id/customname) - needs API resolution
    const customUrlMatch = profileUrl.match(/\/id\/([^\/\?]+)/);
    if (customUrlMatch) {
        const customUrl = customUrlMatch[1];

        // Try to resolve via Steam Web API
        const steamId64 = await resolveSteamCustomUrl(customUrl);
        const steamId32 = steam64ToSteam32(steamId64);

        return { steamId64, steamId32, customUrl };
    }

    throw new Error('Could not extract Steam ID from URL - invalid format');
}

/**
 * Resolve a custom Steam URL to Steam64 ID using Steam Web API
 */
async function resolveSteamCustomUrl(customUrl: string): Promise<string> {
    // Check for environment variable - use the same one as server-utils.ts for consistency
    const apiKey = process.env.NEXT_PUBLIC_STEAM_API_KEY || process.env.STEAM_API_KEY;

    if (!apiKey) {
        throw new Error('NEXT_PUBLIC_STEAM_API_KEY not configured - cannot resolve custom Steam URLs');
    }

    // Use v1 endpoint with url_type=1 as in server-utils.ts - this is more reliable
    const url = `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${apiKey}&vanityurl=${customUrl}&url_type=1`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Steam API request failed with status: ${response.status}`);
        }
        const data = await response.json();

        if (data.response?.success === 1 && data.response?.steamid) {
            return data.response.steamid;
        } else {
            throw new Error(`Failed to resolve custom URL "${customUrl}" - profile may not exist or be private`);
        }
    } catch (error) {
        throw new Error(`Steam API error while resolving custom URL: ${(error as Error).message}`);
    }
}

/**
 * Fetch Steam profile data (avatar, persona name) using Steam Web API
 */
export async function fetchSteamProfile(steam64: string): Promise<{
    personaname: string;
    avatar: string;
    avatarmedium: string;
    avatarfull: string;
    profileurl: string;
}> {
    const apiKey = process.env.STEAM_API_KEY || process.env.NEXT_PUBLIC_STEAM_API_KEY;

    if (!apiKey) {
        console.warn('STEAM_API_KEY not configured - returning basic profile data');
        return {
            personaname: 'Unknown',
            avatar: '',
            avatarmedium: '',
            avatarfull: '',
            profileurl: `https://steamcommunity.com/profiles/${steam64}`,
        };
    }

    const url = `http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steam64}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.response?.players?.[0]) {
            const player = data.response.players[0];
            return {
                personaname: player.personaname || 'Unknown',
                avatar: player.avatar || '',
                avatarmedium: player.avatarmedium || '',
                avatarfull: player.avatarfull || '',
                profileurl: player.profileurl || `https://steamcommunity.com/profiles/${steam64}`,
            };
        } else {
            throw new Error('Profile not found or is private');
        }
    } catch (error) {
        console.error('Error fetching Steam profile:', error);
        // Return fallback data instead of throwing
        return {
            personaname: 'Unknown',
            avatar: '',
            avatarmedium: '',
            avatarfull: '',
            profileurl: `https://steamcommunity.com/profiles/${steam64}`,
        };
    }
}

/**
 * Validate and extract Steam IDs from player data
 * Used during team registration
 */
export async function processPlayerSteamUrls(
    players: Array<{ nickname: string; steamProfileUrl: string; role: string }>
): Promise<Array<{
    nickname: string;
    role: string;
    steamProfileUrl: string;
    steamId64: string;
    steamId32: string;
    avatar?: string;
    avatarmedium?: string;
    avatarfull?: string;
    personaname?: string;
}>> {
    const results = [];

    for (const player of players) {
        try {
            // Extract Steam IDs
            const { steamId64, steamId32 } = await extractSteamIdFromUrl(player.steamProfileUrl);

            // Fetch profile data (optional, for avatar/name)
            let profileData;
            try {
                profileData = await fetchSteamProfile(steamId64);
            } catch (error) {
                console.warn(`Could not fetch profile for ${player.nickname}:`, error);
            }

            results.push({
                nickname: player.nickname,
                role: player.role,
                steamProfileUrl: player.steamProfileUrl,
                steamId64,
                steamId32,
                avatar: profileData?.avatar,
                avatarmedium: profileData?.avatarmedium,
                avatarfull: profileData?.avatarfull,
                personaname: profileData?.personaname,
            });

            // Small delay to respect API rate limits
            await new Promise(resolve => setTimeout(resolve, 300));

        } catch (error) {
            throw new Error(`Failed to process Steam profile for ${player.nickname}: ${(error as Error).message}`);
        }
    }

    return results;
}

/**
 * Check for duplicate Steam IDs across players
 */
export function checkDuplicateSteamIds(
    players: Array<{ steamId32: string; nickname: string }>
): { hasDuplicates: boolean; duplicates: string[] } {
    const steamIds = new Set<string>();
    const duplicates: string[] = [];

    for (const player of players) {
        if (steamIds.has(player.steamId32)) {
            duplicates.push(player.nickname);
        } else {
            steamIds.add(player.steamId32);
        }
    }

    return {
        hasDuplicates: duplicates.length > 0,
        duplicates,
    };
}
