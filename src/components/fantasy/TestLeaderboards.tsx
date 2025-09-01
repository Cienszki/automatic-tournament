"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface LeaderboardData {
  overall: Array<{
    userId: string;
    displayName: string;
    averageScore: number;
    gamesPlayed: number;
    rank: number;
    currentLineup?: any;
  }>;
  byRole: any;
}

export default function TestLeaderboards({ leaderboards }: { leaderboards: LeaderboardData }) {
  return (
    <Card className="w-full shadow-2xl">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl">Test Leaderboards</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center">
          <p className="text-green-600 text-xl">✅ Test leaderboards component loaded!</p>
          <p className="text-gray-600 mb-4">Found {leaderboards.overall.length} overall players</p>
          
          <div className="space-y-2">
            {leaderboards.overall.slice(0, 3).map((player, index) => (
              <div key={player.userId} className="p-3 border rounded">
                <strong>#{index + 1}</strong> {player.displayName} - {player.averageScore.toFixed(1)} pts
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}