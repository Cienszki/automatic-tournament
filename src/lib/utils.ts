
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
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
