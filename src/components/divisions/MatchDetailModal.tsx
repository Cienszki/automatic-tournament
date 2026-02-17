// src/components/divisions/MatchDetailModal.tsx
// Detailed head-to-head match view modal

'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import Image from 'next/image';
import { Calendar, MapPin, Trophy, Swords, Users, TrendingUp, ExternalLink } from 'lucide-react';
import type { Match } from '@/lib/definitions';
import { cn } from '@/lib/utils';

interface MatchDetailModalProps {
  match: Match | null;
  isOpen: boolean;
  onClose: () => void;
  divisionColor: string;
}

export function MatchDetailModal({ match, isOpen, onClose, divisionColor }: MatchDetailModalProps) {
  if (!match) return null;

  const matchDate = match.completed_at || match.scheduled_for;
  const isCompleted = match.status === 'completed';
  const isLive = match.status === 'live';
  
  // Calculate winner
  const teamAWon = match.teamA.score > match.teamB.score;
  const teamBWon = match.teamB.score > match.teamA.score;
  const isDraw = match.teamA.score === match.teamB.score;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Swords className="h-5 w-5" style={{ color: divisionColor }} />
            Szczegóły meczu
          </DialogTitle>
        </DialogHeader>

        {/* Match Header */}
        <div className="space-y-4">
          {/* Teams and Score */}
          <div className="flex items-center justify-between gap-4">
            {/* Team A */}
            <div className={cn(
              "flex-1 flex items-center gap-3 p-4 rounded-lg border-2 transition-colors",
              isCompleted && teamAWon && "bg-green-500/10 border-green-500/50",
              isCompleted && !teamAWon && !isDraw && "opacity-60"
            )}>
              {match.teamA.logoUrl && (
                <Image
                  src={match.teamA.logoUrl}
                  alt={match.teamA.name}
                  width={48}
                  height={48}
                  className="rounded-sm"
                  unoptimized
                />
              )}
              <div className="flex-1">
                <p className="font-bold text-lg">{match.teamA.name}</p>
                {teamAWon && <Badge className="mt-1 bg-green-500">Zwycięzca</Badge>}
              </div>
              <div className="text-4xl font-bold" style={{ color: divisionColor }}>
                {match.teamA.score}
              </div>
            </div>

            {/* VS / Score separator */}
            <div className="flex flex-col items-center gap-1">
              <div className="text-muted-foreground font-bold text-sm">VS</div>
              {isLive && (
                <Badge variant="destructive" className="animate-pulse">
                  NA ŻYWO
                </Badge>
              )}
              {!isCompleted && !isLive && (
                <Badge variant="outline">
                  Zaplanowany
                </Badge>
              )}
            </div>

            {/* Team B */}
            <div className={cn(
              "flex-1 flex items-center gap-3 p-4 rounded-lg border-2 transition-colors flex-row-reverse",
              isCompleted && teamBWon && "bg-green-500/10 border-green-500/50",
              isCompleted && !teamBWon && !isDraw && "opacity-60"
            )}>
              <div className="text-4xl font-bold" style={{ color: divisionColor }}>
                {match.teamB.score}
              </div>
              <div className="flex-1 text-right">
                <p className="font-bold text-lg">{match.teamB.name}</p>
                {teamBWon && <Badge className="mt-1 bg-green-500">Zwycięzca</Badge>}
              </div>
              {match.teamB.logoUrl && (
                <Image
                  src={match.teamB.logoUrl}
                  alt={match.teamB.name}
                  width={48}
                  height={48}
                  className="rounded-sm"
                  unoptimized
                />
              )}
            </div>
          </div>

          {/* Match Info */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {matchDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{format(new Date(matchDate), 'dd MMMM yyyy, HH:mm', { locale: pl })}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              <span>Format: {match.series_format?.toUpperCase() || 'BO2'}</span>
            </div>
            {match.openDotaMatchUrl && (
              <a 
                href={match.openDotaMatchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-primary transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Zobacz na OpenDota</span>
              </a>
            )}
          </div>
        </div>

        {isCompleted ? (
          <Tabs defaultValue="overview" className="mt-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Podsumowanie</TabsTrigger>
              <TabsTrigger value="games">Gry ({match.game_ids?.length || 0})</TabsTrigger>
              <TabsTrigger value="performances">Występy graczy</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {/* Match Summary */}
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Wynik końcowy</p>
                      <p className="text-2xl font-bold">
                        {match.teamA.score} - {match.teamB.score}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Zwycięzca</p>
                      <p className="text-lg font-semibold">
                        {isDraw ? 'Remis' : teamAWon ? match.teamA.name : match.teamB.name}
                      </p>
                    </div>
                  </div>

                  {match.playerPerformances && match.playerPerformances.length > 0 && (
                    <div className="pt-4 border-t">
                      <p className="text-sm font-semibold mb-2">Najlepsi gracze</p>
                      <div className="grid grid-cols-2 gap-4">
                        {match.playerPerformances
                          .sort((a, b) => b.fantasyPoints - a.fantasyPoints)
                          .slice(0, 4)
                          .map((perf, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <Badge variant="outline" className="w-8 text-center">
                                {i + 1}
                              </Badge>
                              <span className="flex-1 truncate">{perf.playerId}</span>
                              <span className="font-bold">{perf.fantasyPoints.toFixed(1)} FP</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Standin Info */}
              {match.standinInfo && Object.keys(match.standinInfo).length > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Zastępstwa
                    </p>
                    <div className="space-y-2 text-sm">
                      {Object.entries(match.standinInfo).map(([teamId, info]) => (
                        <div key={teamId}>
                          <p className="font-medium">
                            {teamId === match.teamA.id ? match.teamA.name : match.teamB.name}
                          </p>
                          <p className="text-muted-foreground">
                            Niedostępni: {info.unavailablePlayers.join(', ')}
                          </p>
                          <p className="text-muted-foreground">
                            Zastępstwa: {info.standins.join(', ')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="games" className="space-y-4">
              {match.game_ids && match.game_ids.length > 0 ? (
                <div className="space-y-3">
                  {match.game_ids.map((gameId, index) => (
                    <Card key={gameId}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">Gra {index + 1}</p>
                            <p className="text-sm text-muted-foreground">Match ID: {gameId}</p>
                          </div>
                          <a
                            href={`https://www.opendota.com/matches/${gameId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            OpenDota
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Brak dostępnych informacji o grach
                </p>
              )}
            </TabsContent>

            <TabsContent value="performances" className="space-y-4">
              {match.playerPerformances && match.playerPerformances.length > 0 ? (
                <div className="space-y-6">
                  {/* Team A Players */}
                  <div>
                    <p className="font-semibold mb-3">{match.teamA.name}</p>
                    <div className="space-y-2">
                      {match.playerPerformances
                        .filter(p => p.teamId === match.teamA.id)
                        .map((perf, i) => (
                          <Card key={i}>
                            <CardContent className="py-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="text-sm">
                                    <p className="font-medium">{perf.playerId}</p>
                                    <p className="text-muted-foreground">{perf.hero}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                  <div className="text-center">
                                    <p className="text-muted-foreground text-xs">K/D/A</p>
                                    <p className="font-semibold">{perf.kills}/{perf.deaths}/{perf.assists}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-muted-foreground text-xs">GPM/XPM</p>
                                    <p className="font-semibold">{perf.gpm}/{perf.xpm}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-muted-foreground text-xs">FP</p>
                                    <p className="font-bold" style={{ color: divisionColor }}>
                                      {perf.fantasyPoints.toFixed(1)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  </div>

                  {/* Team B Players */}
                  <div>
                    <p className="font-semibold mb-3">{match.teamB.name}</p>
                    <div className="space-y-2">
                      {match.playerPerformances
                        .filter(p => p.teamId === match.teamB.id)
                        .map((perf, i) => (
                          <Card key={i}>
                            <CardContent className="py-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="text-sm">
                                    <p className="font-medium">{perf.playerId}</p>
                                    <p className="text-muted-foreground">{perf.hero}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                  <div className="text-center">
                                    <p className="text-muted-foreground text-xs">K/D/A</p>
                                    <p className="font-semibold">{perf.kills}/{perf.deaths}/{perf.assists}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-muted-foreground text-xs">GPM/XPM</p>
                                    <p className="font-semibold">{perf.gpm}/{perf.xpm}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-muted-foreground text-xs">FP</p>
                                    <p className="font-bold" style={{ color: divisionColor }}>
                                      {perf.fantasyPoints.toFixed(1)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Brak dostępnych statystyk graczy
                </p>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <Card className="mt-6">
            <CardContent className="py-8 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-semibold mb-2">Mecz zaplanowany</p>
              <p className="text-muted-foreground">
                Statystyki będą dostępne po zakończeniu meczu
              </p>
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
}
