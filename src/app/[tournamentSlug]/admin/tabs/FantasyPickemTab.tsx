"use client";

import React, { useState } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { 
  Trophy,
  Target,
  Save,
  RotateCcw,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Sparkles,
} from 'lucide-react';

/**
 * Fantasy & Pick'em Tab - Refresh/recalculate fantasy scores
 */
export function FantasyPickemTab() {
  const { tournament, theme } = useTournament();
  
  const [isRecalculatingFantasy, setIsRecalculatingFantasy] = useState(false);
  const [isRecalculatingPickem, setIsRecalculatingPickem] = useState(false);
  const [fantasyProgress, setFantasyProgress] = useState(0);
  const [pickemProgress, setPickemProgress] = useState(0);
  const [lastFantasyUpdate, setLastFantasyUpdate] = useState('2025-02-24 15:30');
  const [lastPickemUpdate, setLastPickemUpdate] = useState('2025-02-24 15:30');

  const handleRecalculateFantasy = async () => {
    setIsRecalculatingFantasy(true);
    setFantasyProgress(0);
    
    // Simulate progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 300));
      setFantasyProgress(i);
    }
    
    setIsRecalculatingFantasy(false);
    setLastFantasyUpdate(new Date().toLocaleString('pl-PL'));
  };

  const handleRecalculatePickem = async () => {
    setIsRecalculatingPickem(true);
    setPickemProgress(0);
    
    // Simulate progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 200));
      setPickemProgress(i);
    }
    
    setIsRecalculatingPickem(false);
    setLastPickemUpdate(new Date().toLocaleString('pl-PL'));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-logik-extended-bold">Fantasy & Pick'em</h2>
          <p className="text-muted-foreground font-logik">
            Zarządzanie punktacją fantasy i predykcjami
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: `${theme.primaryColor}20` }}>
                <Trophy className="h-5 w-5" style={{ color: theme.primaryColor }} />
              </div>
              <div>
                <p className="text-2xl font-logik-extended-bold">128</p>
                <p className="text-sm text-muted-foreground font-logik">Graczy fantasy</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Target className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-logik-extended-bold">256</p>
                <p className="text-sm text-muted-foreground font-logik">Predykcji pick'em</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-logik-extended-bold">42</p>
                <p className="text-sm text-muted-foreground font-logik">Mecze rozliczone</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-logik-extended-bold">8</p>
                <p className="text-sm text-muted-foreground font-logik">Oczekujących</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fantasy Recalculation */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <Sparkles className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Fantasy League
          </CardTitle>
          <CardDescription className="font-logik">
            Przeliczanie punktów fantasy na podstawie statystyk meczowych
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 rounded-xl border border-border">
            <div>
              <p className="font-logik-extended-bold">Status punktacji</p>
              <p className="text-sm text-muted-foreground font-logik">
                Ostatnia aktualizacja: {lastFantasyUpdate}
              </p>
            </div>
            <Badge className="bg-green-500/20 text-green-500 border-green-500/30 font-logik">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Aktualna
            </Badge>
          </div>

          {isRecalculatingFantasy && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-logik">
                <span className="text-muted-foreground">Przeliczanie punktów...</span>
                <span>{fantasyProgress}%</span>
              </div>
              <Progress value={fantasyProgress} className="h-2" />
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              onClick={handleRecalculateFantasy}
              disabled={isRecalculatingFantasy}
              className="font-logik"
              style={{ backgroundColor: theme.primaryColor }}
            >
              {isRecalculatingFantasy ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Przeliczanie...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Przelicz punkty fantasy
                </>
              )}
            </Button>
            <p className="text-sm text-muted-foreground font-logik">
              Przelicza wszystkie punkty fantasy dla wszystkich użytkowników
            </p>
          </div>

          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <p className="font-logik-extended-bold text-amber-500">Uwaga</p>
                <p className="text-sm text-amber-500/80 font-logik">
                  Przeliczanie punktów może zająć kilka minut w zależności od liczby użytkowników i meczów.
                  Nie zamykaj tej strony podczas procesu.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pick'em Recalculation */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <Target className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Pick'em Predictions
          </CardTitle>
          <CardDescription className="font-logik">
            Rozliczanie predykcji użytkowników
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 rounded-xl border border-border">
            <div>
              <p className="font-logik-extended-bold">Status predykcji</p>
              <p className="text-sm text-muted-foreground font-logik">
                Ostatnia aktualizacja: {lastPickemUpdate}
              </p>
            </div>
            <Badge className="bg-green-500/20 text-green-500 border-green-500/30 font-logik">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Aktualne
            </Badge>
          </div>

          {isRecalculatingPickem && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-logik">
                <span className="text-muted-foreground">Rozliczanie predykcji...</span>
                <span>{pickemProgress}%</span>
              </div>
              <Progress value={pickemProgress} className="h-2" />
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              onClick={handleRecalculatePickem}
              disabled={isRecalculatingPickem}
              variant="outline"
              className="font-logik"
            >
              {isRecalculatingPickem ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rozliczanie...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Przelicz pick'em
                </>
              )}
            </Button>
            <p className="text-sm text-muted-foreground font-logik">
              Rozlicza wszystkie predykcje na podstawie wyników meczów
            </p>
          </div>

          {/* Pick'em Types */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
            <div className="p-4 rounded-xl border border-border">
              <p className="font-logik-extended-bold mb-2">Predykcje meczowe</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-logik">128 rozliczonych</Badge>
                <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 font-logik">16 oczekuje</Badge>
              </div>
            </div>
            <div className="p-4 rounded-xl border border-border">
              <p className="font-logik-extended-bold mb-2">Predykcje tabelowe</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-logik">3 dywizje</Badge>
                <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30 font-logik">W trakcie</Badge>
              </div>
            </div>
            <div className="p-4 rounded-xl border border-border">
              <p className="font-logik-extended-bold mb-2">Bracket playoff</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-logik">Nie rozpoczęty</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scoring Settings */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <Trophy className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Ustawienia punktacji
          </CardTitle>
          <CardDescription className="font-logik">
            Konfiguracja systemu punktowego
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground font-logik">
            <p>Konfiguracja punktacji dostępna w ustawieniach turnieju.</p>
            <Button variant="link" className="font-logik mt-2" style={{ color: theme.primaryColor }}>
              Przejdź do ustawień →
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
