// src/lib/stats-service-simple.ts

import { writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { recalculateBasicTournamentStats } from '@/lib/stats-calculator-basic';

/**
 * Recalculate all tournament statistics
 */
export async function recalculateAllStats(): Promise<void> {
  console.log('Starting comprehensive stats recalculation...');
  
  try {
    await recalculateBasicTournamentStats();
    console.log('Stats recalculation completed successfully');
  } catch (error) {
    console.error('Error during stats recalculation:', error);
    throw error;
  }
}

/**
 * Update stats after a match is imported or deleted
 */
export async function updateStatsAfterMatchChange(matchId: string): Promise<void> {
  console.log(`Updating stats after match change: ${matchId}`);
  
  try {
    // For now, recalculate all stats when any match changes
    await recalculateAllStats();
  } catch (error) {
    console.error('Error updating stats after match change:', error);
    throw error;
  }
}
