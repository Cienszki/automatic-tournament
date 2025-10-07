"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Fallback component when Three.js is not available
export default function Simple3DTest() {
  return (
    <Card className="w-full h-96 flex items-center justify-center">
      <CardContent className="text-center">
        <CardTitle className="mb-4">Simple 3D Test</CardTitle>
        <p className="text-muted-foreground">
          3D visualization temporarily disabled for deployment compatibility.
        </p>
      </CardContent>
    </Card>
  );
}