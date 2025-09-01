"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Crown, Trophy, Medal, Award, Star, Target } from "lucide-react";
import type { PlayerRole } from "@/lib/definitions";
import { cn } from "@/lib/utils";

interface LeaderboardData {
  overall: Array<{
    userId: string;
    displayName: string;
    averageScore: number;
    gamesPlayed: number;
    rank: number;
  }>;
  byRole: {
    [K in PlayerRole]: Array<{
      playerId: string;
      nickname: string;
      teamName: string;
      averageScore: number;
      totalMatches: number;
      rank: number;
    }>;
  };
}

export default function SimpleLeaderboards({ leaderboards }: { leaderboards: LeaderboardData }) {
  const [activePanel, setActivePanel] = useState(0);
  const [isUserInteracting, setIsUserInteracting] = useState(false);

  const panels = [
    { title: "Overall Leaders", data: leaderboards.overall || [], icon: Trophy },
    { title: "Carry Leaders", data: leaderboards.byRole?.['Carry'] || [], icon: Crown },
    { title: "Mid Leaders", data: leaderboards.byRole?.['Mid'] || [], icon: Target },
    { title: "Offlane Leaders", data: leaderboards.byRole?.['Offlane'] || [], icon: Medal },
    { title: "Soft Support Leaders", data: leaderboards.byRole?.['Soft Support'] || [], icon: Award },
    { title: "Hard Support Leaders", data: leaderboards.byRole?.['Hard Support'] || [], icon: Star },
  ];

  // Removed auto-rotation - panels now change only by manual user interaction

  const handlePrevious = () => {
    setIsUserInteracting(true);
    setActivePanel(prev => (prev - 1 + panels.length) % panels.length);
    setTimeout(() => setIsUserInteracting(false), 3000);
  };

  const handleNext = () => {
    setIsUserInteracting(true);
    setActivePanel(prev => (prev + 1) % panels.length);
    setTimeout(() => setIsUserInteracting(false), 3000);
  };

  const currentPanel = panels[activePanel];

  return (
    <Card className="w-full shadow-xl bg-gradient-to-br from-background via-background/95 to-muted/50">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl lg:text-3xl flex items-center justify-center gap-3">
          <currentPanel.icon className="h-8 w-8 text-primary" />
          Fantasy Leaderboards
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-4">
        {/* Panel Display */}
        <div className="relative min-h-[400px] bg-gradient-to-b from-slate-900 to-slate-800 rounded-lg p-6 mb-4">
          {/* Current Panel Header */}
          <div className="flex items-center justify-center mb-6">
            <currentPanel.icon className="h-6 w-6 text-primary mr-2" />
            <h3 className="text-xl font-bold text-white">{currentPanel.title}</h3>
          </div>

          {/* Leaderboard Entries - show all entries */}
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {currentPanel.data.map((entry, index) => (
              <div
                key={('userId' in entry ? entry.userId : 'playerId' in entry ? entry.playerId : index)}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-all duration-300 hover:scale-[1.02]",
                  index < 3 
                    ? "bg-primary/20 border-primary/40 shadow-lg" 
                    : "bg-white/10 border-white/20"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                    index === 0 ? "bg-yellow-500 text-yellow-50" :
                    index === 1 ? "bg-gray-400 text-gray-50" :
                    index === 2 ? "bg-amber-600 text-amber-50" :
                    "bg-slate-600 text-slate-50"
                  )}>
                    {index + 1}
                  </div>
                  
                  <div className="flex-1">
                    <div className="font-medium text-white text-sm">
                      {('displayName' in entry ? entry.displayName : 'nickname' in entry ? entry.nickname : 'Unknown')}
                    </div>
                    {'teamName' in entry && entry.teamName && (
                      <div className="text-xs text-slate-300">
                        {entry.teamName}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="font-bold text-primary">
                    {entry.averageScore?.toFixed(1) || '0.0'}
                  </div>
                  <div className="text-xs text-slate-400">
                    {('gamesPlayed' in entry ? entry.gamesPlayed : 'totalMatches' in entry ? entry.totalMatches : 0)} games
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevious}
            className="bg-background/80 backdrop-blur-sm border-primary/20 hover:bg-primary/20"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          {/* Panel indicators */}
          <div className="flex gap-2">
            {panels.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setIsUserInteracting(true);
                  setActivePanel(index);
                  setTimeout(() => setIsUserInteracting(false), 3000);
                }}
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-300",
                  index === activePanel 
                    ? "bg-primary scale-125" 
                    : "bg-muted-foreground/40 hover:bg-muted-foreground/60"
                )}
              />
            ))}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            className="bg-background/80 backdrop-blur-sm border-primary/20 hover:bg-primary/20"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Current Panel Details */}
        <div className="mt-4 text-center">
          <div className="text-sm text-muted-foreground">
            Showing all {currentPanel.data.length} entries
          </div>
        </div>
      </CardContent>
    </Card>
  );
}