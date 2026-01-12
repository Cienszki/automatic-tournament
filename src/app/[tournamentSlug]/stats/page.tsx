"use client";

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTournament } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { BarChart2, Loader2 } from 'lucide-react';

// Type definitions
interface PlayerStats {
  id: string;
  name: string;
  teamName: string;
  gamesPlayed: number;
  kills: number;
  deaths: number;
  assists: number;
  lastHits: number;
  denies: number;
  gpm: number;
  xpm: number;
  heroDamage: number;
  towerDamage: number;
  healing: number;
  kda: number;
}

interface TeamStats {
  id: string;
  name: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  avgGameDuration: number;
}

/**
 * Stats page - player and team statistics
 */
export default function StatsPage() {
  const { tournament, theme, isLegacyTournament } = useTournament();
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLegacyTournament) {
      setLoading(false);
      return;
    }

    // Subscribe to player stats for legacy tournament
    const unsubscribePlayers = onSnapshot(
      collection(db, 'player_stats'),
      (snapshot) => {
        const stats = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as PlayerStats[];
        setPlayerStats(stats.sort((a, b) => b.kda - a.kda).slice(0, 10));
      }
    );

    // Subscribe to team stats
    const unsubscribeTeams = onSnapshot(
      collection(db, 'team_stats'),
      (snapshot) => {
        const stats = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as TeamStats[];
        setTeamStats(stats.sort((a, b) => b.winRate - a.winRate).slice(0, 10));
        setLoading(false);
      }
    );

    return () => {
      unsubscribePlayers();
      unsubscribeTeams();
    };
  }, [isLegacyTournament]);

  if (!tournament) return null;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <BarChart2 className="h-8 w-8" style={{ color: theme.primaryColor }} />
          <h1 className="text-3xl font-bold">Statystyki</h1>
        </div>
        <div className="text-center py-16">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground mt-4">Ładowanie statystyk...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart2 className="h-8 w-8" style={{ color: theme.primaryColor }} />
        <h1 className="text-3xl font-bold">Statystyki</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Player Stats */}
        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardHeader>
            <CardTitle>Top KDA</CardTitle>
          </CardHeader>
          <CardContent>
            {playerStats.length > 0 ? (
              <div className="space-y-3">
                {playerStats.map((player, index) => (
                  <div key={player.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
                    <div className="flex items-center gap-3">
                      <span 
                        className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold"
                        style={{ backgroundColor: theme.primaryColor, color: '#fff' }}
                      >
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium">{player.name}</p>
                        <p className="text-xs text-muted-foreground">{player.teamName}</p>
                      </div>
                    </div>
                    <span className="font-bold" style={{ color: theme.accentColor }}>
                      {player.kda.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Brak danych o graczach.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Team Stats */}
        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardHeader>
            <CardTitle>Najlepsze drużyny</CardTitle>
          </CardHeader>
          <CardContent>
            {teamStats.length > 0 ? (
              <div className="space-y-3">
                {teamStats.map((team, index) => (
                  <div key={team.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
                    <div className="flex items-center gap-3">
                      <span 
                        className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold"
                        style={{ backgroundColor: theme.secondaryColor, color: '#fff' }}
                      >
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium">{team.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {team.wins}W - {team.losses}L
                        </p>
                      </div>
                    </div>
                    <span className="font-bold" style={{ color: theme.primaryColor }}>
                      {(team.winRate * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Brak danych o drużynach.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Note for new tournaments */}
      {!isLegacyTournament && (
        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              Statystyki dla tego turnieju będą dostępne po rozpoczęciu rozgrywek.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
