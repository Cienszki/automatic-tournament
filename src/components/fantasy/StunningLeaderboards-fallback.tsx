"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Fallback component when Three.js is not available
export default function StunningLeaderboards({ leaderboards }: { leaderboards: any }) {
  return (
    <Card className="w-full h-96 flex items-center justify-center">
      <CardContent className="text-center">
        <CardTitle className="mb-4">Stunning 3D Leaderboards</CardTitle>
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