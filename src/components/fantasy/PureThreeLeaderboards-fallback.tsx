"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface LeaderboardData {
  overall: Array<{
    userId: string;
    displayName?: string;
    totalScore: number;
  }>;
  [key: string]: any;
}

// Fallback component when Three.js is not available
export default function PureThreeLeaderboards({ leaderboards }: { leaderboards: LeaderboardData }) {
  return (
    <Card className="w-full h-96 flex items-center justify-center">
      <CardContent className="text-center">
        <CardTitle className="mb-4">Pure Three.js Leaderboards</CardTitle>
        <p className="text-muted-foreground">
          3D visualization temporarily disabled for deployment compatibility.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Use the regular leaderboards view to see fantasy scores.
        </p>
      </CardContent>
    </Card>
  );
}