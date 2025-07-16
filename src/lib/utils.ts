// src/lib/utils.ts

import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


/**
 * Resolves a Steam vanity URL to a Steam64 ID using the official Steam Web API.
 * This is the most reliable method for resolving custom URLs.
 * REQUIRES a STEAM_API_KEY environment variable to be set.
 * 
 * @param vanityName The custom part of the vanity URL (e.g., "Rhasnethtzent").
 * @returns A promise that resolves to the user's 64-bit Steam ID as a string.
 * @throws An error if the API key is missing or the vanity name cannot be resolved.
 */
async function resolveSteamVanityURL(vanityName: string): Promise<string> {
    const apiKey = process.env.STEAM_API_KEY;
    if (!apiKey) {
        throw new Error("STEAM_API_KEY environment variable is not set. This is required to resolve vanity URLs.");
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
 * Converts a Steam profile URL into an OpenDota Account ID (Steam32 ID) with high reliability.
 * It uses the official Steam API for vanity URLs to ensure accuracy.
 *
 * @param url The Steam profile URL.
 * @returns A promise that resolves to the numeric OpenDota Account ID.
 * @throws An error if the URL is invalid or the player cannot be found.
 */
export async function getOpenDotaAccountIdFromUrl(url: string): Promise<number> {
  const vanityMatch = url.match(/steamcommunity\.com\/id\/([^/]+)/);
  const profileMatch = url.match(/steamcommunity\.com\/profiles\/(\d+)/);

  let steam64Id: bigint;

  if (profileMatch) {
    // This is a standard URL containing the Steam64 ID.
    steam64Id = BigInt(profileMatch[1]);
  } else if (vanityMatch) {
    // This is a custom URL. Resolve it using the reliable Steam API.
    const vanityName = vanityMatch[1].replace(/\/$/, ''); // Remove trailing slash if present
    const resolvedSteam64Id = await resolveSteamVanityURL(vanityName);
    steam64Id = BigInt(resolvedSteam64Id);
  } else {
    throw new Error("Invalid Steam profile URL format. Must be a standard profile or vanity URL.");
  }

  // Convert the authoritative Steam64 ID to the Steam32 ID that OpenDota uses.
  const steam32Id = Number(steam64Id - 76561197960265728n);
  return steam32Id;
}
