
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Player, PlayerRole } from "./definitions";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const roleOrder: Record<PlayerRole, number> = {
  "Carry": 1,
  "Mid": 2,
  "Offlane": 3,
  "Soft Support": 4,
  "Hard Support": 5,
};

/**
 * Sorts an array of players based on their role in a predefined order.
 * @param players - The array of players to sort.
 * @returns A new array of players sorted by role.
 */
export function sortPlayersByRole(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    const orderA = roleOrder[a.role] ?? 99;
    const orderB = roleOrder[b.role] ?? 99;
    return orderA - orderB;
  });
}

/**
 * Formats a number with commas as thousands separators.
 * Provides consistent formatting between server and client to prevent hydration errors.
 * @param num - The number to format.
 * @returns A string with the number formatted with commas.
 */
export function formatNumber(num: number): string {
  if (num === undefined || num === null || isNaN(num)) {
    return 'N/A';
  }
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export async function getSteamAvatarUrl(steamProfileUrl: string): Promise<string | null> {
  // Simple implementation - extract Steam ID and return a placeholder
  // In a real implementation, you'd call Steam API
  try {
    // Extract Steam ID from URL like https://steamcommunity.com/profiles/76561198123456789
    const match = steamProfileUrl.match(/\/profiles\/(\d+)/);
    if (match) {
      return `https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg`;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Formats a date string in Polish locale format (e.g., "15 sty 2026, 18:00")
 * @param dateString - ISO date string or Date object
 * @returns Formatted date string in Polish
 */
export function formatDatePL(dateString: string | Date): string {
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;

    if (isNaN(date.getTime())) {
      return 'Nieprawidłowa data';
    }

    return date.toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Nieprawidłowa data';
  }
}

/**
 * "21.10.2026, 18:00" — 24-hour, no seconds. In the browser's time zone, unless `timeZone` is
 * given: code running on the server (UTC on Vercel) passes 'Europe/Warsaw', or admins would read
 * UTC times back in toasts and errors.
 */
export function formatDateTimePL(value: string | Date, timeZone?: string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return 'Nieprawidłowa data';
  return date.toLocaleString('pl-PL', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    ...(timeZone ? { timeZone } : {}),
  });
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** ISO time → 'yyyy-mm-ddTHH:mm' in the browser's local time (the DateTimeInput value); '' when unset */
export function isoToLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 'yyyy-mm-dd' of a moment in the browser's local time (toISOString() would give the UTC day) */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
