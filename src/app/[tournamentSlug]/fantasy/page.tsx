"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTournament, useTournamentType } from '@/context/TournamentContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Crown, Loader2, Lock, Trophy, Users, TrendingUp, Target } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getAllTournamentPlayers, getUserFantasyLineup, saveUserFantasyLineup, getTournamentStatus } from '@/lib/firestore';
import type { TournamentPlayer, FantasyLineup } from '@/lib/definitions';
import { PlayerRoles, FANTASY_BUDGET_MMR } from '@/lib/definitions';

/**
 * Fantasy page - fantasy league interface
 */
export default function FantasyPage() {
  const { tournament, theme, isLegacyTournament } = useTournament();
  const { isLeague } = useTournamentType();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [players, setPlayers] = useState<TournamentPlayer[]>([]);
  const [userLineup, setUserLineup] = useState<FantasyLineup | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load data for legacy tournament
  useEffect(() => {
    const loadData = async () => {
      try {
        if (isLegacyTournament) {
          const [playersData, statusData] = await Promise.all([
            getAllTournamentPlayers(),
            getTournamentStatus()
          ]);
          setPlayers(playersData);
          // Fantasy lock is determined by whether we're between rounds
          setIsLocked(false);

          if (user) {
            const lineup = await getUserFantasyLineup(user.uid, 'current');
            setUserLineup(lineup);
          }
        }
      } catch (error) {
        console.error('Failed to load fantasy data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      loadData();
    }
  }, [isLegacyTournament, user, authLoading]);

  if (!tournament) return null;

  const fantasyEnabled = tournament.fantasy?.enabled;
  const fantasyType = tournament.fantasy?.type;
  const budget = tournament.fantasy?.budget || FANTASY_BUDGET_MMR;

  if (loading || authLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Crown className="h-8 w-8" style={{ color: theme.secondaryColor }} />
          <h1 className="text-3xl font-bold">Fantasy League</h1>
        </div>
        <div className="text-center py-16">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground mt-4">Ładowanie fantasy...</p>
        </div>
      </div>
    );
  }

  if (!fantasyEnabled) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Crown className="h-8 w-8" style={{ color: theme.secondaryColor }} />
          <h1 className="text-3xl font-bold">Fantasy League</h1>
        </div>
        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardContent className="py-16 text-center">
            <Crown className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Fantasy niedostępne</h3>
            <p className="text-muted-foreground">
              Fantasy nie jest włączone w tym turnieju.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate used budget
  const usedBudget = userLineup
    ? Object.values(userLineup).reduce((sum, player) => {
        if (player && typeof player === 'object' && 'mmr' in player) {
          return sum + (player as TournamentPlayer).mmr;
        }
        return sum;
      }, 0)
    : 0;

  const budgetProgress = (usedBudget / budget) * 100;
  const selectedCount = userLineup ? Object.keys(userLineup).filter(k => userLineup[k as keyof FantasyLineup]).length : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Crown className="h-8 w-8" style={{ color: theme.secondaryColor }} />
        <h1 className="text-3xl font-bold">Fantasy League</h1>
        <Badge variant="outline">
          {fantasyType === 'season-long' ? 'Sezonowy' : 'Rundowy'}
        </Badge>
      </div>

      {/* Status */}
      {isLocked && (
        <Card className="border-yellow-500/50" style={{ backgroundColor: theme.cardColor }}>
          <CardContent className="py-4 flex items-center gap-3">
            <Lock className="h-5 w-5 text-yellow-500" />
            <p className="text-yellow-500">
              Wybór składu jest zablokowany na czas trwania kolejki.
            </p>
          </CardContent>
        </Card>
      )}

      {/* User not logged in */}
      {!user && (
        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardContent className="py-8 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Zaloguj się</h3>
            <p className="text-muted-foreground mb-4">
              Musisz być zalogowany, aby stworzyć skład fantasy.
            </p>
          </CardContent>
        </Card>
      )}

      {/* User's Team */}
      {user && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Budget & Selection */}
          <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" style={{ color: theme.primaryColor }} />
                {fantasyType === 'season-long' ? 'Budżet' : 'Limit MMR'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Wykorzystane: {usedBudget.toLocaleString('pl-PL')}</span>
                  <span>Max: {budget.toLocaleString('pl-PL')}</span>
                </div>
                <Progress 
                  value={budgetProgress} 
                  className="h-3"
                  style={{ 
                    backgroundColor: `${theme.primaryColor}20`,
                  }}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span>Wybranych graczy:</span>
                <span className="font-bold">{selectedCount} / 5</span>
              </div>
            </CardContent>
          </Card>

          {/* Lineup */}
          <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" style={{ color: theme.accentColor }} />
                Twój skład
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {PlayerRoles.map(role => {
                  const player = userLineup?.[role as keyof FantasyLineup] as TournamentPlayer | null;
                  return (
                    <div 
                      key={role} 
                      className="flex items-center justify-between p-2 rounded-lg"
                      style={{ backgroundColor: `${theme.primaryColor}10` }}
                    >
                      <span className="text-sm text-muted-foreground">{role}</span>
                      {player ? (
                        <span className="font-medium">{player.nickname}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Wybierz gracza</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Leaderboard */}
      <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" style={{ color: theme.secondaryColor }} />
            Ranking Fantasy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Ranking zostanie załadowany po rozpoczęciu rozgrywek.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
