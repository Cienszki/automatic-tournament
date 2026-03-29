"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTournament, useTournamentType } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Save, RotateCcw, Loader2, RefreshCw } from 'lucide-react';
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import type { Team, PlayoffMatch, PlayoffMatchFormat } from '@/lib/definitions';

interface BracketSlot {
  matchId: string;
  label: string;
  round: number;
  position: number;
  bracketType: 'upper' | 'lower' | 'final';
  format: PlayoffMatchFormat;
  teamAId: string;
  teamBId: string;
}

/**
 * Generate upper bracket slots for single-elimination.
 * n teams → n-1 matches across ceil(log2(n)) rounds.
 */
function generateSingleEliminationSlots(teamsCount: number, config: { semifinalFormat: string; finalFormat: string; grandFinalFormat: string }): BracketSlot[] {
  const rounds = Math.ceil(Math.log2(teamsCount));
  const slots: BracketSlot[] = [];
  let matchesInRound = Math.floor(teamsCount / 2);

  for (let r = 1; r <= rounds; r++) {
    const isGrandFinal = r === rounds;
    const isSemifinal = r === rounds - 1;
    const format = isGrandFinal
      ? (config.grandFinalFormat as PlayoffMatchFormat) || 'bo5'
      : isSemifinal
        ? (config.semifinalFormat as PlayoffMatchFormat) || 'bo3'
        : (config.finalFormat as PlayoffMatchFormat) || 'bo3';

    for (let p = 1; p <= matchesInRound; p++) {
      const roundLabel = isGrandFinal
        ? 'Finał'
        : isSemifinal
          ? `Półfinał ${p}`
          : `Runda ${r} — Mecz ${p}`;

      slots.push({
        matchId: `ub-r${r}-p${p}`,
        label: roundLabel,
        round: r,
        position: p,
        bracketType: isGrandFinal ? 'final' : 'upper',
        format,
        teamAId: '',
        teamBId: '',
      });
    }
    matchesInRound = Math.floor(matchesInRound / 2);
  }
  return slots;
}

/**
 * Generate upper + lower bracket slots for double-elimination.
 * Upper bracket: standard single-elim among upper-seeded teams.
 * Lower bracket: first round receives losers + lower-seeded teams.
 * Grand final: UB winner vs LB winner.
 */
function generateDoubleEliminationSlots(
  ubTeams: number,
  lbTeams: number,
  config: { semifinalFormat: string; finalFormat: string; grandFinalFormat: string },
): BracketSlot[] {
  const slots: BracketSlot[] = [];

  // Upper bracket
  const ubRounds = Math.ceil(Math.log2(ubTeams));
  let ubMatchesInRound = Math.floor(ubTeams / 2);
  for (let r = 1; r <= ubRounds; r++) {
    for (let p = 1; p <= ubMatchesInRound; p++) {
      const isFinal = r === ubRounds;
      const isSemi = r === ubRounds - 1;
      const format = isFinal
        ? (config.finalFormat as PlayoffMatchFormat) || 'bo3'
        : isSemi
          ? (config.semifinalFormat as PlayoffMatchFormat) || 'bo3'
          : 'bo3';
      slots.push({
        matchId: `ub-r${r}-p${p}`,
        label: isFinal ? 'UB Finał' : isSemi ? `UB Półfinał ${p}` : `UB Runda ${r} — Mecz ${p}`,
        round: r,
        position: p,
        bracketType: 'upper',
        format,
        teamAId: '',
        teamBId: '',
      });
    }
    ubMatchesInRound = Math.floor(ubMatchesInRound / 2);
  }

  // Lower bracket — simplified: number of LB rounds ≈ 2 * (ubRounds - 1)
  // In first LB round, losers from UB R1 face the seeded LB teams.
  const lbFirstRoundMatches = Math.max(Math.floor((ubTeams / 2 + lbTeams) / 2), 1);
  const lbRounds = Math.max(Math.ceil(Math.log2(lbFirstRoundMatches)) + 1, 1);
  let lbMatchesInRound = lbFirstRoundMatches;

  for (let r = 1; r <= lbRounds; r++) {
    const isFinal = r === lbRounds;
    for (let p = 1; p <= lbMatchesInRound; p++) {
      slots.push({
        matchId: `lb-r${r}-p${p}`,
        label: isFinal ? 'LB Finał' : `LB Runda ${r} — Mecz ${p}`,
        round: r,
        position: p,
        bracketType: 'lower',
        format: 'bo3',
        teamAId: '',
        teamBId: '',
      });
    }
    lbMatchesInRound = Math.max(Math.ceil(lbMatchesInRound / 2), 1);
    if (lbMatchesInRound === 0) break;
  }

  // Grand final
  slots.push({
    matchId: 'grand-final',
    label: 'Wielki Finał',
    round: 1,
    position: 1,
    bracketType: 'final',
    format: (config.grandFinalFormat as PlayoffMatchFormat) || 'bo5',
    teamAId: '',
    teamBId: '',
  });

  return slots;
}

/**
 * PlayoffsTab — Generic Admin bracket seeding.
 * Reads playoff config from the tournament and generates the correct
 * number of bracket slots. Admin manually assigns teams to first-round slots.
 */
export function PlayoffsTab() {
  const { tournament, theme } = useTournament();
  const { isLeague } = useTournamentType();
  const { toast } = useToast();

  const [teams, setTeams] = useState<Team[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [slots, setSlots] = useState<BracketSlot[]>([]);

  const playoffConfig = tournament?.playoffs;

  // Generate bracket structure from tournament config
  const templateSlots = useMemo<BracketSlot[]>(() => {
    if (!playoffConfig?.enabled) return [];
    const cfg = {
      semifinalFormat: playoffConfig.semifinalFormat || 'bo3',
      finalFormat: playoffConfig.finalFormat || 'bo3',
      grandFinalFormat: playoffConfig.grandFinalFormat || 'bo5',
    };

    if (playoffConfig.format === 'double-elimination') {
      const ubTeams = playoffConfig.upperBracketTeams || Math.ceil(playoffConfig.teamsCount / 2) || 4;
      const lbTeams = playoffConfig.lowerBracketTeams || Math.floor(playoffConfig.teamsCount / 2) || 4;
      return generateDoubleEliminationSlots(ubTeams, lbTeams, cfg);
    }
    return generateSingleEliminationSlots(playoffConfig.teamsCount || 4, cfg);
  }, [playoffConfig]);

  // Load teams + existing bracket data
  useEffect(() => {
    async function load() {
      if (!tournament?.id) return;
      setIsLoading(true);
      try {
        const teamsSnap = await getDocs(collection(db, 'tournaments', tournament.id, 'teams'));
        setTeams(teamsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Team)));

        // Load saved playoff_matches and merge into template
        const pmSnap = await getDocs(collection(db, 'tournaments', tournament.id, 'playoff_matches'));
        const saved = new Map<string, PlayoffMatch>();
        pmSnap.docs.forEach((d) => saved.set(d.id, { id: d.id, ...d.data() } as PlayoffMatch));

        const merged = templateSlots.map((s) => {
          const existing = saved.get(s.matchId);
          if (existing) {
            return {
              ...s,
              teamAId: existing.teamA?.id || '',
              teamBId: existing.teamB?.id || '',
              format: existing.format || s.format,
            };
          }
          return s;
        });
        setSlots(merged);
      } catch (err) {
        console.error('Error loading playoff bracket:', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [tournament?.id, templateSlots]);

  const setSlotTeam = useCallback(
    (matchId: string, side: 'A' | 'B', teamId: string) => {
      setSlots((prev) =>
        prev.map((s) =>
          s.matchId === matchId
            ? side === 'A'
              ? { ...s, teamAId: teamId }
              : { ...s, teamBId: teamId }
            : s,
        ),
      );
    },
    [],
  );

  const getTeamById = (id: string) => teams.find((t) => t.id === id);

  const handleSave = async () => {
    if (!tournament?.id) return;
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      for (const slot of slots) {
        const teamA = slot.teamAId ? getTeamById(slot.teamAId) : undefined;
        const teamB = slot.teamBId ? getTeamById(slot.teamBId) : undefined;
        const pmDoc: PlayoffMatch = {
          id: slot.matchId,
          bracketType: slot.bracketType,
          round: slot.round,
          position: slot.position,
          teamA: teamA ? { id: teamA.id, name: teamA.name, logoUrl: teamA.logoUrl || '' } : undefined,
          teamB: teamB ? { id: teamB.id, name: teamB.name, logoUrl: teamB.logoUrl || '' } : undefined,
          format: slot.format,
          status: 'scheduled',
          createdAt: now,
          updatedAt: now,
        };

        // Preserve existing result if present
        const existingSnap = await getDoc(
          doc(db, 'tournaments', tournament.id, 'playoff_matches', slot.matchId),
        );
        if (existingSnap.exists()) {
          const old = existingSnap.data();
          if (old.result) {
            (pmDoc as unknown as Record<string, unknown>).result = old.result;
            pmDoc.status = 'completed';
          }
        }

        await setDoc(
          doc(db, 'tournaments', tournament.id, 'playoff_matches', slot.matchId),
          pmDoc,
        );
      }
      toast({ title: 'Zapisano', description: 'Drabinka playoff została zaktualizowana.' });
    } catch (err) {
      console.error('Error saving playoff bracket:', err);
      toast({ title: 'Błąd zapisu', description: 'Nie udało się zapisać drabinki.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Regenerate bracket from config (discard existing seeding)
  const handleRegenerate = () => {
    if (!confirm('Czy na pewno chcesz zregenerować drabinkę? Obecne przypisania drużyn zostaną utracone.')) return;
    setSlots(templateSlots);
  };

  if (!playoffConfig?.enabled) {
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

  // Group slots by bracket type then round for rendering
  const upperSlots = slots.filter((s) => s.bracketType === 'upper');
  const lowerSlots = slots.filter((s) => s.bracketType === 'lower');
  const finalSlots = slots.filter((s) => s.bracketType === 'final');

  const groupByRound = (arr: BracketSlot[]) => {
    const map = new Map<number, BracketSlot[]>();
    arr.forEach((s) => {
      const list = map.get(s.round) || [];
      list.push(s);
      map.set(s.round, list);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  };

  const renderSlotCard = (slot: BracketSlot) => {
    // Only first-round slots or the grand final get team selectors
    const isFirstUpperRound = slot.bracketType === 'upper' && slot.round === 1;
    const isFirstLowerRound = slot.bracketType === 'lower' && slot.round === 1;
    const isFinal = slot.bracketType === 'final';
    const isEditable = isFirstUpperRound || isFirstLowerRound;

    return (
      <Card key={slot.matchId} className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold text-base">
            <Trophy className="h-4 w-4" style={{ color: isFinal ? '#EAB308' : theme.primaryColor }} />
            {slot.label}
          </CardTitle>
          <CardDescription className="font-logik text-xs">
            {slot.format.toUpperCase()} • {slot.bracketType === 'upper' ? 'Upper Bracket' : slot.bracketType === 'lower' ? 'Lower Bracket' : 'Grand Final'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Team A */}
          <div className="space-y-1">
            <Label className="font-logik-extended-bold text-xs">
              {isEditable ? 'Drużyna A (górny seed)' : 'Drużyna A'}
            </Label>
            {isEditable ? (
              <Select value={slot.teamAId} onValueChange={(v) => setSlotTeam(slot.matchId, 'A', v)}>
                <SelectTrigger className="font-logik">
                  <SelectValue placeholder="— TBA —" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="h-10 rounded-md border border-dashed border-border flex items-center justify-center text-muted-foreground font-logik text-sm">
                {slot.teamAId ? getTeamById(slot.teamAId)?.name || slot.teamAId : 'Wyłoniony z poprzedniej rundy'}
              </div>
            )}
          </div>

          <div className="text-center text-xs uppercase tracking-widest text-muted-foreground font-logik">vs</div>

          {/* Team B */}
          <div className="space-y-1">
            <Label className="font-logik-extended-bold text-xs">
              {isEditable ? 'Drużyna B (dolny seed)' : 'Drużyna B'}
            </Label>
            {isEditable ? (
              <Select value={slot.teamBId} onValueChange={(v) => setSlotTeam(slot.matchId, 'B', v)}>
                <SelectTrigger className="font-logik">
                  <SelectValue placeholder="— TBA —" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="h-10 rounded-md border border-dashed border-border flex items-center justify-center text-muted-foreground font-logik text-sm">
                {slot.teamBId ? getTeamById(slot.teamBId)?.name || slot.teamBId : 'Wyłoniony z poprzedniej rundy'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-logik-extended-bold">Playoffs — Obsadzanie drabinki</h2>
          <p className="text-muted-foreground font-logik">
            {playoffConfig.format === 'double-elimination'
              ? 'Double Elimination — przypisz drużyny do pierwszych rund UB i LB.'
              : 'Single Elimination — przypisz drużyny do pierwszej rundy.'}
            {' '}Kolejne rundy wypełniane automatycznie po wynikach.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleRegenerate} className="font-logik">
            <RefreshCw className="h-4 w-4 mr-2" />
            Regeneruj
          </Button>
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
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Upper Bracket */}
          {upperSlots.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-logik-extended-bold">Upper Bracket</h3>
              {groupByRound(upperSlots).map(([round, roundSlots]) => (
                <div key={`ub-r${round}`} className="space-y-2">
                  <p className="text-sm font-logik text-muted-foreground">Runda {round}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {roundSlots.map(renderSlotCard)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Lower Bracket */}
          {lowerSlots.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-logik-extended-bold">Lower Bracket</h3>
              {groupByRound(lowerSlots).map(([round, roundSlots]) => (
                <div key={`lb-r${round}`} className="space-y-2">
                  <p className="text-sm font-logik text-muted-foreground">Runda {round}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {roundSlots.map(renderSlotCard)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Grand Final */}
          {finalSlots.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-logik-extended-bold text-yellow-500">Grand Final</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {finalSlots.map(renderSlotCard)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
