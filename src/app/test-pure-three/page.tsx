"use client";

import React from 'react';
import PureThreeLeaderboards from '@/components/fantasy/PureThreeLeaderboards';

// Mock data for testing
const mockLeaderboards = {
  overall: [
    {
      userId: "1",
      displayName: "Valais",
      averageScore: 95.24,
      gamesPlayed: 18,
      rank: 1,
      currentLineup: {}
    },
    {
      userId: "2", 
      displayName: "Joxxi",
      averageScore: 93.17,
      gamesPlayed: 25,
      rank: 2,
      currentLineup: {}
    },
    {
      userId: "3",
      displayName: "BeBoy",
      averageScore: 92.97,
      gamesPlayed: 30,
      rank: 3,
      currentLineup: {}
    }
  ],
  byRole: {
    'Carry': [
      { playerId: "p1", nickname: "TestCarry", teamName: "Team A", averageScore: 120.5, totalMatches: 10, rank: 1 }
    ],
    'Mid': [
      { playerId: "p2", nickname: "TestMid", teamName: "Team B", averageScore: 115.2, totalMatches: 12, rank: 1 }
    ],
    'Offlane': [],
    'Soft Support': [],
    'Hard Support': []
  }
};

export default function TestPureThreePage() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold text-center mb-8">Pure Three.js Fantasy Test</h1>
      <PureThreeLeaderboards leaderboards={mockLeaderboards} />
    </div>
  );
}