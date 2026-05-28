"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Users,
  Swords,
  Database,
  Crown,
  Trophy,
} from 'lucide-react';

interface StatsMeta {
  lastUpdated: string;
  playerCount: number;
  teamCount: number;
  gameCount: number;
  mostPickedHero: { heroName: string; pickCount: number } | null;
}

/**
 * Stats Tab — Recalculate tournament statistics and preview current state.
 */
export function StatsTab() {
  const { tournament, theme, isLegacyTournament } = useTournament();
  const { toast } = useToast();

  const [meta, setMeta] = useState<StatsMeta>({
    lastUpdated: '—',
    playerCount: 0,
    teamCount: 0,
    gameCount: 0,
    mostPickedHero: null,
  });
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isRefreshingHeroes, setIsRefreshingHeroes] = useState(false);
  const [isRecalculatingRankings, setIsRecalculatingRankings] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string } | null>(null);

  // ── Fetch stats metadata from the correct Firestore paths ──
  const loadMeta = useCallback(async () => {
    if (!tournament?.id) return;
    try {
      const [tsDoc, playerSnap, teamSnap] = isLegacyTournament
        ? await Promise.all([
            getDoc(doc(db, 'tournamentStats', 'tournament-stats')),
            getDocs(collection(db, 'playerStats')),
            getDocs(collection(db, 'teamStats')),
          ])
        : await Promise.all([
            getDoc(doc(db, 'tournaments', tournament.id, 'stats', 'tournament-stats')),
            getDocs(collection(db, 'tournaments', tournament.id, 'playerStats')),
            getDocs(collection(db, 'tournaments', tournament.id, 'teamStats')),
          ]);

      const data = tsDoc.exists() ? tsDoc.data() : null;
      setMeta({
        lastUpdated: data?.lastUpdated
          ? new Date(data.lastUpdated).toLocaleString('pl-PL')
          : '—',
        playerCount: playerSnap.size,
        teamCount: teamSnap.size,
        gameCount: data?.totalGames ?? 0,
        mostPickedHero: data?.mostPickedHero ?? null,
      });
    } catch (err) {
      console.error('Error loading stats metadata:', err);
    }
  }, [tournament?.id, isLegacyTournament]);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  // ── Recalculate ──
  const handleRecalculate = async () => {
    setIsRecalculating(true);
    setProgress(10);
    setLastResult(null);

    try {
      const response = await fetch('/api/stats/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isLegacyTournament ? {} : { tournamentId: tournament?.id }),
      });

      setProgress(60);
      const result = await response.json();

      if (result.success) {
        setProgress(90);
        await loadMeta();
        setProgress(100);
        setLastResult({ success: true, message: 'Statystyki zostały przeliczone pomyślnie.' });
        toast({ title: 'Sukces', description: 'Statystyki zostały przeliczone.' });
      } else {
        throw new Error(result.message || result.error || 'Nieznany błąd');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Nie udało się przeliczyć statystyk';
      setLastResult({ success: false, message: msg });
      toast({ title: 'Błąd', description: msg, variant: 'destructive' });
    } finally {
      setIsRecalculating(false);
    }
  };

  // ── Recalculate performance rankings ──
  const handleRecalculateRankings = async () => {
    if (!tournament?.id) return;
    setIsRecalculatingRankings(true);
    try {
      const response = await fetch('/api/rankings/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: tournament.id }),
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Sukces', description: 'Rankingi zosta\u0142y przeliczone.' });
      } else {
        throw new Error(result.error || 'Nieznany b\u0142\u0105d');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Nie uda\u0142o si\u0119 przeliczy\u0107 ranking\u00f3w';
      toast({ title: 'B\u0142\u0105d', description: msg, variant: 'destructive' });
    } finally {
      setIsRecalculatingRankings(false);
    }
  };

  const pc = theme.primaryColor;

  // ── Refresh most-played heroes for all players ──
  const handleRefreshHeroes = async () => {
    if (!tournament?.id) return;
    setIsRefreshingHeroes(true);
    try {
      const response = await fetch('/api/player-heroes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: tournament.id, refreshAll: true }),
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Sukces', description: result.message });
      } else {
        throw new Error(result.error || 'Nieznany błąd');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Nie udało się odświeżyć bohaterów';
      toast({ title: 'Błąd', description: msg, variant: 'destructive' });
    } finally {
      setIsRefreshingHeroes(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-logik-extended-bold">Statystyki</h2>
          <p className="text-muted-foreground font-logik">
            Przeliczanie i podgląd statystyk turnieju
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleRecalculateRankings}
            disabled={isRecalculatingRankings || isLegacyTournament}
            variant="outline"
            className="font-logik"
          >
            {isRecalculatingRankings ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Przeliczanie...</>
            ) : (
              <><Trophy className="h-4 w-4 mr-2" />Przelicz rankingi</>
            )}
          </Button>
          <Button
            onClick={handleRefreshHeroes}
            disabled={isRefreshingHeroes}
            variant="outline"
            className="font-logik"
          >
            {isRefreshingHeroes ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Odświeżanie...</>
            ) : (
              <><Users className="h-4 w-4 mr-2" />Odśwież bohaterów</>
            )}
          </Button>
          <Button
            onClick={handleRecalculate}
            disabled={isRecalculating}
            className="font-logik"
            style={{ backgroundColor: pc }}
          >
            {isRecalculating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Przeliczanie...</>
            ) : (
              <><RefreshCw className="h-4 w-4 mr-2" />Przelicz statystyki</>
            )}
          </Button>
        </div>
      </div>

      {/* Progress */}
      {isRecalculating && (
        <Card className="border-2 bg-card/50 backdrop-blur-sm" style={{ borderColor: `${pc}40` }}>
          <CardContent className="py-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: pc }} />
                <p className="font-logik">Przeliczanie statystyk…</p>
              </div>
              <span className="font-logik-extended-bold">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {lastResult && (
        <Card className={cn(
          'border-2 bg-card/50 backdrop-blur-sm',
          lastResult.success ? 'border-green-500/40' : 'border-red-500/40'
        )}>
          <CardContent className="py-4 flex items-center gap-3">
            {lastResult.success
              ? <CheckCircle2 className="h-5 w-5 text-green-500" />
              : <AlertTriangle className="h-5 w-5 text-red-500" />}
            <p className={cn('font-logik', lastResult.success ? 'text-green-500' : 'text-red-500')}>
              {lastResult.message}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 backdrop-blur-sm">
          <CardContent className="py-5 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span className="text-xs font-logik uppercase tracking-wide">Gracze</span>
            </div>
            <p className="text-2xl font-logik-extended-bold" style={{ color: pc }}>{meta.playerCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm">
          <CardContent className="py-5 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Swords className="h-4 w-4" />
              <span className="text-xs font-logik uppercase tracking-wide">Drużyny</span>
            </div>
            <p className="text-2xl font-logik-extended-bold" style={{ color: pc }}>{meta.teamCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm">
          <CardContent className="py-5 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Database className="h-4 w-4" />
              <span className="text-xs font-logik uppercase tracking-wide">Gry</span>
            </div>
            <p className="text-2xl font-logik-extended-bold" style={{ color: pc }}>{meta.gameCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm">
          <CardContent className="py-5 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-logik uppercase tracking-wide">Aktualizacja</span>
            </div>
            <p className="text-sm font-logik-extended-bold">{meta.lastUpdated}</p>
          </CardContent>
        </Card>
      </div>

      {/* Most picked hero */}
      <Card className="bg-card/50 backdrop-blur-sm border-2" style={{ borderColor: `${pc}30` }}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold text-base">
            <Crown className="h-5 w-5" style={{ color: pc }} />
            Najczęściej pickowany bohater
          </CardTitle>
        </CardHeader>
        <CardContent>
          {meta.mostPickedHero ? (
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl" style={{ backgroundColor: `${pc}15` }}>
                <Trophy className="h-6 w-6" style={{ color: pc }} />
              </div>
              <div>
                <p className="text-2xl font-logik-extended-bold" style={{ color: pc }}>
                  {meta.mostPickedHero.heroName}
                </p>
                <p className="text-sm text-muted-foreground font-logik">
                  {meta.mostPickedHero.pickCount} {meta.mostPickedHero.pickCount === 1 ? 'pick' : 'picki'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-muted-foreground">
              <BarChart3 className="h-5 w-5 opacity-40" />
              <p className="text-sm font-logik">
                Brak danych — uruchom przeliczanie statystyk aby pobrać dane.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="bg-card/50 backdrop-blur-sm">
        <CardContent className="py-5">
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-500/80 font-logik">
              Przeliczanie statystyk może zająć kilka minut. Mecze muszą być wcześniej sparsowane przez OpenDota API.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
