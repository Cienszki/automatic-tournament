"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TEAM_MMR_CAP } from "@/lib/definitions";
import { cn } from "@/lib/utils";
import { Calculator } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

export function MMRCalculator() {
  const { t } = useTranslation();
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
          {t("rules.mmrCalculator.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {playerMMRs.map((mmr, index) => (
            <div key={index} className="space-y-2">
              <Label htmlFor={`player-${index + 1}-mmr`}>{t("rules.mmrCalculator.player")} {index + 1}</Label>
              <Input
                id={`player-${index + 1}-mmr`}
                type="number"
                placeholder={t("rules.mmrCalculator.enterMMR")}
                value={mmr === 0 ? '' : mmr}
                onChange={(e) => handleMMRChange(index, e.target.value)}
                className="w-full"
              />
            </div>
          ))}
        </div>
        <div className="mt-6 text-center">
          <p className="text-lg font-semibold">{t("rules.mmrCalculator.totalTeamMMR")}</p>
          <p className={cn(
            "text-2xl font-bold",
            isOverCap ? "text-destructive" : "text-green-500"
          )}>
            {totalMMR.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} / {TEAM_MMR_CAP.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}
          </p>
          {isOverCap && (
            <p className="text-sm text-destructive mt-1">
              {t("rules.mmrCalculator.overCapWarning")}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
