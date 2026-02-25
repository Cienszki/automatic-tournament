"use client";

import React, { useState, useEffect } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Save, RotateCcw, Loader2 } from 'lucide-react';
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Team, PlayoffMatch } from '@/lib/definitions';

/**
 * PlayoffsTab — Admin bracket seeding
 * Lets the admin manually assign Elite division teams to the 4 semi-final slots.
 * Saves to tournaments/{id}/playoff_matches.
 */
export function PlayoffsTab() {
  const { tournament, theme } = useTournament();
  const { toast } = useToast();

  const [teams, setTeams] = useState<Team[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Semi 1
  const [semi1TeamA, setSemi1TeamA] = useState<string>('');
  const [semi1TeamB, setSemi1TeamB] = useState<string>('');
  // Semi 2
  const [semi2TeamA, setSemi2TeamA] = useState<string>('');
  const [semi2TeamB, setSemi2TeamB] = useState<string>('');

  // Load teams from Elite division + load existing bracket data
  useEffect(() => {
    async function load() {
      if (!tournament?.id) return;
      setIsLoading(true);
      try {
        // Fetch all teams (they all belong to the tournament; Elite is determined via matches)
        const teamsSnap = await getDocs(collection(db, 'tournaments', tournament.id, 'teams'));
        const allTeams = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Team));
        setTeams(allTeams);

        // Load existing playoff_matches if any
        const semi1Doc = await getDoc(doc(db, 'tournaments', tournament.id, 'playoff_matches', 'semi-1'));
        const semi2Doc = await getDoc(doc(db, 'tournaments', tournament.id, 'playoff_matches', 'semi-2'));

        if (semi1Doc.exists()) {
          const d = semi1Doc.data() as PlayoffMatch;
          if (d.teamA?.id) setSemi1TeamA(d.teamA.id);
          if (d.teamB?.id) setSemi1TeamB(d.teamB.id);
        }
        if (semi2Doc.exists()) {
          const d = semi2Doc.data() as PlayoffMatch;
          if (d.teamA?.id) setSemi2TeamA(d.teamA.id);
          if (d.teamB?.id) setSemi2TeamB(d.teamB.id);
        }
      } catch (err) {
        console.error('Error loading playoff bracket data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [tournament?.id]);

  const getTeamById = (id: string) => teams.find(t => t.id === id);

  const buildTeamRef = (id: string) => {
    const t = getTeamById(id);
    if (!t) return undefined;
    return { id: t.id, name: t.name, logoUrl: t.logoUrl || '' };
  };

  const handleSave = async () => {
    if (!tournament?.id) return;
    setIsSaving(true);
    try {
      const now = new Date().toISOString();

      const semi1: PlayoffMatch = {
        id: 'semi-1',
        bracketType: 'upper',
        round: 1,
        position: 1,
        teamA: semi1TeamA ? buildTeamRef(semi1TeamA) : undefined,
        teamB: semi1TeamB ? buildTeamRef(semi1TeamB) : undefined,
        format: 'bo3',
        status: 'scheduled',
        createdAt: now,
        updatedAt: now,
      };

      const semi2: PlayoffMatch = {
        id: 'semi-2',
        bracketType: 'upper',
        round: 1,
        position: 2,
        teamA: semi2TeamA ? buildTeamRef(semi2TeamA) : undefined,
        teamB: semi2TeamB ? buildTeamRef(semi2TeamB) : undefined,
        format: 'bo3',
        status: 'scheduled',
        createdAt: now,
        updatedAt: now,
      };

      const grandFinal: PlayoffMatch = {
        id: 'grand-final',
        bracketType: 'upper',
        round: 2,
        position: 1,
        // Grand final teams are determined by match results - not set here
        format: 'bo5',
        status: 'scheduled',
        createdAt: now,
        updatedAt: now,
      };

      const pmRef = (id: string) => doc(db, 'tournaments', tournament.id, 'playoff_matches', id);
      await setDoc(pmRef('semi-1'), semi1);
      await setDoc(pmRef('semi-2'), semi2);
      // Only create grand final doc if it doesn't exist yet (preserve results)
      const gfSnap = await getDoc(pmRef('grand-final'));
      if (!gfSnap.exists()) {
        await setDoc(pmRef('grand-final'), grandFinal);
      }

      toast({
        title: 'Zapisano',
        description: 'Drabinka playoff została zaktualizowana.',
        duration: 3000,
      });
    } catch (err) {
      console.error('Error saving playoff bracket:', err);
      toast({
        title: 'Błąd zapisu',
        description: 'Nie udało się zapisać drabinki. Sprawdź uprawnienia.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!tournament?.playoffs?.enabled) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-logik-extended-bold">Playoffs</h2>
            <p className="text-muted-foreground font-logik">Zarządzanie drabinką playoff</p>
          </div>
        </div>
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6 text-center py-16 space-y-3">
            <Trophy className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <p className="font-logik-extended-bold text-lg">Playoffs są wyłączone</p>
            <p className="text-sm text-muted-foreground font-logik">
              Włącz playoffy w zakładce <strong>Struktura</strong> aby zarządzać drabinką.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-logik-extended-bold">Playoffs — Obsadzanie drabinki</h2>
          <p className="text-muted-foreground font-logik">
            Ręcznie wybierz drużyny do każdego miejsca w półfinałach. Finał zostanie obsadzony automatycznie po wynikach.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className="font-logik"
          style={{ backgroundColor: theme.primaryColor }}
        >
          {isSaving ? (
            <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Zapisz drabinkę
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Semi-Final 1 */}
          <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
                <Trophy className="h-5 w-5" style={{ color: theme.primaryColor }} />
                Półfinał 1
              </CardTitle>
              <CardDescription className="font-logik">Runda 1 — Pozycja 1</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="font-logik-extended-bold">Drużyna A (górny seed)</Label>
                <Select value={semi1TeamA} onValueChange={setSemi1TeamA}>
                  <SelectTrigger className="font-logik">
                    <SelectValue placeholder="— TBA —" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-center text-xs uppercase tracking-widest text-muted-foreground font-logik">vs</div>
              <div className="space-y-2">
                <Label className="font-logik-extended-bold">Drużyna B (dolny seed)</Label>
                <Select value={semi1TeamB} onValueChange={setSemi1TeamB}>
                  <SelectTrigger className="font-logik">
                    <SelectValue placeholder="— TBA —" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Semi-Final 2 */}
          <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
                <Trophy className="h-5 w-5" style={{ color: theme.primaryColor }} />
                Półfinał 2
              </CardTitle>
              <CardDescription className="font-logik">Runda 1 — Pozycja 2</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="font-logik-extended-bold">Drużyna A (górny seed)</Label>
                <Select value={semi2TeamA} onValueChange={setSemi2TeamA}>
                  <SelectTrigger className="font-logik">
                    <SelectValue placeholder="— TBA —" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-center text-xs uppercase tracking-widest text-muted-foreground font-logik">vs</div>
              <div className="space-y-2">
                <Label className="font-logik-extended-bold">Drużyna B (dolny seed)</Label>
                <Select value={semi2TeamB} onValueChange={setSemi2TeamB}>
                  <SelectTrigger className="font-logik">
                    <SelectValue placeholder="— TBA —" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Grand Final — read-only preview */}
          <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm md:col-span-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Wielki Finał
              </CardTitle>
              <CardDescription className="font-logik">
                Runda 2 — Obsadzany automatycznie po wynikach półfinałów
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {['Zwycięzca Półfinału 1', 'Zwycięzca Półfinału 2'].map((label) => (
                  <div
                    key={label}
                    className="flex items-center justify-center h-14 rounded-xl border border-dashed border-border text-muted-foreground font-logik text-sm"
                  >
                    {label}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
