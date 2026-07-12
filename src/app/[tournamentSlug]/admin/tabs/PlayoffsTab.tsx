"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Save, RotateCcw, Loader2, RefreshCw, Settings2 } from 'lucide-react';
import { collection, getDocs, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { generateBracket, BYE_TEAM_SENTINEL } from '@/lib/playoff-bracket-generator';
import { applyByeAutoAdvancement } from '@/lib/playoff-advancement';
import { shouldMirror, buildMirrorCreateData, buildMirrorTeamsPatch } from '@/lib/playoff-mirror';
import type { Team, PlayoffMatch, PlayoffMatchFormat } from '@/lib/definitions';
import type { BracketConfig } from '@/lib/playoff-bracket-generator';

// ─── Admin bracket slot with editing state ─────────────────────────────

interface AdminSlot {
  match: PlayoffMatch;
  teamAId: string;
  teamBId: string;
  deadline: string;
  format: PlayoffMatchFormat;
}

const BYE_TEAM_LABEL = 'BYE (auto-advance)';

function createByeTeam(matchId: string, slot: 'A' | 'B') {
  return {
    id: `${BYE_TEAM_SENTINEL}:${matchId}:${slot}`,
    name: 'BYE',
    logoUrl: '',
  };
}

/** Check if a match is in the first editable round for its bracket type. */
function isFirstRound(match: PlayoffMatch, allMatches: PlayoffMatch[]): boolean {
  if (match.bracketType === 'final') return false;
  const sameBracket = allMatches.filter(m => m.bracketType === match.bracketType);
  const minRound = Math.min(...sameBracket.map(m => m.round));
  return match.round === minRound;
}

/**
 * PlayoffsTab — Admin bracket setup and team seeding.
 *
 * 1. Admin selects format (single/double elimination).
 * 2. Admin sets UB/LB team counts.
 * 3. Bracket is generated and displayed visually.
 * 4. Admin assigns teams to first-round slots and sets deadlines.
 * 5. Admin saves to Firestore.
 */
export function PlayoffsTab() {
  const { tournament, theme, refetchTournament } = useTournament();
  const { toast } = useToast();

  const playoffConfig = tournament?.playoffs;

  const [teams, setTeams] = useState<Team[]>([]);
  const [slots, setSlots] = useState<AdminSlot[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);

  // Bracket config (editable by admin before generation)
  const [bracketFormat, setBracketFormat] = useState<'single-elimination' | 'double-elimination'>(
    playoffConfig?.format || 'double-elimination',
  );
  const [ubTeamsCount, setUbTeamsCount] = useState(playoffConfig?.upperBracketTeams || playoffConfig?.teamsCount || 8);
  const [lbTeamsCount, setLbTeamsCount] = useState(playoffConfig?.lowerBracketTeams || 0);
  const [defaultMatchFormat, setDefaultMatchFormat] = useState<PlayoffMatchFormat>('bo3');
  const [sfFormat, setSfFormat] = useState<PlayoffMatchFormat>((playoffConfig?.semifinalFormat as PlayoffMatchFormat) || 'bo3');
  const [fFormat, setFFormat] = useState<PlayoffMatchFormat>((playoffConfig?.finalFormat as PlayoffMatchFormat) || 'bo3');
  const [gfFormat, setGfFormat] = useState<PlayoffMatchFormat>((playoffConfig?.grandFinalFormat as PlayoffMatchFormat) || 'bo5');

  // Generate bracket template from current config
  const generateTemplate = useCallback((): PlayoffMatch[] => {
    const config: BracketConfig = {
      format: bracketFormat,
      upperBracketTeams: ubTeamsCount,
      lowerBracketTeams: lbTeamsCount,
      defaultFormat: defaultMatchFormat,
      semifinalFormat: sfFormat,
      finalFormat: fFormat,
      grandFinalFormat: gfFormat,
    };
    return generateBracket(config);
  }, [bracketFormat, ubTeamsCount, lbTeamsCount, defaultMatchFormat, sfFormat, fFormat, gfFormat]);

  // Load teams and existing bracket data
  useEffect(() => {
    async function load() {
      if (!tournament?.id) return;
      setIsLoading(true);
      try {
        // Load teams
        const teamsSnap = await getDocs(collection(db, 'tournaments', tournament.id, 'teams'));
        setTeams(teamsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));

        // Load saved playoff_matches
        const pmSnap = await getDocs(collection(db, 'tournaments', tournament.id, 'playoff_matches'));
        const savedMap = new Map<string, PlayoffMatch>();
        pmSnap.docs.forEach(d => savedMap.set(d.id, { id: d.id, ...d.data() } as PlayoffMatch));

        // Generate template and merge with saved data
        const template = generateTemplate();
        const merged: AdminSlot[] = template.map(m => {
          const saved = savedMap.get(m.id);
          return {
            match: saved ? { ...m, ...saved, id: m.id } : m,
            teamAId: saved?.teamA?.id || '',
            teamBId: saved?.teamB?.id || '',
            deadline: saved?.deadline || '',
            format: saved?.format || m.format,
          };
        });
        setSlots(merged);
      } catch (err) {
        console.error('Error loading playoff bracket:', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [tournament?.id, generateTemplate]);

  // ── Slot editing callbacks ──────────────────────────────────────────

  const updateSlot = useCallback((matchId: string, updates: Partial<AdminSlot>) => {
    setSlots(prev =>
      prev.map(s => (s.match.id === matchId ? { ...s, ...updates } : s)),
    );
  }, []);

  const getTeamById = (id: string): Team | undefined => teams.find(t => t.id === id);

  // ── Save to Firestore ───────────────────────────────────────────────

  const handleSave = async () => {
    if (!tournament?.id) return;
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const matchMap = new Map<string, PlayoffMatch>();

      for (const slot of slots) {
        const teamA = slot.teamAId === BYE_TEAM_SENTINEL
          ? createByeTeam(slot.match.id, 'A')
          : slot.teamAId
            ? getTeamById(slot.teamAId)
            : undefined;
        const teamB = slot.teamBId === BYE_TEAM_SENTINEL
          ? createByeTeam(slot.match.id, 'B')
          : slot.teamBId
            ? getTeamById(slot.teamBId)
            : undefined;

        const pmDoc: PlayoffMatch = {
          ...slot.match,
          teamA: teamA ? { id: teamA.id, name: teamA.name, logoUrl: teamA.logoUrl || '' } : undefined,
          teamB: teamB ? { id: teamB.id, name: teamB.name, logoUrl: teamB.logoUrl || '' } : undefined,
          format: slot.format,
          deadline: slot.deadline || undefined,
          updatedAt: now,
        };

        // Preserve existing result if present
        const existingSnap = await getDoc(doc(db, 'tournaments', tournament.id, 'playoff_matches', slot.match.id));
        if (existingSnap.exists()) {
          const old = existingSnap.data();
          if (old.result) {
            pmDoc.result = old.result as PlayoffMatch['result'];
            pmDoc.status = 'completed';
          }
        }

        matchMap.set(slot.match.id, pmDoc);
      }

      applyByeAutoAdvancement(matchMap, now);

      for (const [matchId, pmDoc] of matchMap.entries()) {
        // Firestore rejects undefined values; stringify/parse strips them recursively.
        const pmPayload = JSON.parse(JSON.stringify(pmDoc)) as Record<string, unknown>;
        await setDoc(doc(db, 'tournaments', tournament.id, 'playoff_matches', matchId), pmPayload);

        // Mirror every playable (non-bye, both-teams) playoff match into the `matches`
        // collection under the SAME id, so the bot/sync/stats/schedule treat it like a group
        // match. Creating fresh vs. patching an existing mirror is chosen so a captain-agreed
        // time or an already-synced score is never reset by an admin bracket re-save.
        const mirrorRef = doc(db, 'tournaments', tournament.id, 'matches', matchId);
        if (shouldMirror(pmDoc)) {
          const mirrorSnap = await getDoc(mirrorRef);
          if (mirrorSnap.exists()) {
            await setDoc(mirrorRef, buildMirrorTeamsPatch(pmDoc), { merge: true });
          } else {
            await setDoc(mirrorRef, buildMirrorCreateData(pmDoc));
          }
        }
      }

      // Also update tournament config with latest bracket settings
      await updateDoc(doc(db, 'tournaments', tournament.id), {
        'playoffs.format': bracketFormat,
        'playoffs.upperBracketTeams': ubTeamsCount,
        'playoffs.lowerBracketTeams': lbTeamsCount,
        'playoffs.teamsCount': ubTeamsCount + lbTeamsCount,
        'playoffs.semifinalFormat': sfFormat,
        'playoffs.finalFormat': fFormat,
        'playoffs.grandFinalFormat': gfFormat,
      });

      toast({ title: 'Zapisano', description: 'Drabinka playoff została zaktualizowana.' });
    } catch (err) {
      console.error('Error saving playoff bracket:', err);
      toast({ title: 'Błąd zapisu', description: 'Nie udało się zapisać drabinki.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Toggle visibility ───────────────────────────────────────────────

  const handleToggleVisibility = async () => {
    if (!tournament?.id) return;
    setIsTogglingVisibility(true);
    const newValue = !tournament.playoffs?.playoffsVisible;
    try {
      await updateDoc(doc(db, 'tournaments', tournament.id), { 'playoffs.playoffsVisible': newValue });
      await refetchTournament?.();
      toast({
        title: newValue ? 'Playoffs widoczne' : 'Playoffs ukryte',
        description: newValue
          ? 'Drabinka jest teraz widoczna dla wszystkich użytkowników.'
          : 'Drabinka jest ukryta przed użytkownikami.',
      });
    } catch (err) {
      console.error('Error toggling playoffs visibility:', err);
      toast({ title: 'Błąd', description: 'Nie udało się zmienić widoczności.', variant: 'destructive' });
    } finally {
      setIsTogglingVisibility(false);
    }
  };

  // ── Regenerate bracket ──────────────────────────────────────────────

  const handleRegenerate = () => {
    if (!confirm('Czy na pewno chcesz zregenerować drabinkę? Obecne przypisania drużyn zostaną utracone.')) return;
    const template = generateTemplate();
    setSlots(template.map(m => ({
      match: m,
      teamAId: '',
      teamBId: '',
      deadline: '',
      format: m.format,
    })));
  };

  // ── Disabled state ──────────────────────────────────────────────────

  if (!playoffConfig?.enabled) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-logik-extended-bold">Playoffs</h2>
          <p className="text-muted-foreground font-logik">Zarządzanie drabinką playoff</p>
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

  // ── Group slots for rendering ───────────────────────────────────────

  const upperSlots = slots.filter(s => s.match.bracketType === 'upper');
  const lowerSlots = slots.filter(s => s.match.bracketType === 'lower');
  const finalSlots = slots.filter(s => s.match.bracketType === 'final');
  const allMatches = slots.map(s => s.match);

  const groupByRound = (arr: AdminSlot[]): [number, AdminSlot[]][] => {
    const map = new Map<number, AdminSlot[]>();
    arr.forEach(s => {
      const list = map.get(s.match.round) || [];
      list.push(s);
      map.set(s.match.round, list);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  };

  const isVisible = !!tournament?.playoffs?.playoffsVisible;

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-logik-extended-bold">Playoffs — Obsadzanie drabinki</h2>
          <p className="text-muted-foreground font-logik">
            {bracketFormat === 'double-elimination'
              ? 'Double Elimination — przypisz drużyny do pierwszych rund UB i LB.'
              : 'Single Elimination — przypisz drużyny do pierwszej rundy.'}
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
            {isSaving ? <RotateCcw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Zapisz drabinkę
          </Button>
        </div>
      </div>

      {/* Bracket configuration */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold text-base">
            <Settings2 className="h-4 w-4" style={{ color: theme.primaryColor }} />
            Konfiguracja drabinki
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Format */}
            <div className="space-y-1">
              <Label className="font-logik-extended-bold text-xs">Format</Label>
              <Select value={bracketFormat} onValueChange={(v: 'single-elimination' | 'double-elimination') => setBracketFormat(v)}>
                <SelectTrigger className="font-logik"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single-elimination">Single Elimination</SelectItem>
                  <SelectItem value="double-elimination">Double Elimination</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* UB teams */}
            <div className="space-y-1">
              <Label className="font-logik-extended-bold text-xs">Drużyny w Upper Bracket</Label>
              <Input
                type="number"
                min={2}
                max={64}
                value={ubTeamsCount}
                onChange={e => setUbTeamsCount(Math.max(2, parseInt(e.target.value) || 2))}
                className="font-logik"
              />
            </div>

            {/* LB teams (only for double elimination) */}
            {bracketFormat === 'double-elimination' && (
              <div className="space-y-1">
                <Label className="font-logik-extended-bold text-xs">Drużyny w Lower Bracket</Label>
                <Input
                  type="number"
                  min={0}
                  max={32}
                  value={lbTeamsCount}
                  onChange={e => setLbTeamsCount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="font-logik"
                />
              </div>
            )}

            {/* Grand Final format */}
            <div className="space-y-1">
              <Label className="font-logik-extended-bold text-xs">Format Wielkiego Finału</Label>
              <Select value={gfFormat} onValueChange={(v: PlayoffMatchFormat) => setGfFormat(v)}>
                <SelectTrigger className="font-logik"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bo1">BO1</SelectItem>
                  <SelectItem value="bo3">BO3</SelectItem>
                  <SelectItem value="bo5">BO5</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visibility toggle */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-logik-extended-bold text-sm">Widoczność playoffs</p>
              <p className="text-xs text-muted-foreground font-logik mt-0.5">
                {isVisible
                  ? 'Drabinka playoffs jest widoczna dla wszystkich użytkowników.'
                  : 'Drabinka playoffs jest ukryta. Włącz aby pokazać ją użytkownikom.'}
              </p>
            </div>
            <Switch
              checked={isVisible}
              onCheckedChange={handleToggleVisibility}
              disabled={isTogglingVisibility}
            />
          </div>
        </CardContent>
      </Card>

      {/* Bracket display */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Upper Bracket */}
          {upperSlots.length > 0 && (
            <BracketSection
              title="Upper Bracket"
              titleColor={theme.primaryColor}
              slots={upperSlots}
              teams={teams}
              allMatches={allMatches}
              onUpdateSlot={updateSlot}
              groupByRound={groupByRound}
            />
          )}

          {/* Lower Bracket */}
          {lowerSlots.length > 0 && (
            <BracketSection
              title="Lower Bracket"
              titleColor="#ef4444"
              slots={lowerSlots}
              teams={teams}
              allMatches={allMatches}
              onUpdateSlot={updateSlot}
              groupByRound={groupByRound}
            />
          )}

          {/* Grand Final */}
          {finalSlots.length > 0 && (
            <BracketSection
              title="Grand Final"
              titleColor="#eab308"
              slots={finalSlots}
              teams={teams}
              allMatches={allMatches}
              onUpdateSlot={updateSlot}
              groupByRound={groupByRound}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section sub-component ─────────────────────────────────────────────

function BracketSection({
  title,
  titleColor,
  slots,
  teams,
  allMatches,
  onUpdateSlot,
  groupByRound,
}: {
  title: string;
  titleColor: string;
  slots: AdminSlot[];
  teams: Team[];
  allMatches: PlayoffMatch[];
  onUpdateSlot: (matchId: string, updates: Partial<AdminSlot>) => void;
  groupByRound: (arr: AdminSlot[]) => [number, AdminSlot[]][];
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-logik-extended-bold" style={{ color: titleColor }}>
        {title}
      </h3>
      {groupByRound(slots).map(([round, roundSlots]) => (
        <div key={`r${round}`} className="space-y-2">
          <p className="text-sm font-logik text-muted-foreground">
            Runda {round}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {roundSlots.map(slot => (
              <AdminSlotCard
                key={slot.match.id}
                slot={slot}
                teams={teams}
                allMatches={allMatches}
                onUpdate={onUpdateSlot}
                titleColor={titleColor}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Individual slot card ──────────────────────────────────────────────

function AdminSlotCard({
  slot,
  teams,
  allMatches,
  onUpdate,
  titleColor,
}: {
  slot: AdminSlot;
  teams: Team[];
  allMatches: PlayoffMatch[];
  onUpdate: (matchId: string, updates: Partial<AdminSlot>) => void;
  titleColor: string;
}) {
  const { match } = slot;
  const editable = isFirstRound(match, allMatches);
  const isFinal = match.bracketType === 'final';
  const getFeederLabel = (targetMatchId: string, targetSlot: 'teamA' | 'teamB'): string => {
    const feeder = allMatches.find(
      m => m.nextWinnerMatchId === targetMatchId && m.nextWinnerSlot === targetSlot,
    );
    if (!feeder) return 'Wyłoniony z poprzedniej rundy';
    return feeder.code ? `Zwycięzca ${feeder.code}` : 'Wyłoniony z poprzedniej rundy';
  };

  return (
    <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-logik-extended-bold text-sm">
          <Trophy className="h-3.5 w-3.5" style={{ color: isFinal ? '#EAB308' : titleColor }} />
          <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted">{match.code || match.id}</span>
          <span className="text-muted-foreground font-logik text-xs ml-auto">{match.format.toUpperCase()}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {/* Team A */}
        <div className="space-y-1">
          <Label className="font-logik-extended-bold text-xs">Drużyna A</Label>
          {editable ? (
            <Select value={slot.teamAId} onValueChange={v => onUpdate(match.id, { teamAId: v })}>
              <SelectTrigger className="font-logik text-sm h-9">
                <SelectValue placeholder="— Wybierz —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={BYE_TEAM_SENTINEL} className="text-red-500 font-logik-extended-bold">
                  {BYE_TEAM_LABEL}
                </SelectItem>
                {teams.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="h-9 rounded-md border border-dashed border-border flex items-center justify-center text-muted-foreground font-logik text-xs">
              {match.teamA?.name || getFeederLabel(match.id, 'teamA')}
            </div>
          )}
        </div>

        <div className="text-center text-xs uppercase tracking-widest text-muted-foreground font-logik">vs</div>

        {/* Team B */}
        <div className="space-y-1">
          <Label className="font-logik-extended-bold text-xs">Drużyna B</Label>
          {editable ? (
            <Select value={slot.teamBId} onValueChange={v => onUpdate(match.id, { teamBId: v })}>
              <SelectTrigger className="font-logik text-sm h-9">
                <SelectValue placeholder="— Wybierz —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={BYE_TEAM_SENTINEL} className="text-red-500 font-logik-extended-bold">
                  {BYE_TEAM_LABEL}
                </SelectItem>
                {teams.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="h-9 rounded-md border border-dashed border-border flex items-center justify-center text-muted-foreground font-logik text-xs">
              {match.teamB?.name || getFeederLabel(match.id, 'teamB')}
            </div>
          )}
        </div>

        {/* Deadline */}
        <div className="space-y-1">
          <Label className="font-logik-extended-bold text-xs">Deadline</Label>
          <Input
            type="datetime-local"
            value={slot.deadline ? slot.deadline.slice(0, 16) : ''}
            onChange={e => onUpdate(match.id, { deadline: e.target.value ? new Date(e.target.value).toISOString() : '' })}
            className="font-logik text-xs h-9"
          />
        </div>

        {/* Format override */}
        <div className="space-y-1">
          <Label className="font-logik-extended-bold text-xs">Format meczu</Label>
          <Select value={slot.format} onValueChange={(v: PlayoffMatchFormat) => onUpdate(match.id, { format: v })}>
            <SelectTrigger className="font-logik text-xs h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bo1">BO1</SelectItem>
              <SelectItem value="bo3">BO3</SelectItem>
              <SelectItem value="bo5">BO5</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
