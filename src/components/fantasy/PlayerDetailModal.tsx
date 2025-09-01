"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Badge,
} from "@/components/ui/badge";
import { 
  ScrollArea 
} from "@/components/ui/scroll-area";
import { 
  Loader2, 
  Trophy,
  Sword,
  Shield,
  Heart,
  Coins,
  Zap,
  Star,
  User,
  Award,
  TrendingUp,
  Target,
  X
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import type { FantasyPlayerStats } from "@/lib/fantasy-types";

interface PlayerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerId: string | null;
  playerName?: string;
}

const PlayerDetailModal: React.FC<PlayerDetailModalProps> = ({
  isOpen,
  onClose,
  playerId,
  playerName = "Player"
}) => {
  const [playerStats, setPlayerStats] = useState<FantasyPlayerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !playerId) {
      setPlayerStats(null);
      setError(null);
      return;
    }

    const fetchPlayerStats = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/fantasy/player-stats?playerId=${playerId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch player stats');
        }
        
        const data = await response.json();
        if (data.success) {
          setPlayerStats(data.playerStats);
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayerStats();
  }, [isOpen, playerId]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <User className="h-6 w-6 text-blue-600" />
                <span className="text-2xl font-bold">
                  {playerStats?.nickname || playerName}
                </span>
              </div>
              {playerStats && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-sm">
                    {playerStats.role}
                  </Badge>
                  <Badge variant="secondary" className="text-sm">
                    {playerStats.teamName}
                  </Badge>
                </div>
              )}
            </DialogTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-6 pr-4">
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <span className="ml-2 text-lg">Loading player stats...</span>
                </div>
              )}

              {error && (
                <div className="text-center py-12">
                  <div className="text-red-600 text-lg font-semibold mb-2">
                    Error Loading Player Stats
                  </div>
                  <div className="text-gray-600">{error}</div>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => window.location.reload()}
                  >
                    Try Again
                  </Button>
                </div>
              )}

              {playerStats && (
                <>
                  {/* Overview Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {playerStats.totalScore.toFixed(1)}
                        </div>
                        <div className="text-sm text-muted-foreground">Total Score</div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {playerStats.averageScore.toFixed(1)}
                        </div>
                        <div className="text-sm text-muted-foreground">Avg Score</div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {playerStats.totalMatches}
                        </div>
                        <div className="text-sm text-muted-foreground">Total Games</div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          #{playerStats.rank}
                        </div>
                        <div className="text-sm text-muted-foreground">Rank</div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Match History */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-yellow-500" />
                        Match History ({playerStats.matchHistory.length} games)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {playerStats.matchHistory.map((match, index) => {
                          const isAboveAverage = match.score >= playerStats.averageScore;
                          const bgColor = isAboveAverage 
                            ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' 
                            : 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200';
                          
                          return (
                            <Card key={index} className={`${bgColor} transition-all duration-200`}>
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                      <Trophy className="h-4 w-4 text-yellow-500" />
                                      <span className="font-semibold text-lg">
                                        {match.score.toFixed(1)} pts
                                      </span>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {match.date} • vs {match.opponent}
                                    </div>
                                  </div>
                                  <Badge variant={match.isWin ? "default" : "destructive"}>
                                    {match.isWin ? 'WIN' : 'LOSS'}
                                  </Badge>
                                </div>

                                {/* Game Stats */}
                                <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-sm">
                                  <div className="flex items-center gap-2">
                                    <Sword className="h-4 w-4 text-red-500" />
                                    <span>{match.kills}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Shield className="h-4 w-4 text-gray-500" />
                                    <span>{match.deaths}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Heart className="h-4 w-4 text-green-500" />
                                    <span>{match.assists}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Coins className="h-4 w-4 text-yellow-500" />
                                    <span>{match.lastHits}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-blue-500" />
                                    <span>{match.gpm}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Star className="h-4 w-4 text-purple-500" />
                                    <span>{match.xpm}</span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PlayerDetailModal;