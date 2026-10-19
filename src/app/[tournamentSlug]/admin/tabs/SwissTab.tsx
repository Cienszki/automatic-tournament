"use client";

// Swiss tournament administration.
//
// Swiss is generated one round at a time — round N+1's pairings depend on round
// N's results — so this tab is a sequential workflow rather than a settings form:
//
//   Setup field  ->  check seeds  ->  [ generate preview -> commit -> close ] x N
//
// The preview step matters more than it looks. The pairing engine treats
// everything except "perfect matching" and "no consecutive rematch" as a cost, so
// it always produces *a* legal answer; the admin eyeballing and swapping pairs is
// what catches an answer that is legal but silly.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Loader2, Play, RefreshCw, Save, Users, AlertTriangle, CheckCircle2, Lock,
  Unlock, Shuffle, ArrowLeftRight, Trophy, Info, Gavel,
} from 'lucide-react';
import type { MatchFormat, SwissRound, SwissStandingRow } from '@/types/tournament';
import {
  SWISS_BYE_TEAM_ID, isSwissByeTeam, recommendedRounds, maxRoundsWithoutRematch,
  type SwissPairing,
} from '@/lib/swiss/pairing';
import { adviseBand, type BandAdvice } from '@/lib/swiss/band-advisor';
import {
  SWISS_DIVISION_ID,
  loadSwissTeams, loadSwissMatches, loadSwissRounds, buildStandings,
  setupSwissField, ensureByeTeam, saveSeedMmr, renumberSeeds,
  generateRoundDraft, saveDraftPairings, saveDraftScheduling, commitRound, reopenRound,
  markRoundComplete, forceMatchResult,
  type SwissTeam, type SwissRoundMatch,
} from '@/lib/swiss/actions';

const MATCH_FORMATS: { value: MatchFormat; label: string; maxPoints: number }[] = [
  { value: 'bo1', label: 'BO1', maxPoints: 1 },
  { value: 'bo2', label: 'BO2', maxPoints: 2 },
  { value: 'bo3', label: 'BO3', maxPoints: 2 },
  { value: 'bo5', label: 'BO5', maxPoints: 3 },
];

type SchedulingMode = 'fixed' | 'window' | 'free';

/** ISO time → value of a datetime-local input (the admin's local time); '' when unset */
const toLocalInput = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
/** datetime-local value → ISO (UTC); '' stays '' */
const toIso = (local: string) => (local ? new Date(local).toISOString() : '');

/** Default reschedule limit for admin-scheduled rounds: earlier freely, later by at most this many hours */
const DEFAULT_MAX_HOURS_LATER = '2';

export function SwissTab() {
  const { tournament, theme, refetchTournament } = useTournament();
  const { user } = useAuth();
  const { toast } = useToast();

  const [teams, setTeams] = useState<SwissTeam[]>([]);
  const [matches, setMatches] = useState<SwissRoundMatch[]>([]);
  const [rounds, setRounds] = useState<SwissRound[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  // Seed editing
  const [seedDrafts, setSeedDrafts] = useState<Record<string, string>>({});

  // Round builder
  const [matchFormat, setMatchFormat] = useState<MatchFormat>('bo2');
  const [schedulingMode, setSchedulingMode] = useState<SchedulingMode>('fixed');
  // 'fixed' mode: one start time per pairing (datetime-local values, same order as the pairings)
  const [times, setTimes] = useState<string[]>([]);
  const [maxHoursLater, setMaxHoursLater] = useState(DEFAULT_MAX_HOURS_LATER);
  const [selectedPairs, setSelectedPairs] = useState<Set<number>>(new Set());
  const [bulkAt, setBulkAt] = useState('');
  // Set by the admin's edits only, so loading a draft doesn't write it straight back
  const schedulingDirty = React.useRef(false);
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const [allowRematch, setAllowRematch] = useState(false);
  // Band: organiser-set, never enforced by the platform. '' means no band.
  const [bandInput, setBandInput] = useState<string>('');
  const [savingBand, setSavingBand] = useState(false);
  const [draftPairings, setDraftPairings] = useState<SwissPairing[] | null>(null);
  const [draftWarnings, setDraftWarnings] = useState<string[]>([]);
  const [swapFrom, setSwapFrom] = useState<string | null>(null);

  const divisionId = tournament?.swiss?.divisionId ?? SWISS_DIVISION_ID;
  // Older Swiss docs predate these settings; seeding defaults on, band off.
  const useMmrSeeding = tournament?.swiss?.useMmrSeeding ?? true;
  const pairingBand = tournament?.swiss?.pairingBand ?? null;

  const reload = useCallback(async () => {
    if (!tournament?.id) return;
    setIsLoading(true);
    try {
      const [t, m, r] = await Promise.all([
        loadSwissTeams(tournament.id),
        loadSwissMatches(tournament.id, divisionId),
        loadSwissRounds(tournament.id),
      ]);
      setTeams(t);
      setMatches(m);
      setRounds(r);
      setBandInput(tournament.swiss?.pairingBand != null ? String(tournament.swiss.pairingBand) : '');

      // Rehydrate an uncommitted draft from a previous session, otherwise it
      // would exist in Firestore but be invisible here and the admin would have
      // no way to tell why the round number had already advanced.
      const storedDraft = r.find(x => x.status === 'draft');
      if (storedDraft) {
        setDraftPairings(storedDraft.pairings.map(p => ({
          teamAId: p.teamAId, teamBId: p.teamBId, isBye: p.isBye,
        })));
        setMatchFormat(storedDraft.matchFormat);
        setSchedulingMode(storedDraft.scheduling.mode);
        // Older drafts carry one fixedAt for the whole round
        setTimes(storedDraft.pairings.map((_, i) =>
          toLocalInput(storedDraft.scheduling.times?.[i] || storedDraft.scheduling.fixedAt)));
        setMaxHoursLater(storedDraft.scheduling.maxHoursLater === undefined
          ? DEFAULT_MAX_HOURS_LATER
          : storedDraft.scheduling.maxHoursLater === null ? '' : String(storedDraft.scheduling.maxHoursLater));
        setWindowStart(storedDraft.scheduling.windowStart ?? '');
        setWindowEnd(storedDraft.scheduling.windowEnd ?? '');
      } else {
        setDraftPairings(null);
        setMatchFormat(tournament.swiss?.defaultMatchFormat ?? 'bo2');
      }
    } catch (err) {
      console.error('[SwissTab] load failed', err);
      toast({ title: 'Błąd', description: 'Nie udało się wczytać danych Swiss.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [tournament?.id, divisionId, tournament?.swiss?.defaultMatchFormat, toast]);

  useEffect(() => { reload(); }, [reload]);

  // ── derived ────────────────────────────────────────────────────────────────

  const field = useMemo(
    () => teams.filter(t => !t.isSwissBye && t.divisionId === SWISS_DIVISION_ID),
    [teams]
  );
  const unassigned = useMemo(
    () => teams.filter(t => !t.isSwissBye && t.divisionId !== SWISS_DIVISION_ID),
    [teams]
  );
  const teamsById = useMemo(() => {
    const map: Record<string, SwissTeam> = {};
    for (const t of teams) map[t.id] = t;
    return map;
  }, [teams]);

  const standings = useMemo(() => buildStandings(teams, matches, true), [teams, matches]);

  const seedOrder = useMemo(
    () => [...field].sort((a, b) => (b.seedMmr ?? -1) - (a.seedMmr ?? -1) || a.name.localeCompare(b.name)),
    [field]
  );

  const missingSeeds = useMemo(() => field.filter(t => t.seedMmr == null), [field]);

  const committedRounds = rounds.filter(r => r.status !== 'draft');
  const lastRoundNumber = rounds.reduce((max, r) => Math.max(max, r.round), 0);
  const draftRound = rounds.find(r => r.status === 'draft');

  /** Matches of the newest committed round that still have no result. */
  const openMatchesInLatestRound = useMemo(() => {
    const latest = committedRounds.reduce((max, r) => Math.max(max, r.round), 0);
    if (!latest) return [];
    return matches.filter(m => m.round === latest && m.status !== 'completed');
  }, [matches, committedRounds]);

  const latestCommitted = committedRounds.reduce<SwissRound | null>(
    (acc, r) => (!acc || r.round > acc.round ? r : acc),
    null
  );

  const nextRoundNumber = draftRound ? draftRound.round : lastRoundNumber + 1;
  const canGenerateNext =
    !draftRound && openMatchesInLatestRound.length === 0 && field.length >= 2;

  const recommended = recommendedRounds(field.length);
  const rematchFreeCeiling = maxRoundsWithoutRematch(field.length);
  const plannedRounds = tournament?.swiss?.plannedRounds ?? null;

  const nameOf = (id: string) =>
    isSwissByeTeam(id) ? 'BYE' : (teamsById[id]?.name ?? id);
  const pointsOf = (id: string) =>
    standings.find(s => s.teamId === id)?.points ?? 0;
  const seedOf = (id: string) => teamsById[id]?.seedMmr;

  /** Band advice recomputed from whoever has actually registered. */
  const bandAdvice: BandAdvice | null = useMemo(() => {
    if (!useMmrSeeding) return null;
    const seeded = field
      .filter(t => typeof t.seedMmr === 'number' && t.seedMmr > 0)
      .map(t => ({ teamId: t.id, seedMmr: t.seedMmr as number }));
    if (seeded.length < 4) return null;
    return adviseBand(seeded, plannedRounds ?? recommended);
  }, [field, useMmrSeeding, plannedRounds, recommended]);

  /** '' = no hour limit; otherwise whole hours 0–72 */
  const parsedMaxHoursLater = (): number | null => {
    const raw = maxHoursLater.trim();
    if (raw === '') return null;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 72) {
      throw new Error('Limit przełożenia na później musi być liczbą całkowitą godzin od 0 do 72 (albo pusty).');
    }
    return n;
  };

  /** The round's scheduling as stored on the round doc (times as ISO, aligned with the pairings) */
  const schedulingPayload = (pairCount: number): SwissRound['scheduling'] => {
    if (schedulingMode === 'fixed') {
      return {
        mode: 'fixed',
        times: Array.from({ length: pairCount }, (_, i) => toIso(times[i] ?? '')),
        maxHoursLater: parsedMaxHoursLater(),
      };
    }
    if (schedulingMode === 'window') return { mode: 'window', windowStart, windowEnd };
    return { mode: 'free' };
  };

  // Keep the stored draft in step with the times being set (debounced), so a reload keeps them
  useEffect(() => {
    if (!schedulingDirty.current || !draftPairings || !tournament?.id) return;
    const t = setTimeout(() => {
      let scheduling: SwissRound['scheduling'];
      try { scheduling = schedulingPayload(draftPairings.length); } catch { return; /* invalid limit — reported on commit */ }
      schedulingDirty.current = false;
      saveDraftScheduling(tournament.id, nextRoundNumber, scheduling).catch(err =>
        console.error('[SwissTab] saving draft times failed', err));
    }, 700);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [times, maxHoursLater, schedulingMode, windowStart, windowEnd, draftPairings]);

  const setTime = (i: number, value: string) => {
    schedulingDirty.current = true;
    setTimes(prev => { const next = [...prev]; next[i] = value; return next; });
  };

  /** One date and time for every selected pair */
  const applyBulkTime = () => {
    if (!bulkAt || selectedPairs.size === 0) return;
    schedulingDirty.current = true;
    setTimes(prev => {
      const next = [...prev];
      selectedPairs.forEach(i => { next[i] = bulkAt; });
      return next;
    });
    setSelectedPairs(new Set());
  };

  const togglePair = (i: number) => setSelectedPairs(prev => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      console.error(`[SwissTab] ${key} failed`, err);
      toast({
        title: 'Błąd',
        description: err instanceof Error ? err.message : 'Operacja nie powiodła się.',
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  };

  // ── actions ────────────────────────────────────────────────────────────────

  const handleSetup = (includeUnverified: boolean) =>
    run('setup', async () => {
      if (!tournament?.id) return;
      const res = await setupSwissField(tournament.id, { includeUnverified });
      await renumberSeeds(tournament.id);
      await reload();
      toast({
        title: 'Pole Swiss gotowe',
        description: `Przypisano ${res.assigned} nowych drużyn (łącznie ${res.total}).`,
      });
    });

  const handleSaveSeed = (teamId: string) =>
    run(`seed:${teamId}`, async () => {
      if (!tournament?.id) return;
      const raw = seedDrafts[teamId];
      const parsed = raw === '' || raw == null ? null : Number(raw);
      if (parsed != null && (!Number.isFinite(parsed) || parsed < 0 || parsed > 12000)) {
        throw new Error('Średnie MMR musi być liczbą z zakresu 0–12000.');
      }
      await saveSeedMmr(tournament.id, teamId, parsed);
      await renumberSeeds(tournament.id);
      setSeedDrafts(prev => {
        const next = { ...prev };
        delete next[teamId];
        return next;
      });
      await reload();
    });

  const handleSaveBand = () =>
    run('band', async () => {
      if (!tournament?.id) return;
      const raw = bandInput.trim();
      const value = raw === '' ? null : Number(raw);
      if (value != null && (!Number.isFinite(value) || value < 250 || value > 6000)) {
        throw new Error('Zakres MMR musi mieścić się między 250 a 6000 (albo być pusty).');
      }
      await updateDoc(doc(db, 'tournaments', tournament.id), { 'swiss.pairingBand': value });
      await refetchTournament();
      toast({
        title: value == null ? 'Zakres wyłączony' : `Zakres ustawiony na ${value}`,
        description: value == null
          ? 'Pary będą dobierane wyłącznie według dorobku punktowego.'
          : 'Będzie stosowany od następnej generowanej rundy.',
      });
    });

  const handleGenerate = () =>
    run('generate', async () => {
      if (!tournament?.id) return;

      // 'fixed': times are set per pair once the pairs are visible — nothing to check yet
      if (schedulingMode === 'window' && (!windowStart || !windowEnd)) {
        throw new Error('Podaj początek i koniec okna terminowego.');
      }
      if (schedulingMode === 'window' && windowEnd < windowStart) {
        throw new Error('Koniec okna nie może być przed jego początkiem.');
      }

      if (field.length % 2 === 1) await ensureByeTeam(tournament.id);

      // Times belong to the slots (1st pair, 2nd pair…), so regenerating keeps them
      const { round, warnings } = await generateRoundDraft({
        tournamentId: tournament.id,
        round: nextRoundNumber,
        matchFormat,
        scheduling: schedulingPayload(Math.ceil(field.length / 2)),
        allowConsecutiveRematch: allowRematch,
        maxMmrGap: useMmrSeeding ? pairingBand : null,
        teams,
        matches,
      });

      setDraftPairings(round.pairings.map(p => ({
        teamAId: p.teamAId, teamBId: p.teamBId, isBye: p.isBye,
      })));
      setDraftWarnings(warnings);
      setSelectedPairs(new Set());
      await reload();
      toast({ title: `Runda ${round.round} — podgląd gotowy`, description: 'Sprawdź parowania przed zatwierdzeniem.' });
    });

  /**
   * Swap two teams between pairings. Click one team, then another, and they trade
   * places. This is the real override for a legal-but-undesirable pairing.
   */
  const handleSwap = (teamId: string) => {
    if (!draftPairings) return;
    if (!swapFrom) { setSwapFrom(teamId); return; }
    if (swapFrom === teamId) { setSwapFrom(null); return; }

    const next = draftPairings.map(p => ({ ...p }));
    const locate = (id: string) => {
      for (let i = 0; i < next.length; i++) {
        if (next[i].teamAId === id) return { i, side: 'teamAId' as const };
        if (next[i].teamBId === id) return { i, side: 'teamBId' as const };
      }
      return null;
    };
    const a = locate(swapFrom);
    const b = locate(teamId);
    if (!a || !b) { setSwapFrom(null); return; }

    next[a.i][a.side] = teamId;
    next[b.i][b.side] = swapFrom;
    for (const p of next) {
      p.isBye = isSwissByeTeam(p.teamAId) || isSwissByeTeam(p.teamBId);
    }

    setDraftPairings(next);
    setSwapFrom(null);

    if (tournament?.id) {
      saveDraftPairings(tournament.id, nextRoundNumber, next).catch(err =>
        console.error('[SwissTab] saving swapped draft failed', err)
      );
    }
  };

  const handleCommit = () =>
    run('commit', async () => {
      if (!tournament?.id || !draftPairings) return;
      const scheduling = schedulingPayload(draftPairings.length);
      if (scheduling.mode === 'fixed') {
        const missing = draftPairings.filter((p, i) => !p.isBye && !scheduling.times?.[i]).length;
        if (missing) throw new Error(`Ustaw dzień i godzinę każdego meczu — bez terminu: ${missing}.`);
      }
      if (scheduling.mode === 'window' && (!windowStart || !windowEnd)) {
        throw new Error('Podaj początek i koniec okna terminowego.');
      }
      const res = await commitRound({
        tournamentId: tournament.id,
        round: nextRoundNumber,
        divisionId,
        matchFormat,
        scheduling,
        pairings: draftPairings,
        teamsById,
        adminUserId: user?.uid ?? 'admin',
      });
      setDraftPairings(null);
      setDraftWarnings([]);
      setTimes([]);
      setSelectedPairs(new Set());
      await reload();
      toast({
        title: `Runda ${nextRoundNumber} zatwierdzona`,
        description: `Utworzono ${res.created} meczów${res.byes ? `, w tym ${res.byes} wolny los` : ''}.`,
        action: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      });
    });

  const handleReopen = (round: number) =>
    run(`reopen:${round}`, async () => {
      if (!tournament?.id) return;
      if (!window.confirm(
        `Wycofać rundę ${round}? Wszystkie jej mecze zostaną usunięte, ` +
        `a parowania wrócą do podglądu.`
      )) return;
      const res = await reopenRound(tournament.id, round, divisionId);
      await reload();
      toast({ title: `Runda ${round} wycofana`, description: `Usunięto ${res.deleted} meczów.` });
    });

  const handleCloseRound = (round: number) =>
    run(`close:${round}`, async () => {
      if (!tournament?.id) return;
      await markRoundComplete(tournament.id, round);
      await reload();
      toast({ title: `Runda ${round} zamknięta`, description: 'Możesz wygenerować następną rundę.' });
    });

  const handleForce = (m: SwissRoundMatch, side: 'teamA' | 'teamB' | 'both') =>
    run(`force:${m.id}`, async () => {
      if (!tournament?.id) return;
      const who = side === 'both' ? 'obie drużyny' : nameOf(side === 'teamA' ? m.teamAId : m.teamBId);
      if (!window.confirm(`Przyznać walkower? Przegrywa: ${who}.`)) return;
      await forceMatchResult({
        tournamentId: tournament.id,
        matchId: m.id,
        matchFormat: (latestCommitted?.matchFormat ?? matchFormat),
        forfeitingTeam: side,
        teamAId: m.teamAId,
        teamBId: m.teamBId,
        reason: 'Mecz nierozegrany w terminie',
        adminUserId: user?.uid ?? 'admin',
      });
      await reload();
      toast({ title: 'Walkower przyznany' });
    });

  // ── render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground font-logik">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Ładowanie danych Swiss...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-logik-extended-bold">Liga szwajcarska</h2>
        <p className="text-sm text-muted-foreground font-logik">
          Rundy generowane są po kolei — parowania rundy N+1 zależą od wyników rundy N.
        </p>
      </div>

      {/* ── Setup ───────────────────────────────────────────────────────── */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <Users className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Pole turnieju
          </CardTitle>
          <CardDescription className="font-logik">
            Wszystkie drużyny Swiss trafiają do jednej grupy, dzięki czemu tabela i terminarz
            działają tak samo jak w innych trybach.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="font-logik">
              W polu: {field.length} {field.length % 2 === 1 && '(nieparzyste — będzie wolny los)'}
            </Badge>
            {unassigned.length > 0 && (
              <Badge variant="outline" className="font-logik text-amber-500 border-amber-500/40">
                Nieprzypisane: {unassigned.length}
              </Badge>
            )}
            {useMmrSeeding && missingSeeds.length > 0 && (
              <Badge variant="outline" className="font-logik text-amber-500 border-amber-500/40">
                Bez średniego MMR: {missingSeeds.length}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => handleSetup(false)}
              disabled={busy === 'setup'}
              style={{ backgroundColor: theme.primaryColor }}
            >
              {busy === 'setup'
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <RefreshCw className="h-4 w-4 mr-2" />}
              Przypisz zweryfikowane drużyny
            </Button>
            <Button variant="outline" onClick={() => handleSetup(true)} disabled={busy === 'setup'}>
              Przypisz wszystkie (także niezweryfikowane)
            </Button>
          </div>

          {/* Round-count guidance. Swiss stops paying for itself once rounds
              approach N/2, and past N-1 rounds rematches are unavoidable. */}
          {field.length >= 2 && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm font-logik space-y-1">
              <p className="flex items-center gap-2">
                <Info className="h-4 w-4 shrink-0" style={{ color: theme.primaryColor }} />
                Dla {field.length} drużyn zalecane <strong>{recommended}</strong> rund
                {plannedRounds != null && <> (zaplanowano {plannedRounds})</>}.
              </p>
              <p className="text-muted-foreground text-xs">
                Powyżej {rematchFreeCeiling} rund powtórki par są nieuniknione — każda drużyna ma
                tylko {rematchFreeCeiling} możliwych przeciwników. Przy ~{Math.ceil(field.length / 2)} rundach
                turniej zbliża się do systemu każdy z każdym.
              </p>
            </div>
          )}
        </CardContent>
      </Card>


      {/* ── Pairing band ────────────────────────────────────────────────── */}
      {useMmrSeeding && (
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <ArrowLeftRight className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Zakres MMR w parowaniu
          </CardTitle>
          <CardDescription className="font-logik">
            Opcjonalne ograniczenie: system nie zestawi ze sobą drużyn różniących się
            bardziej niż o podaną wartość. Zostaw puste, żeby nie stosować żadnego limitu.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* The concept is unfamiliar, so explain it rather than assume. */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm font-logik space-y-2">
            <p className="flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5" style={{ color: theme.primaryColor }} />
              <span>
                <strong>Jak to działa.</strong> Normalnie pary dobierane są wyłącznie według
                dorobku punktowego — dwie drużyny z tym samym wynikiem grają ze sobą, nawet
                jeśli dzieli je 3000 MMR. Zakres mówi systemowi, żeby takich par unikał.
              </span>
            </p>
            <p className="pl-6 text-muted-foreground text-xs">
              To nie jest sztywny zakaz. Jeśli drużyna nie ma <em>żadnego</em> przeciwnika
              w zakresie (bo jest np. najsilniejsza w stawce), dostanie najbliższego
              możliwego, a para zostanie oznaczona w podglądzie rundy.
            </p>
            <p className="pl-6 text-muted-foreground text-xs">
              Im węższy zakres, tym wyrównane mecze — ale i częstsze rewanże, bo pula
              dozwolonych przeciwników maleje. Przy ~1500 różnicy MMR wynik meczu jest
              w praktyce przesądzony, więc to naturalny punkt odniesienia.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="font-logik-extended-bold">Maksymalna różnica MMR</Label>
              <Input
                type="number"
                min={250}
                max={6000}
                step={250}
                placeholder="bez limitu"
                value={bandInput}
                onChange={e => setBandInput(e.target.value)}
                className="font-logik mt-1 w-44"
              />
            </div>
            <Button
              onClick={handleSaveBand}
              disabled={busy === 'band'}
              style={{ backgroundColor: theme.primaryColor }}
            >
              {busy === 'band'
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <Save className="h-4 w-4 mr-2" />}
              Zapisz zakres
            </Button>
            {pairingBand != null && (
              <Badge variant="outline" className="font-logik">aktywny: {pairingBand}</Badge>
            )}
          </div>

          {/* Suggestion computed from the teams that actually registered. */}
          {bandAdvice && (
            <div className="rounded-lg border border-border p-3 space-y-3">
              <p className="text-sm font-logik-extended-bold">
                Sugestia dla tej stawki
                {bandAdvice.suggested != null && (
                  <span className="ml-2 font-mono" style={{ color: theme.primaryColor }}>
                    {bandAdvice.suggested}
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground font-logik">{bandAdvice.reason}</p>

              <div className="overflow-x-auto">
                <table className="w-full text-xs font-logik">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="py-1.5 pr-3 font-normal">Zakres</th>
                      <th className="py-1.5 pr-3 font-normal text-right">Dozwolone pary</th>
                      <th className="py-1.5 pr-3 font-normal text-right">Usuwa pewniaków</th>
                      <th className="py-1.5 pr-3 font-normal text-right">Drużyn bez opcji</th>
                      <th className="py-1.5 pr-3 font-normal"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {bandAdvice.options.map(o => (
                      <tr key={o.band} className={cn(
                        'border-b border-border/50',
                        o.band === bandAdvice.suggested && 'bg-primary/5'
                      )}>
                        <td className="py-1.5 pr-3 font-mono">{o.band}</td>
                        <td className="py-1.5 pr-3 text-right font-mono">
                          {Math.round(o.pairingsAllowed * 100)}%
                        </td>
                        <td className="py-1.5 pr-3 text-right font-mono">
                          {Math.round(o.stompsRemoved * 100)}%
                        </td>
                        <td className="py-1.5 pr-3 text-right font-mono">
                          {o.isolatedTeams.length}
                        </td>
                        <td className="py-1.5 pr-3">
                          <button
                            onClick={() => setBandInput(String(o.band))}
                            className="text-xs hover:underline"
                            style={{ color: theme.primaryColor }}
                          >
                            wybierz
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {bandAdvice.outliers.length > 0 && (
                <p className="text-xs text-amber-500 font-logik flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    {bandAdvice.outliers.length === 1 ? 'Jedna drużyna jest' : `${bandAdvice.outliers.length} drużyny są`}
                    {' '}odizolowane — najbliższy rywal dzieli je o ponad 1500 MMR
                    ({bandAdvice.outliers.map(o => `${nameOf(o.teamId)} (${o.seedMmr})`).join(', ')}).
                    Żaden zakres im nie pomoże; zawsze dostaną najbliższego dostępnego przeciwnika.
                  </span>
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* ── Seeds ───────────────────────────────────────────────────────── */}
      {useMmrSeeding && (
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <Trophy className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Rozstawienie
          </CardTitle>
          <CardDescription className="font-logik">
            Średnie MMR jest zgłaszane przez kapitanów i widoczne tylko tutaj — publicznie
            pokazujemy wyłącznie numer rozstawienia. Popraw podejrzane wartości przed rundą 1.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {seedOrder.length === 0 && (
            <p className="text-sm text-muted-foreground font-logik">
              Brak drużyn w polu. Użyj „Przypisz drużyny” powyżej.
            </p>
          )}
          {seedOrder.map((t, i) => {
            const dirty = seedDrafts[t.id] !== undefined;
            return (
              <div key={t.id} className="flex items-center gap-3">
                <span className="w-10 text-sm text-muted-foreground font-mono">#{i + 1}</span>
                <span className="flex-1 font-logik truncate">{t.name}</span>
                <Input
                  type="number"
                  className="w-32 font-logik"
                  placeholder="brak"
                  value={dirty ? seedDrafts[t.id] : (t.seedMmr ?? '')}
                  onChange={e => setSeedDrafts(prev => ({ ...prev, [t.id]: e.target.value }))}
                />
                <Button
                  size="sm"
                  variant={dirty ? 'default' : 'ghost'}
                  disabled={!dirty || busy === `seed:${t.id}`}
                  onClick={() => handleSaveSeed(t.id)}
                  style={dirty ? { backgroundColor: theme.primaryColor } : undefined}
                >
                  {busy === `seed:${t.id}`
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Save className="h-4 w-4" />}
                </Button>
              </div>
            );
          })}
          {seedOrder.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => run('renumber', async () => {
                if (!tournament?.id) return;
                const n = await renumberSeeds(tournament.id);
                await reload();
                toast({ title: 'Rozstawienie przeliczone', description: `${n} drużyn.` });
              })}
              disabled={busy === 'renumber'}
            >
              <Shuffle className="h-4 w-4 mr-2" /> Przelicz numery rozstawienia
            </Button>
          )}
        </CardContent>
      </Card>
      )}

      {/* ── Open matches blocking the next round ────────────────────────── */}
      {openMatchesInLatestRound.length > 0 && (
        <Card className="border-0 shadow-lg bg-amber-500/5 border-l-4 border-l-amber-500">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 font-logik-extended-bold text-amber-500">
              <Lock className="h-5 w-5" />
              Runda {latestCommitted?.round} nie jest zakończona
            </CardTitle>
            <CardDescription className="font-logik">
              Swiss jest sekwencyjny — dopóki te mecze nie mają wyniku, nie da się wygenerować
              następnej rundy. Jeśli drużyna nie stawiła się w terminie, przyznaj walkower.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {openMatchesInLatestRound.map(m => (
              <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
                <span className="flex-1 font-logik text-sm">
                  {nameOf(m.teamAId)} <span className="text-muted-foreground">vs</span> {nameOf(m.teamBId)}
                  {m.scheduledFor && (
                    <span className="text-muted-foreground text-xs ml-2">
                      {new Date(m.scheduledFor).toLocaleString('pl-PL')}
                    </span>
                  )}
                </span>
                <Button size="sm" variant="outline" disabled={busy === `force:${m.id}`}
                  onClick={() => handleForce(m, 'teamB')}>
                  <Gavel className="h-3.5 w-3.5 mr-1.5" /> Wygrywa {nameOf(m.teamAId)}
                </Button>
                <Button size="sm" variant="outline" disabled={busy === `force:${m.id}`}
                  onClick={() => handleForce(m, 'teamA')}>
                  <Gavel className="h-3.5 w-3.5 mr-1.5" /> Wygrywa {nameOf(m.teamBId)}
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive"
                  disabled={busy === `force:${m.id}`} onClick={() => handleForce(m, 'both')}>
                  Podwójny walkower
                </Button>
              </div>
            ))}
            {latestCommitted && (
              <Button variant="outline" size="sm"
                onClick={() => handleCloseRound(latestCommitted.round)}
                disabled={busy === `close:${latestCommitted.round}`}>
                <Unlock className="h-4 w-4 mr-2" />
                Zamknij rundę mimo to
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Round builder ───────────────────────────────────────────────── */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <Play className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Runda {nextRoundNumber}
          </CardTitle>
          <CardDescription className="font-logik">
            Wygeneruj podgląd, sprawdź parowania, w razie potrzeby zamień drużyny miejscami,
            a potem zatwierdź.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="font-logik-extended-bold">Format meczów</Label>
              <Select value={matchFormat} onValueChange={v => setMatchFormat(v as MatchFormat)}>
                <SelectTrigger className="font-logik mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MATCH_FORMATS.map(f => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label} — max {f.maxPoints} pkt
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Points are games won, so the format sets how much a round is worth. */}
              <p className="text-xs text-muted-foreground mt-1 font-logik">
                Punkty = wygrane mapy. Ten format daje maksymalnie{' '}
                {MATCH_FORMATS.find(f => f.value === matchFormat)?.maxPoints} pkt za rundę.
              </p>
              {latestCommitted && latestCommitted.matchFormat !== matchFormat && (
                <p className="text-xs text-amber-500 mt-1 font-logik flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  Poprzednia runda była w {latestCommitted.matchFormat.toUpperCase()} — różne formaty
                  oznaczają, że rundy mają różną wagę punktową.
                </p>
              )}
            </div>

            <div>
              <Label className="font-logik-extended-bold">Terminy</Label>
              <Select value={schedulingMode} onValueChange={v => { schedulingDirty.current = true; setSchedulingMode(v as SchedulingMode); }}>
                <SelectTrigger className="font-logik mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Organizator ustala termin każdego meczu</SelectItem>
                  <SelectItem value="window">Kapitanowie umawiają się w oknie (z deadline)</SelectItem>
                  <SelectItem value="free">Kapitanowie umawiają się dowolnie (bez deadline)</SelectItem>
                </SelectContent>
              </Select>

              {schedulingMode === 'fixed' && (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-muted-foreground font-logik">
                    Dzień i godzinę ustawisz przy każdej parze po wygenerowaniu podglądu — pojedynczo
                    albo jednym terminem dla kilku zaznaczonych meczów.
                  </p>
                  <label className="flex flex-wrap items-center gap-2 text-sm font-logik">
                    Kapitanowie mogą przełożyć mecz na dowolny wcześniejszy termin albo najwyżej o
                    <Input type="number" min={0} max={72} step={1} className="w-20 h-8 font-logik"
                      value={maxHoursLater}
                      onChange={e => { schedulingDirty.current = true; setMaxHoursLater(e.target.value); }} />
                    h później.
                  </label>
                  <p className="text-xs text-muted-foreground font-logik">
                    0 = tylko na wcześniej. Puste = bez limitu godzin (obowiązują wtedy ogólne zasady
                    przekładania z zakładki terminarza). Zmiana terminu wymaga zgody drugiego kapitana.
                  </p>
                </div>
              )}
              {schedulingMode === 'window' && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Input type="date" className="font-logik" value={windowStart}
                    onChange={e => { schedulingDirty.current = true; setWindowStart(e.target.value); }} />
                  <Input type="date" className="font-logik" value={windowEnd}
                    onChange={e => { schedulingDirty.current = true; setWindowEnd(e.target.value); }} />
                </div>
              )}
              {schedulingMode === 'free' && (
                <p className="text-xs text-amber-500 mt-2 font-logik flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  Bez deadline jedna niereagująca drużyna zablokuje całą kolejną rundę.
                </p>
              )}
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded border-border"
              checked={allowRematch} onChange={e => setAllowRematch(e.target.checked)} />
            <span className="text-sm font-logik">
              Pozwól na powtórzenie pary z poprzedniej rundy
              <span className="text-muted-foreground"> — potrzebne tylko przy bardzo małym polu</span>
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleGenerate}
              // Regenerating an existing draft is always allowed; only a *new*
              // round is gated on the previous one being finished.
              disabled={busy === 'generate' || (!canGenerateNext && !draftRound)}
              style={{ backgroundColor: theme.primaryColor }}>
              {busy === 'generate'
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <Shuffle className="h-4 w-4 mr-2" />}
              {draftPairings ? 'Wygeneruj ponownie' : 'Wygeneruj podgląd'}
            </Button>
            {draftPairings && (
              <Button onClick={handleCommit} disabled={busy === 'commit'} variant="default">
                {busy === 'commit'
                  ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Zatwierdź rundę {nextRoundNumber}
              </Button>
            )}
          </div>

          {!canGenerateNext && !draftRound && (
            <p className="text-sm text-muted-foreground font-logik">
              {field.length < 2
                ? 'Potrzebne są co najmniej 2 drużyny w polu.'
                : 'Zakończ poprzednią rundę, aby wygenerować następną.'}
            </p>
          )}

          {draftWarnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-1">
              {draftWarnings.map((w, i) => (
                <p key={i} className="text-sm text-amber-500 font-logik flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {w}
                </p>
              ))}
            </div>
          )}

          {/* Pairing preview. Click two teams to swap them between pairs. */}
          {draftPairings && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-logik">
                Kliknij drużynę, a potem drugą, aby zamienić je miejscami.
                {swapFrom && <> Wybrano: <strong>{nameOf(swapFrom)}</strong> — kliknij drugą drużynę.</>}
              </p>
              {schedulingMode === 'fixed' && (() => {
                const realPairs = draftPairings.flatMap((p, i) => (p.isBye ? [] : [i]));
                const allSelected = realPairs.length > 0 && realPairs.every(i => selectedPairs.has(i));
                const unset = realPairs.filter(i => !times[i]).length;
                return (
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
                    <label className="flex items-center gap-2 text-sm font-logik cursor-pointer">
                      <input type="checkbox" className="w-4 h-4" checked={allSelected}
                        onChange={() => setSelectedPairs(allSelected ? new Set() : new Set(realPairs))} />
                      Zaznacz wszystkie
                    </label>
                    <span className="text-xs text-muted-foreground font-logik">Zaznaczono: {selectedPairs.size}</span>
                    <Input type="datetime-local" className="w-[220px] h-9 font-logik" aria-label="Termin dla zaznaczonych"
                      value={bulkAt} onChange={e => setBulkAt(e.target.value)} />
                    <Button size="sm" variant="outline" onClick={applyBulkTime}
                      disabled={!bulkAt || selectedPairs.size === 0}>
                      Ustaw dla zaznaczonych
                    </Button>
                    <span className={cn('ml-auto text-xs font-logik', unset ? 'text-amber-500' : 'text-green-500')}>
                      {unset ? `Bez terminu: ${unset} z ${realPairs.length}` : 'Wszystkie mecze mają termin'}
                    </span>
                  </div>
                );
              })()}
              {draftPairings.map((p, i) => {
                const gap = Math.abs(pointsOf(p.teamAId) - pointsOf(p.teamBId));
                const mmrA = seedOf(p.teamAId);
                const mmrB = seedOf(p.teamBId);
                const mmrGap = mmrA != null && mmrB != null ? Math.abs(mmrA - mmrB) : null;
                return (
                  <div key={i} className={cn(
                    'flex flex-wrap items-center gap-2 rounded-lg border p-3',
                    p.isBye ? 'border-dashed border-border bg-muted/20' : 'border-border'
                  )}>
                    {schedulingMode === 'fixed' && (
                      <input type="checkbox" className="w-4 h-4" disabled={p.isBye}
                        aria-label={`Zaznacz mecz ${i + 1}`}
                        checked={!p.isBye && selectedPairs.has(i)} onChange={() => togglePair(i)} />
                    )}
                    <span className="w-8 text-xs text-muted-foreground font-mono">{i + 1}</span>
                    {[p.teamAId, p.teamBId].map(id => (
                      <button key={id} onClick={() => handleSwap(id)}
                        className={cn(
                          'px-2 py-1 rounded font-logik text-sm transition-colors',
                          swapFrom === id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                          isSwissByeTeam(id) && 'italic text-muted-foreground'
                        )}>
                        {nameOf(id)}
                        <span className="text-xs text-muted-foreground ml-1.5">
                          {pointsOf(id)} pkt{useMmrSeeding && seedOf(id) != null && ` · ${seedOf(id)}`}
                        </span>
                      </button>
                    ))}
                    {!p.isBye && (
                      <span className="text-xs text-muted-foreground ml-auto font-logik">
                        Δ {gap} pkt{useMmrSeeding && mmrGap != null && ` · Δ ${mmrGap} MMR`}
                      </span>
                    )}
                    {!p.isBye && schedulingMode === 'fixed' && (
                      <Input type="datetime-local" aria-label={`Termin meczu ${i + 1}`}
                        className={cn('w-[220px] h-9 font-logik', !times[i] && 'border-amber-500/60')}
                        value={times[i] ?? ''} onChange={e => setTime(i, e.target.value)} />
                    )}
                    {p.isBye && (
                      <Badge variant="outline" className="ml-auto font-logik text-xs">
                        wolny los — walkower
                      </Badge>
                    )}
                    {!p.isBye && useMmrSeeding && pairingBand != null
                      && mmrGap != null && mmrGap > pairingBand && (
                      <Badge variant="outline"
                        className="font-logik text-xs text-amber-500 border-amber-500/40">
                        poza zakresem
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Committed rounds ───────────────────────────────────────────── */}
      {committedRounds.length > 0 && (
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="font-logik-extended-bold">Rozegrane rundy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {committedRounds.map(r => {
              const roundMatches = matches.filter(m => m.round === r.round);
              const done = roundMatches.filter(m => m.status === 'completed').length;
              return (
                <div key={r.round} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                  <span className="font-logik-extended-bold">Runda {r.round}</span>
                  <Badge variant="outline" className="font-logik text-xs">
                    {r.matchFormat.toUpperCase()}
                  </Badge>
                  <Badge variant="outline" className={cn(
                    'font-logik text-xs',
                    r.status === 'complete' && 'text-green-500 border-green-500/40'
                  )}>
                    {r.status === 'complete' ? 'zamknięta' : 'w trakcie'}
                  </Badge>
                  <span className="text-sm text-muted-foreground font-logik">
                    {done}/{roundMatches.length} meczów z wynikiem
                  </span>
                  <div className="ml-auto flex gap-2">
                    {r.status !== 'complete' && done === roundMatches.length && (
                      <Button size="sm" variant="outline" disabled={busy === `close:${r.round}`}
                        onClick={() => handleCloseRound(r.round)}>
                        <Lock className="h-3.5 w-3.5 mr-1.5" /> Zamknij
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-destructive"
                      disabled={busy === `reopen:${r.round}`}
                      onClick={() => handleReopen(r.round)}>
                      <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" /> Wycofaj
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ── Live table ─────────────────────────────────────────────────── */}
      {standings.length > 0 && (
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="font-logik-extended-bold">Tabela</CardTitle>
            <CardDescription className="font-logik">
              Punkty = wygrane mapy. Buchholz = suma punktów przeciwników (siła terminarza).
              Kolejność jest poglądowa — awans do playoffów ustawiasz ręcznie w zakładce Playoffs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-logik">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3 font-normal">#</th>
                    <th className="py-2 pr-3 font-normal">Drużyna</th>
                    <th className="py-2 pr-3 font-normal text-right">Pkt</th>
                    <th className="py-2 pr-3 font-normal text-right">W-P</th>
                    <th className="py-2 pr-3 font-normal text-right">Mapy</th>
                    <th className="py-2 pr-3 font-normal text-right">Buchholz</th>
                    <th className="py-2 pr-3 font-normal text-right">Wolne losy</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row: SwissStandingRow, i) => {
                    const bye = isSwissByeTeam(row.teamId);
                    return (
                      <tr key={row.teamId} className={cn(
                        'border-b border-border/50',
                        bye && 'opacity-50 italic'
                      )}>
                        <td className="py-2 pr-3 font-mono text-muted-foreground">
                          {bye ? '—' : i + 1}
                        </td>
                        <td className="py-2 pr-3">{nameOf(row.teamId)}</td>
                        <td className="py-2 pr-3 text-right font-mono">{row.points}</td>
                        <td className="py-2 pr-3 text-right font-mono text-muted-foreground">
                          {row.matchWins}-{row.matchLosses}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-muted-foreground">
                          {row.gamesWon}:{row.gamesLost}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-muted-foreground">
                          {bye ? '—' : row.buchholz}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-muted-foreground">
                          {bye ? '—' : (row.byeCount || '')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
