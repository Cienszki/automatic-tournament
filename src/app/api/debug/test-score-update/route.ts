// @ts-nocheck
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Test updating the match score to trigger standings update
    const { updateMatchScores } = await import('@/lib/firestore');
    
    // Update the existing completed match score to the same values to trigger standings update
    await updateMatchScores("P5B0D7exIWyO0wDP9ml2", 1, 2);
    
    return NextResponse.json({
      success: true,
      message: "Match score updated, standings should be triggered"
    });
  } catch (error) {
    console.error('Error updating match score:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update match score' },
      { status: 500 }
    );
  }
}
