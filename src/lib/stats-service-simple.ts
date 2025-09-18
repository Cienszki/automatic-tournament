// src/lib/stats-service-simple.ts

import { writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { recalculateBasicTournamentStats } from '@/lib/stats-calculator-basic';

/**
 * Recalculate all tournament statistics using comprehensive calculator
 */
export async function recalculateAllStats(): Promise<void> {
  console.log('🚀 Starting comprehensive stats recalculation...');
  
  try {
    // Import and use the comprehensive stats calculator
    console.log('📊 Using comprehensive stats calculator...');
    const { calculateAllComprehensiveStats } = await import('./comprehensive-stats-calculator');
    await calculateAllComprehensiveStats();
    
    console.log('✅ Comprehensive stats recalculation completed successfully!');
  } catch (error) {
    console.error('❌ Error during comprehensive stats recalculation:', error);
    console.error('Falling back to basic stats calculator...');
    
    try {
      await recalculateBasicTournamentStats();
      console.log('✅ Basic stats recalculation completed successfully');
    } catch (fallbackError) {
      console.error('❌ Both comprehensive and basic stats calculations failed:', fallbackError);
      throw fallbackError;
    }
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
