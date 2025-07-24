"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TEAM_MMR_CAP } from "@/lib/definitions";
import { cn } from "@/lib/utils";
import { Calculator } from "lucide-react";

export function MMRCalculator() {
  const [playerMMRs, setPlayerMMRs] = React.useState<number[]>(Array(5).fill(0));

  const handleMMRChange = (index: number, value: string) => {
    const newMMRs = [...playerMMRs];
    newMMRs[index] = Number(value) || 0;
    setPlayerMMRs(newMMRs);
  };

  const totalMMR = playerMMRs.reduce((sum, mmr) => sum + mmr, 0);
  const isOverCap = totalMMR > TEAM_MMR_CAP;

  return (
    <Card className="mt-6 shadow-md border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center text-accent">
          <Calculator className="h-6 w-6 mr-2" />
          MMR Cap Calculator
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {playerMMRs.map((mmr, index) => (
            <div key={index} className="space-y-2">
              <Label htmlFor={`player-${index + 1}-mmr`}>Player {index + 1}</Label>
              <Input
                id={`player-${index + 1}-mmr`}
                type="number"
                placeholder="Enter MMR"
                value={mmr === 0 ? '' : mmr}
                onChange={(e) => handleMMRChange(index, e.target.value)}
                className="w-full"
              />
            </div>
          ))}
        </div>
        <div className="mt-6 text-center">
          <p className="text-lg font-semibold">Total Team MMR:</p>
          <p className={cn(
            "text-2xl font-bold",
            isOverCap ? "text-destructive" : "text-green-500"
          )}>
            {totalMMR.toLocaleString()} / {TEAM_MMR_CAP.toLocaleString()}
          </p>
          {isOverCap && (
            <p className="text-sm text-destructive mt-1">
              This team is over the MMR cap and would not be eligible.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
