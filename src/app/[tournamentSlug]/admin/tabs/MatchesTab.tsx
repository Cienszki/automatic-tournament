"use client";

import React, { useState, useEffect } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc, collection, writeBatch, deleteDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Match, DraftPenalty, DraftPenaltyLevel } from '@/lib/definitions';
import { DRAFT_PENALTY_LEVELS } from '@/lib/definitions';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  Gamepad2,
  Save,
  RotateCcw,
  RefreshCw,
  Search,
  Edit2,
  Trash2,
  Upload,
  Plus,
  Calendar,
  Clock,
  ExternalLink,
  FileDown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Eye,
  Flag,
  Layers,
  Ban,
  CalendarClock,
  Gavel,
} from 'lucide-react';

interface MatchWithTeamNames extends Match {
  teamAName: string;
  teamBName: string;
}

interface SkippedGame {
  gameId: string;
  reason: string;
  skippedAt: string;
  skippedBy: string;
}

/**
 * Matches Tab - Score editing, game deletion, match import, reschedule
 */
export function MatchesTab() {
  const { tournament, theme, refetchTournament } = useTournament();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [matches, setMatches] = useState<MatchWithTeamNames[]>([]);
  const [divisionsMap, setDivisionsMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [matchIdToImport, setMatchIdToImport] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingMatch, setEditingMatch] = useState<MatchWithTeamNames | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [matchToDelete, setMatchToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isPostSyncRecalculating, setIsPostSyncRecalculating] = useState(false);

  // Force Import state
  const [showForceImportDialog, setShowForceImportDialog] = useState(false);
  const [forceImportGameId, setForceImportGameId] = useState('');
  const [forceImportPreview, setForceImportPreview] = useState<{
    matchId: number; startTime: number; duration: number;
    radiantLobbyName: string | null; direLobbyName: string | null;
    radiantScore: number; direScore: number;
    isParsed: boolean; alreadyProcessed: boolean;
  } | null>(null);
  const [forceImportPreviewError, setForceImportPreviewError] = useState('');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [forceImportMatchId, setForceImportMatchId] = useState('');
  const [forceImportRadiantTeamId, setForceImportRadiantTeamId] = useState('');
  const [forceImportDireTeamId, setForceImportDireTeamId] = useState('');
  const [isForceImporting, setIsForceImporting] = useState(false);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]); // all tournament teams for selects
  // When opened from a per-row button this holds the match so we can pre-fill and restrict team selects
  const [forceImportContextMatch, setForceImportContextMatch] = useState<MatchWithTeamNames | null>(null);

  // Revert forfeit state
  const [showRevertForfeitDialog, setShowRevertForfeitDialog] = useState(false);
  const [revertForfeitMatch, setRevertForfeitMatch] = useState<MatchWithTeamNames | null>(null);
  const [isRevertingForfeit, setIsRevertingForfeit] = useState(false);

  // Forfeit / Walkover state
  const [showForfeitDialog, setShowForfeitDialog] = useState(false);
  const [forfeitMatch, setForfeitMatch] = useState<MatchWithTeamNames | null>(null);
  const [forfeitingTeam, setForfeitingTeam] = useState<'teamA' | 'teamB'>('teamA');
  const [forfeitScope, setForfeitScope] = useState<'series' | 'games'>('series');
  const [forfeitedGames, setForfeitedGames] = useState<number[]>([]);
  const [forfeitReason, setForfeitReason] = useState('');
  const [isForfeitSaving, setIsForfeitSaving] = useState(false);

  // Force schedule state
  const [showForceScheduleDialog, setShowForceScheduleDialog] = useState(false);
  const [forceScheduleMatch, setForceScheduleMatch] = useState<MatchWithTeamNames | null>(null);
  const [forceScheduleDateTime, setForceScheduleDateTime] = useState('');
  const [forceScheduleReason, setForceScheduleReason] = useState('');
  const [isForceScheduling, setIsForceScheduling] = useState(false);

  // Draft penalty state
  const [penaltyMatch, setPenaltyMatch] = useState<MatchWithTeamNames | null>(null);
  const [penaltyTeamA, setPenaltyTeamA] = useState(false);
  const [penaltyTeamB, setPenaltyTeamB] = useState(false);
  const [penaltyScope, setPenaltyScope] = useState<'series' | 'games'>('series');
  const [penaltyGames, setPenaltyGames] = useState<number[]>([]);
  const [penaltyLevel, setPenaltyLevel] = useState<DraftPenaltyLevel>(1);
  const [penaltyReason, setPenaltyReason] = useState('');
  const [isIssuingPenalty, setIsIssuingPenalty] = useState(false);

  // Games management dialog state
  const [showGamesDialog, setShowGamesDialog] = useState(false);
  const [gamesDialogMatch, setGamesDialogMatch] = useState<MatchWithTeamNames | null>(null);
  const [isDeletingGame, setIsDeletingGame] = useState(false);
  const [deletingGameId, setDeletingGameId] = useState<number | null>(null);
  const [confirmDeleteGameId, setConfirmDeleteGameId] = useState<number | null>(null);

  // Skipped games state
  const [skippedGames, setSkippedGames] = useState<SkippedGame[]>([]);
  const [loadingSkipped, setLoadingSkipped] = useState(true);
  const [showAddSkippedDialog, setShowAddSkippedDialog] = useState(false);
  const [newSkippedGameId, setNewSkippedGameId] = useState('');
  const [newSkippedReason, setNewSkippedReason] = useState('');
  const [isAddingSkipped, setIsAddingSkipped] = useState(false);
  const [removingSkippedId, setRemovingSkippedId] = useState<string | null>(null);

  // Load matches and skipped games from Firestore
  useEffect(() => {
    loadMatches();
    loadSkippedGames();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament?.id]);

  const loadSkippedGames = async () => {
    if (!tournament?.id || !user) {
      setLoadingSkipped(false);
      return;
    }
    try {
      setLoadingSkipped(true);
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/pdl/skipped-games?tournamentId=${tournament.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setSkippedGames(data.games);
      }
    } catch (error) {
      console.error('Error loading skipped games:', error);
    } finally {
      setLoadingSkipped(false);
    }
  };

  const handleAddSkippedGame = async () => {
    if (!tournament?.id || !user || !newSkippedGameId.trim()) return;
    setIsAddingSkipped(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/pdl/skipped-games', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: tournament.id,
          gameId: newSkippedGameId.trim(),
          reason: newSkippedReason.trim() || 'Manually skipped by admin',
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Gra oznaczona jako pominięta', description: `ID: ${data.gameId}` });
        setShowAddSkippedDialog(false);
        setNewSkippedGameId('');
        setNewSkippedReason('');
        await loadSkippedGames();
      } else {
        toast({ title: 'Błąd', description: data.error || 'Nie udało się pominąć gry', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Błąd połączenia z serwerem', variant: 'destructive' });
    } finally {
      setIsAddingSkipped(false);
    }
  };

  const handleRemoveSkippedGame = async (gameId: string) => {
    if (!tournament?.id || !user) return;
    setRemovingSkippedId(gameId);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/pdl/skipped-games', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: tournament.id, gameId }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Usunięto z listy pominiętych' });
        await loadSkippedGames();
      } else {
        toast({ title: 'Błąd', description: data.error || 'Nie udało się usunąć', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Błąd połączenia z serwerem', variant: 'destructive' });
    } finally {
      setRemovingSkippedId(null);
    }
  };

  const loadMatches = async () => {
    if (!tournament?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Load teams first to get team names
      const teamsRef = collection(db, 'tournaments', tournament.id, 'teams');
      const teamsSnapshot = await getDocs(teamsRef);
      const teamsMap = new Map<string, string>();
      
      teamsSnapshot.docs.forEach(doc => {
        teamsMap.set(doc.id, doc.data().name || doc.id);
      });

      // Load divisions/groups to resolve names
      const divisionsRef = collection(db, 'tournaments', tournament.id, 'divisions');
      const divisionsSnapshot = await getDocs(divisionsRef);
      const newDivisionsMap = new Map<string, string>();
      divisionsSnapshot.docs.forEach(divDoc => {
        newDivisionsMap.set(divDoc.id, divDoc.data().name || divDoc.id);
      });
      setDivisionsMap(newDivisionsMap);

      // Also expose teams list for force import selects
      setTeams(teamsSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name || doc.id })));

      // Load matches
      const matchesRef = collection(db, 'tournaments', tournament.id, 'matches');
      const q = query(matchesRef, orderBy('scheduledFor', 'desc'));
      const matchesSnapshot = await getDocs(q);

      const loadedMatches: MatchWithTeamNames[] = matchesSnapshot.docs.map(doc => {
        const data = doc.data() as Match;
        return {
          ...data,
          id: doc.id,
          teamAName: teamsMap.get(data.teamA?.id || '') || data.teamA?.name || 'Unknown Team',
          teamBName: teamsMap.get(data.teamB?.id || '') || data.teamB?.name || 'Unknown Team',
        };
      });

      setMatches(loadedMatches);
    } catch (error) {
      console.error('Error loading matches:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się załadować meczów',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!tournament?.id) {
      toast({
        title: 'Błąd',
        description: 'Nie znaleziono ID turnieju',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      
      // Update match scores
      matches.forEach(match => {
        const matchRef = doc(db, 'tournaments', tournament.id, 'matches', match.id);
        batch.update(matchRef, {
          'teamA.score': match.teamA.score,
          'teamB.score': match.teamB.score,
          status: match.status,
          updatedAt: new Date().toISOString(),
        });
      });

      await batch.commit();

      toast({
        title: 'Zapisano',
        description: 'Wyniki meczów zostały zaktualizowane',
      });

      await refetchTournament();
      await loadMatches();
    } catch (error) {
      console.error('Error saving matches:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się zapisać wyników. Spróbuj ponownie.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreviewForceImport = async () => {
    if (!tournament?.id || !user || !forceImportGameId.trim()) return;

    setIsPreviewing(true);
    setForceImportPreview(null);
    setForceImportPreviewError('');

    // Extract numeric ID if full URL pasted
    const rawId = forceImportGameId.trim();
    const numericId = rawId.replace(/.*\/matches\//, '').replace(/[^0-9]/g, '');

    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/pdl/preview-game', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: tournament.id, openDotaGameId: Number(numericId) }),
      });
      const data = await res.json();
      if (data.success) {
        setForceImportPreview(data.preview);
        // If only one side has a wrong name, pre-fill the correct match
        // (admin will adjust as needed)
      } else {
        setForceImportPreviewError(data.error || 'Nie udało się pobrać danych gry.');
      }
    } catch {
      setForceImportPreviewError('Błąd połączenia z serwerem.');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleForceImport = async () => {
    if (!tournament?.id || !user || !forceImportPreview) return;
    if (!forceImportMatchId || !forceImportRadiantTeamId || !forceImportDireTeamId) {
      toast({ title: 'Uzupełnij wszystkie pola', variant: 'destructive' });
      return;
    }
    if (forceImportRadiantTeamId === forceImportDireTeamId) {
      toast({ title: 'Radiant i Dire nie mogą być tą samą drużyną', variant: 'destructive' });
      return;
    }

    setIsForceImporting(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/pdl/force-import-game', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: tournament.id,
          openDotaGameId: forceImportPreview.matchId,
          tournamentMatchId: forceImportMatchId,
          radiantTeamId: forceImportRadiantTeamId,
          direTeamId: forceImportDireTeamId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Import zakończony', description: data.message });
        setShowForceImportDialog(false);
        resetForceImportDialog();
        await loadMatches();
        // Automatically recalculate standings and stats after force-import
        await runPostSyncRecalculation(token);
      } else {
        toast({ title: 'Błąd importu', description: data.message || data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Błąd połączenia z serwerem', variant: 'destructive' });
    } finally {
      setIsForceImporting(false);
    }
  };

  const resetForceImportDialog = () => {
    setForceImportGameId('');
    setForceImportPreview(null);
    setForceImportPreviewError('');
    setForceImportMatchId('');
    setForceImportRadiantTeamId('');
    setForceImportDireTeamId('');
    setForceImportContextMatch(null);
  };

  /** Open the force-import dialog pre-filled for a specific match row. */
  const openForceImportForMatch = (match: MatchWithTeamNames) => {
    resetForceImportDialog();
    setForceImportContextMatch(match);
    setForceImportMatchId(match.id);
    // Pre-populate sides: teamA = Radiant, teamB = Dire (admin can swap via the selects)
    const teamAId = match.teamA?.id || '';
    const teamBId = match.teamB?.id || '';
    setForceImportRadiantTeamId(teamAId);
    setForceImportDireTeamId(teamBId);
    setShowForceImportDialog(true);
  };

  /**
   * After a successful match sync or force-import, automatically recalculate
   * division standings and player/team statistics.
   */
  const runPostSyncRecalculation = async (token: string) => {
    if (!tournament?.id) return;
    setIsPostSyncRecalculating(true);
    const isLeague = tournament.type === 'league';
    try {
      // 1a. Recalculate division standings (league/PDL tournaments only)
      let standingsData: { success: boolean; error?: string } = { success: true };
      if (isLeague) {
        const standingsRes = await fetch('/api/admin/pdl/recalculate-standings', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ tournamentId: tournament.id }),
        });
        standingsData = await standingsRes.json().catch(() => ({ success: false, error: 'Invalid response (timeout?)' }));
        if (!standingsData.success) {
          console.warn('[Post-sync] PDL standings recalculation failed:', standingsData.error);
        }
      }

      // 1b. MMR-limited tournaments calculate group standings on-the-fly from subcollection data.
      // The legacy /api/admin/recalculateStandings endpoint only knows about the OLD root `groups`
      // collection (Letnia data) and must NOT be called here — doing so resets and corrupts legacy data.
      const groupStandingsData: { success: boolean; error?: string } = { success: true };

      // 2. Recalculate player/team stats
      const statsRes = await fetch('/api/stats/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: tournament.id }),
      });
      const statsData = await statsRes.json().catch(() => ({ success: false, message: 'Invalid response (timeout?)' }));
      if (!statsData.success) {
        console.warn('[Post-sync] Stats recalculation failed:', statsData.message);
      }

      if (standingsData.success && groupStandingsData.success && statsData.success) {
        toast({ title: 'Tabele i statystyki zaktualizowane', description: 'Tabele i statystyki zostały automatycznie przeliczone.' });
      } else {
        const failParts: string[] = [];
        if (!standingsData.success) failParts.push(`Standings: ${standingsData.error || 'unknown'}`);
        if (!statsData.success) failParts.push(`Stats: ${statsData.message || statsData.error || 'unknown'}`);
        toast({
          title: 'Częściowa aktualizacja',
          description: `Sync OK, recalc failed: ${failParts.join(' | ')}`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('[Post-sync] Recalculation error:', error);
      toast({
        title: 'Błąd przeliczania',
        description: 'Mecze zostały zsynchronizowane, ale nie udało się automatycznie przeliczyć tabel i statystyk.',
        variant: 'destructive',
      });
    } finally {
      setIsPostSyncRecalculating(false);
    }
  };

  const handleSyncMatches = async () => {
    if (!tournament?.id || !user) return;

    setIsSyncing(true);
    setSyncResult(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/pdl/sync-matches', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tournamentId: tournament.id }),
      });

      const data = await response.json();

      if (data.success) {
        setSyncResult({ success: true, message: data.message || 'Synchronizacja zakończona pomyślnie.' });
        toast({
          title: 'Synchronizacja zakończona',
          description: `Zaimportowano: ${data.importedCount ?? 0}, Pominięto: ${data.skippedCount ?? 0}, Nieprzeparsowane: ${data.unparsedCount ?? 0}`,
        });
        // Reload matches to show new data
        await loadMatches();
        // Always recalculate standings and stats after sync
        await runPostSyncRecalculation(token);
      } else {
        setSyncResult({ success: false, message: data.error || 'Synchronizacja nie powiodła się.' });
        toast({
          title: 'Błąd synchronizacji',
          description: data.error || 'Nie udało się zsynchronizować meczów.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error syncing matches:', error);
      setSyncResult({ success: false, message: 'Błąd połączenia z serwerem.' });
      toast({
        title: 'Błąd',
        description: 'Nie udało się połączyć z serwerem synchronizacji.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportMatch = async () => {
    if (!matchIdToImport) return;
    setIsImporting(true);
    // TODO: Implement match import from OpenDota
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsImporting(false);
    setShowImportDialog(false);
    setMatchIdToImport('');
  };

  const updateMatchScore = (matchId: string, team: 'teamA' | 'teamB', score: number) => {
    setMatches(matches.map(m => {
      if (m.id === matchId) {
        return {
          ...m,
          [team]: {
            ...m[team],
            score: Math.max(0, Math.min(3, score)) // Clamp between 0-3
          }
        };
      }
      return m;
    }));
  };

  const confirmDeleteMatch = (matchId: string) => {
    setMatchToDelete(matchId);
    setShowDeleteDialog(true);
  };

  // ─── Draft penalty handlers ─────────────────────────────────────────────
  const gamesInMatch = (m: MatchWithTeamNames): number =>
    m.bestOf || (m.series_format === 'bo5' ? 5 : m.series_format === 'bo3' ? 3 : m.series_format === 'bo2' ? 2 : 1);

  const openPenaltyDialog = (match: MatchWithTeamNames) => {
    setPenaltyMatch(match);
    setPenaltyTeamA(false);
    setPenaltyTeamB(false);
    setPenaltyScope('series');
    setPenaltyGames([]);
    setPenaltyLevel(1);
    setPenaltyReason('');
  };

  const togglePenaltyGame = (g: number) => {
    setPenaltyGames((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g].sort((a, b) => a - b)));
  };

  const issuePenalty = async () => {
    if (!penaltyMatch || !tournament?.id || !user) return;
    const teamIds: string[] = [];
    if (penaltyTeamA && penaltyMatch.teamA?.id) teamIds.push(penaltyMatch.teamA.id);
    if (penaltyTeamB && penaltyMatch.teamB?.id) teamIds.push(penaltyMatch.teamB.id);
    if (teamIds.length === 0) {
      toast({ title: 'Wybierz drużynę', description: 'Zaznacz przynajmniej jedną drużynę.', variant: 'destructive' });
      return;
    }
    const games = penaltyScope === 'series' ? [] : [...penaltyGames].sort((a, b) => a - b);
    if (penaltyScope === 'games' && games.length === 0) {
      toast({ title: 'Wybierz gry', description: 'Zaznacz gry lub wybierz całą serię.', variant: 'destructive' });
      return;
    }
    setIsIssuingPenalty(true);
    try {
      const now = new Date().toISOString();
      const newPenalties: DraftPenalty[] = teamIds.map((teamId) => ({
        id: `${teamId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        teamId,
        games,
        level: penaltyLevel,
        ...(penaltyReason.trim() ? { reason: penaltyReason.trim() } : {}),
        issuedAt: now,
        issuedBy: user.uid,
      }));
      const updated = [...(penaltyMatch.draftPenalties ?? []), ...newPenalties];
      await updateDoc(doc(db, 'tournaments', tournament.id, 'matches', penaltyMatch.id), { draftPenalties: updated });
      setMatches((ms) => ms.map((m) => (m.id === penaltyMatch.id ? { ...m, draftPenalties: updated } : m)));
      setPenaltyMatch((prev) => (prev ? { ...prev, draftPenalties: updated } : prev));
      toast({ title: 'Kara nałożona', description: 'Kara draftu została zapisana.' });
      setPenaltyTeamA(false);
      setPenaltyTeamB(false);
      setPenaltyScope('series');
      setPenaltyGames([]);
      setPenaltyLevel(1);
      setPenaltyReason('');
    } catch (e) {
      console.error('Failed to issue draft penalty:', e);
      toast({ title: 'Błąd', description: 'Nie udało się nałożyć kary.', variant: 'destructive' });
    } finally {
      setIsIssuingPenalty(false);
    }
  };

  const removePenalty = async (penaltyId: string) => {
    if (!penaltyMatch || !tournament?.id) return;
    const updated = (penaltyMatch.draftPenalties ?? []).filter((p) => p.id !== penaltyId);
    try {
      await updateDoc(doc(db, 'tournaments', tournament.id, 'matches', penaltyMatch.id), { draftPenalties: updated });
      setMatches((ms) => ms.map((m) => (m.id === penaltyMatch.id ? { ...m, draftPenalties: updated } : m)));
      setPenaltyMatch((prev) => (prev ? { ...prev, draftPenalties: updated } : prev));
      toast({ title: 'Kara usunięta' });
    } catch (e) {
      console.error('Failed to remove draft penalty:', e);
      toast({ title: 'Błąd', description: 'Nie udało się usunąć kary.', variant: 'destructive' });
    }
  };

  const deleteMatch = async () => {
    if (!matchToDelete || !tournament?.id) return;

    setIsDeleting(true);
    try {
      const matchRef = doc(db, 'tournaments', tournament.id, 'matches', matchToDelete);
      await deleteDoc(matchRef);

      toast({
        title: 'Usunięto',
        description: 'Mecz został usunięty',
      });

      await loadMatches();
      setShowDeleteDialog(false);
      setMatchToDelete(null);
    } catch (error) {
      console.error('Error deleting match:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się usunąć meczu',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteAllMatches = async () => {
    if (!tournament?.id) return;
    setIsDeletingAll(true);
    try {
      const matchesRef = collection(db, 'tournaments', tournament.id, 'matches');
      const snapshot = await getDocs(matchesRef);
      const batch = writeBatch(db);
      snapshot.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      toast({ title: 'Usunięto wszystkie mecze', description: `Usunięto ${snapshot.size} meczów.` });
      await loadMatches();
      setShowDeleteAllDialog(false);
    } catch (error) {
      console.error('Error deleting all matches:', error);
      toast({ title: 'Błąd', description: 'Nie udało się usunąć meczów.', variant: 'destructive' });
    } finally {
      setIsDeletingAll(false);
    }
  };

  const openGamesDialog = (match: MatchWithTeamNames) => {
    setGamesDialogMatch(match);
    setConfirmDeleteGameId(null);
    setShowGamesDialog(true);
  };

  const handleDeleteGame = async (gameId: number) => {
    if (!gamesDialogMatch || !user || !tournament?.id) return;
    setIsDeletingGame(true);
    setDeletingGameId(gameId);
    try {
      const token = await user.getIdToken();
      const resp = await fetch('/api/admin/pdl/delete-game', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tournamentId: tournament.id,
          matchId: gamesDialogMatch.id,
          gameId,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        toast({ title: 'Gra usunięta', description: data.message });
        setConfirmDeleteGameId(null);
        // Refresh the match list and update the dialog's match reference
        await loadMatches();
        // Update the dialog's match to reflect removed game_id
        setGamesDialogMatch(prev =>
          prev
            ? { ...prev, game_ids: (prev.game_ids ?? []).filter(id => id !== gameId) }
            : prev,
        );
      } else {
        toast({ title: 'Błąd', description: data.error || 'Nie udało się usunąć gry', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Błąd', description: 'Nie udało się połączyć z serwerem', variant: 'destructive' });
    } finally {
      setIsDeletingGame(false);
      setDeletingGameId(null);
    }
  };

  const openRevertForfeitDialog = (match: MatchWithTeamNames) => {
    setRevertForfeitMatch(match);
    setShowRevertForfeitDialog(true);
  };

  const handleRevertForfeit = async () => {
    if (!revertForfeitMatch || !user || !tournament?.id) return;
    setIsRevertingForfeit(true);
    try {
      const token = await user.getIdToken();
      const resp = await fetch('/api/admin/pdl/revert-forfeit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tournamentId: tournament.id,
          matchId: revertForfeitMatch.id,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        toast({ title: 'Forfeit cofnięty', description: data.message });
        setShowRevertForfeitDialog(false);
        setRevertForfeitMatch(null);
        await loadMatches();
        const freshToken = await user.getIdToken();
        await runPostSyncRecalculation(freshToken);
      } else {
        toast({ title: 'Błąd', description: data.error || data.message || 'Nie udało się cofnąć forfeita', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Błąd połączenia z serwerem', variant: 'destructive' });
    } finally {
      setIsRevertingForfeit(false);
    }
  };

  const openForfeitDialog = (match: MatchWithTeamNames) => {
    setForfeitMatch(match);
    setForfeitingTeam('teamA');
    setForfeitScope('series');
    setForfeitedGames([]);
    setForfeitReason('');
    setShowForfeitDialog(true);
  };

  const openForceScheduleDialog = (match: MatchWithTeamNames) => {
    setForceScheduleMatch(match);
    // Pre-fill with existing scheduled time if available, converted to local datetime-local format
    const existing = match.scheduledFor;
    if (existing) {
      const d = new Date(existing);
      const pad = (n: number) => String(n).padStart(2, '0');
      const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      setForceScheduleDateTime(local);
    } else {
      setForceScheduleDateTime('');
    }
    setForceScheduleReason('');
    setShowForceScheduleDialog(true);
  };

  const handleForceSchedule = async () => {
    if (!forceScheduleMatch || !user || !tournament?.id || !forceScheduleDateTime) return;
    setIsForceScheduling(true);
    try {
      const token = await user.getIdToken();
      const resp = await fetch('/api/admin/pdl/force-schedule-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tournamentId: tournament.id,
          matchId: forceScheduleMatch.id,
          scheduledFor: new Date(forceScheduleDateTime).toISOString(),
          reason: forceScheduleReason,
          adminUserId: user.uid,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        toast({ title: 'Termin ustawiony', description: data.message });
        setShowForceScheduleDialog(false);
        setForceScheduleMatch(null);
        await loadMatches();
      } else {
        toast({ title: 'Błąd', description: data.error || 'Nie udało się ustawić terminu', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Błąd połączenia z serwerem', variant: 'destructive' });
    } finally {
      setIsForceScheduling(false);
    }
  };

  const toggleForfeitGame = (gameNum: number) => {
    setForfeitedGames(prev =>
      prev.includes(gameNum) ? prev.filter(g => g !== gameNum) : [...prev, gameNum]
    );
  };

  const handleForfeit = async () => {
    if (!forfeitMatch || !user || !tournament?.id) return;
    setIsForfeitSaving(true);
    try {
      const token = await user.getIdToken();
      const gameNumbers = forfeitScope === 'series' ? [] : forfeitedGames;
      const resp = await fetch('/api/admin/pdl/forfeit-match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tournamentId: tournament.id,
          matchId: forfeitMatch.id,
          forfeitingTeam,
          forfeitedGameNumbers: gameNumbers,
          reason: forfeitReason,
          adminUserId: user.uid,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        toast({ title: 'Walkover zapisany', description: data.message });
        setShowForfeitDialog(false);
        setForfeitMatch(null);
        await loadMatches();
      } else {
        toast({
          title: 'Błąd',
          description: data.error || 'Nie udało się zapisać walkovera',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Błąd',
        description: 'Nie udało się połączyć z serwerem',
        variant: 'destructive',
      });
    } finally {
      setIsForfeitSaving(false);
    }
  };

  const filteredMatches = matches.filter(match => {
    if (searchQuery && 
        !match.teamAName.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !match.teamBName.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (statusFilter !== 'all' && match.status !== statusFilter) {
      return false;
    }
    return true;
  });

  const getStatusBadge = (status: Match['status']) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30 font-logik">Zakończony</Badge>;
      case 'live':
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30 font-logik animate-pulse">LIVE</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30 font-logik">Zaplanowany</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-500 border-gray-500/30 font-logik">{status}</Badge>;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('pl-PL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleTimeString('pl-PL', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '-';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin" style={{ color: theme.primaryColor }} />
            <p className="text-muted-foreground font-logik">Ładowanie meczów...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sync Result Banner */}
      {syncResult && (
        <div className={cn(
          'flex items-center gap-3 rounded-lg border p-4 font-logik',
          syncResult.success
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        )}>
          {syncResult.success ? (
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
          )}
          <p className="text-sm flex-1">{syncResult.message}</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-current hover:bg-white/10"
            onClick={() => setSyncResult(null)}
          >
            ×
          </Button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-logik-extended-bold">Zarządzanie meczami</h2>
          <p className="text-muted-foreground font-logik">
            Edycja wyników, import meczów, przesunięcia terminów
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="font-logik"
            onClick={handleSyncMatches}
            disabled={isSyncing || isPostSyncRecalculating}
          >
            {isSyncing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Synchronizuję...
              </>
            ) : isPostSyncRecalculating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Przeliczam tabele i statystyki...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Synchronizuj mecze
              </>
            )}
          </Button>

          {/* Force Import Dialog – triggered from per-row buttons */}
          <Dialog open={showForceImportDialog} onOpenChange={(open) => {
            setShowForceImportDialog(open);
            if (!open) resetForceImportDialog();
          }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-logik-extended-bold">Force Import Gry</DialogTitle>
                <DialogDescription className="font-logik">
                  Użyj gdy kapitan podał błędną nazwę drużyny w lobby i gra nie została automatycznie wykryta.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-2">
                {/* Step 1: Game ID */}
                <div className="space-y-2">
                  <Label className="font-logik text-sm font-medium">Krok 1: ID gry z OpenDota</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="np. 8423006415 lub URL"
                      value={forceImportGameId}
                      onChange={(e) => { setForceImportGameId(e.target.value); setForceImportPreview(null); setForceImportPreviewError(''); }}
                      className="font-logik flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={handlePreviewForceImport}
                      disabled={isPreviewing || !forceImportGameId.trim()}
                      className="font-logik shrink-0"
                    >
                      {isPreviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4 mr-1" />}
                      Podgląd
                    </Button>
                  </div>
                  {forceImportPreviewError && (
                    <p className="text-xs text-red-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {forceImportPreviewError}
                    </p>
                  )}
                </div>

                {/* Preview card */}
                {forceImportPreview && (
                  <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-4 space-y-2 text-sm font-logik">
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Match ID</span>
                      <a
                        href={`https://opendota.com/matches/${forceImportPreview.matchId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-400 hover:underline flex items-center gap-1"
                      >
                        {forceImportPreview.matchId}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Radiant (lobby)</span>
                      <span className={cn('font-medium', forceImportPreview.radiantLobbyName ? 'text-white' : 'text-red-400')}>
                        {forceImportPreview.radiantLobbyName || '(brak nazwy)'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Dire (lobby)</span>
                      <span className={cn('font-medium', forceImportPreview.direLobbyName ? 'text-white' : 'text-red-400')}>
                        {forceImportPreview.direLobbyName || '(brak nazwy)'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Wynik</span>
                      <span className="text-white">{forceImportPreview.radiantScore} – {forceImportPreview.direScore}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Czas</span>
                      <span className="text-white">{Math.round(forceImportPreview.duration / 60)} min</span>
                    </div>
                    <div className="flex gap-2">
                      <Badge className={cn('text-xs', forceImportPreview.isParsed ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30')}>
                        {forceImportPreview.isParsed ? 'Sparsowana' : 'Niesparsowana'}
                      </Badge>
                      {forceImportPreview.alreadyProcessed && (
                        <Badge className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">Już przetworzona</Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 2: Assignment (only shown after preview) */}
                {forceImportPreview && (
                  <div className="space-y-3">
                    <Label className="font-logik text-sm font-medium">Krok 2: Przypisz do meczu turniejowego</Label>

                    {/* Match selector — hidden when opened from a row (match already pre-set) */}
                    {forceImportContextMatch ? (
                      <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-logik">
                        <span className="text-white/50 text-xs mr-2">Mecz:</span>
                        <span className="font-medium">{forceImportContextMatch.teamAName} vs {forceImportContextMatch.teamBName}</span>
                        {forceImportContextMatch.scheduledFor && (
                          <span className="text-white/40 ml-2 text-xs">({formatDate(forceImportContextMatch.scheduledFor)})</span>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Label className="font-logik text-xs text-white/60">Mecz turniejowy</Label>
                        <Select value={forceImportMatchId} onValueChange={setForceImportMatchId}>
                          <SelectTrigger className="font-logik">
                            <SelectValue placeholder="Wybierz mecz..." />
                          </SelectTrigger>
                          <SelectContent>
                            {matches.map(m => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.teamAName} vs {m.teamBName}
                                {m.scheduledFor ? ` (${formatDate(m.scheduledFor)})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Radiant / Dire — restricted to the 2 match teams when opened from a row */}
                    {(() => {
                      const teamOptions = forceImportContextMatch
                        ? [
                            { id: forceImportContextMatch.teamA?.id || '', name: forceImportContextMatch.teamAName },
                            { id: forceImportContextMatch.teamB?.id || '', name: forceImportContextMatch.teamBName },
                          ].filter(t => t.id)
                        : teams;
                      return (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="font-logik text-xs text-white/60">Radiant = drużyna turniejowa</Label>
                            <Select value={forceImportRadiantTeamId} onValueChange={setForceImportRadiantTeamId}>
                              <SelectTrigger className="font-logik">
                                <SelectValue placeholder="Radiant..." />
                              </SelectTrigger>
                              <SelectContent>
                                {teamOptions.map(t => (
                                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="font-logik text-xs text-white/60">Dire = drużyna turniejowa</Label>
                            <Select value={forceImportDireTeamId} onValueChange={setForceImportDireTeamId}>
                              <SelectTrigger className="font-logik">
                                <SelectValue placeholder="Dire..." />
                              </SelectTrigger>
                              <SelectContent>
                                {teamOptions.map(t => (
                                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowForceImportDialog(false); resetForceImportDialog(); }} className="font-logik">
                  Anuluj
                </Button>
                <Button
                  onClick={handleForceImport}
                  disabled={isForceImporting || !forceImportPreview || !forceImportMatchId || !forceImportRadiantTeamId || !forceImportDireTeamId}
                  className="font-logik bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {isForceImporting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importuję...</>
                  ) : (
                    <><Wrench className="h-4 w-4 mr-2" />Force Import</>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="font-logik">
                <Upload className="h-4 w-4 mr-2" />
                Importuj mecz
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-logik-extended-bold">Importuj mecz z OpenDota</DialogTitle>
                <DialogDescription className="font-logik">
                  Podaj ID meczu z OpenDota lub pełny URL
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label className="font-logik">Match ID lub URL</Label>
                  <Input
                    placeholder="np. 8423006415 lub https://opendota.com/matches/8423006415"
                    value={matchIdToImport}
                    onChange={(e) => setMatchIdToImport(e.target.value)}
                    className="font-logik"
                  />
                </div>
                <div className="text-sm text-muted-foreground font-logik">
                  <p>Mecz zostanie automatycznie przypisany do odpowiedniej pary drużyn na podstawie graczy.</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowImportDialog(false)} className="font-logik">
                  Anuluj
                </Button>
                <Button 
                  onClick={handleImportMatch} 
                  disabled={isImporting || !matchIdToImport}
                  className="font-logik"
                  style={{ backgroundColor: theme.primaryColor }}
                >
                  {isImporting ? (
                    <>
                      <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                      Importuję...
                    </>
                  ) : (
                    <>
                      <FileDown className="h-4 w-4 mr-2" />
                      Importuj
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="font-logik"
            style={{ backgroundColor: theme.primaryColor }}
          >
            {isSaving ? (
              <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Zapisz zmiany
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Szukaj meczu lub drużyny..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 font-logik"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48 font-logik">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie</SelectItem>
                <SelectItem value="scheduled">Zaplanowane</SelectItem>
                <SelectItem value="live">Trwające</SelectItem>
                <SelectItem value="completed">Zakończone</SelectItem>
                <SelectItem value="postponed">Przełożone</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Matches List */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
                <Gamepad2 className="h-5 w-5" style={{ color: theme.primaryColor }} />
                Lista meczów
              </CardTitle>
              <CardDescription className="font-logik">
                {filteredMatches.length} meczów
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="font-logik text-red-500 border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
              onClick={() => setShowDeleteAllDialog(true)}
              disabled={matches.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Usuń wszystkie mecze
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-logik-extended-bold">Mecz</TableHead>
                <TableHead className="font-logik-extended-bold text-center">Wynik</TableHead>
                <TableHead className="font-logik-extended-bold">Dywizja</TableHead>
                <TableHead className="font-logik-extended-bold">Termin</TableHead>
                <TableHead className="font-logik-extended-bold">Status</TableHead>
                <TableHead className="font-logik-extended-bold w-32">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMatches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground font-logik">
                    Brak meczów spełniających kryteria
                  </TableCell>
                </TableRow>
              ) : (
                filteredMatches.map(match => (
                  <TableRow key={match.id} className="hover:bg-background/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-logik-extended-bold">{match.teamAName}</p>
                        </div>
                        <span className="text-muted-foreground font-logik">vs</span>
                        <div className="text-left">
                          <p className="font-logik-extended-bold">{match.teamBName}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          max="3"
                          value={match.teamA?.score || 0}
                          onChange={(e) => updateMatchScore(match.id, 'teamA', Number(e.target.value))}
                          className="w-12 text-center font-logik-extended-bold h-8"
                        />
                        <span className="text-muted-foreground">:</span>
                        <Input
                          type="number"
                          min="0"
                          max="3"
                          value={match.teamB?.score || 0}
                          onChange={(e) => updateMatchScore(match.id, 'teamB', Number(e.target.value))}
                          className="w-12 text-center font-logik-extended-bold h-8"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-logik">
                        {(() => {
                          if (match.isPlayoff) return match.playoffCode ? `Playoffs · ${match.playoffCode}` : 'Playoffs';
                          const rawId = match.divisionId || match.group_id;
                          if (!rawId) return 'N/A';
                          return divisionsMap.get(rawId) || rawId;
                        })()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm font-logik">
                        {(() => {
                          const hasConfirmedTime =
                            match.schedulingStatus === 'confirmed' ||
                            match.schedulingStatus === 'proposed' ||
                            match.rescheduleRequest?.status === 'approved' ||
                            match.status === 'scheduled' ||
                            match.status === 'completed' ||
                            match.status === 'live';
                          if (!hasConfirmedTime) {
                            return (
                              <>
                                <Flag className="h-4 w-4 text-amber-500" />
                                <span className="text-amber-500">
                                  {match.deadline
                                    ? `Deadline: ${formatDate(match.deadline)}`
                                    : 'Do ustalenia'}
                                </span>
                              </>
                            );
                          }
                          const displayTime = (match as Match & { dateTime?: string }).dateTime || match.scheduledFor;
                          return (
                            <>
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {formatDate(displayTime)}
                              <Clock className="h-4 w-4 text-muted-foreground ml-2" />
                              {formatTime(displayTime)}
                            </>
                          );
                        })()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        {getStatusBadge(match.status)}
                        {match.forfeit && (
                          <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30 font-logik text-xs">
                            W/O
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {match.game_ids && match.game_ids.length > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                            title={`Zarządzaj grami (${match.game_ids.length})`}
                            onClick={() => openGamesDialog(match)}
                          >
                            <Layers className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-orange-400 hover:text-orange-500 hover:bg-orange-500/10"
                          title="Force import gry"
                          onClick={() => openForceImportForMatch(match)}
                        >
                          <Wrench className="h-4 w-4" />
                        </Button>
                        {match.status !== 'completed' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-400 hover:text-blue-500 hover:bg-blue-500/10"
                            title="Wymuś termin (admin)"
                            onClick={() => openForceScheduleDialog(match)}
                          >
                            <CalendarClock className="h-4 w-4" />
                          </Button>
                        )}
                        {match.forfeit ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-yellow-500 hover:text-yellow-600 hover:bg-yellow-500/10"
                            title="Cofnij forfeit / walkover"
                            onClick={() => openRevertForfeitDialog(match)}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-orange-500 hover:text-orange-600 hover:bg-orange-500/10"
                            title="Walkover / Forfeit"
                            onClick={() => openForfeitDialog(match)}
                          >
                            <Flag className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 relative text-purple-400 hover:text-purple-500 hover:bg-purple-500/10"
                          title="Kara draftu"
                          onClick={() => openPenaltyDialog(match)}
                        >
                          <Gavel className="h-4 w-4" />
                          {match.draftPenalties && match.draftPenalties.length > 0 && (
                            <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-purple-500" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          onClick={() => confirmDeleteMatch(match.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete All Confirmation Dialog */}
      <Dialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-logik-extended-bold text-red-500">Usuń wszystkie mecze</DialogTitle>
            <DialogDescription className="font-logik">
              Czy na pewno chcesz usunąć <strong>wszystkie {matches.length} mecze</strong> w tym turnieju?
              Tej operacji nie można cofnąć.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteAllDialog(false)}
              className="font-logik"
              disabled={isDeletingAll}
            >
              Anuluj
            </Button>
            <Button
              onClick={deleteAllMatches}
              disabled={isDeletingAll}
              className="font-logik bg-red-500 hover:bg-red-600"
            >
              {isDeletingAll ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Usuwanie...</>
              ) : (
                <><Trash2 className="h-4 w-4 mr-2" />Usuń wszystkie ({matches.length})</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-logik-extended-bold">Usuń mecz</DialogTitle>
            <DialogDescription className="font-logik">
              Czy na pewno chcesz usunąć ten mecz? Tej operacji nie można cofnąć.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteDialog(false)}
              className="font-logik"
              disabled={isDeleting}
            >
              Anuluj
            </Button>
            <Button 
              onClick={deleteMatch} 
              disabled={isDeleting}
              className="font-logik bg-red-500 hover:bg-red-600"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Usuwanie...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Usuń
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Games Management Dialog */}
      <Dialog open={showGamesDialog} onOpenChange={setShowGamesDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-logik-extended-bold flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-500" />
              Gry w meczu
            </DialogTitle>
            <DialogDescription className="font-logik">
              {gamesDialogMatch
                ? `${gamesDialogMatch.teamAName} vs ${gamesDialogMatch.teamBName}`
                : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {gamesDialogMatch?.game_ids && gamesDialogMatch.game_ids.length > 0 ? (
              gamesDialogMatch.game_ids.map((gameId, idx) => (
                <div
                  key={gameId}
                  className="flex items-center justify-between rounded-md border bg-card px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground font-logik w-14">Gra {idx + 1}</span>
                    <span className="font-mono text-sm font-logik-extended-bold">{gameId}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Otwórz w OpenDota"
                      onClick={() =>
                        window.open(`https://www.opendota.com/matches/${gameId}`, '_blank')
                      }
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>

                    {confirmDeleteGameId === gameId ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-red-500 font-logik">Na pewno?</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-red-500 hover:bg-red-500/10 font-logik"
                          disabled={isDeletingGame && deletingGameId === gameId}
                          onClick={() => handleDeleteGame(gameId)}
                        >
                          {isDeletingGame && deletingGameId === gameId ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            'Usuń'
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 font-logik"
                          disabled={isDeletingGame}
                          onClick={() => setConfirmDeleteGameId(null)}
                        >
                          Anuluj
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        title="Usuń grę z meczu"
                        disabled={isDeletingGame}
                        onClick={() => setConfirmDeleteGameId(gameId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center py-4 text-muted-foreground font-logik text-sm">
                Brak zaimportowanych gier
              </p>
            )}

            <p className="text-xs text-muted-foreground font-logik pt-2">
              Po usunięciu gry możesz ją ponownie zaimportować przez &quot;Force Import&quot;.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowGamesDialog(false)}
              className="font-logik"
            >
              Zamknij
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Force Schedule Dialog */}
      <Dialog open={showForceScheduleDialog} onOpenChange={(open) => {
        setShowForceScheduleDialog(open);
        if (!open) setForceScheduleMatch(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-logik-extended-bold flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-blue-400" />
              Wymuś termin meczu
            </DialogTitle>
            <DialogDescription className="font-logik">
              {forceScheduleMatch
                ? `${forceScheduleMatch.teamAName} vs ${forceScheduleMatch.teamBName}`
                : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="force-schedule-dt" className="font-logik text-sm font-medium">
                Data i godzina <span className="text-red-500">*</span>
              </Label>
              <Input
                id="force-schedule-dt"
                type="datetime-local"
                value={forceScheduleDateTime}
                onChange={e => setForceScheduleDateTime(e.target.value)}
                className="font-logik"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="force-schedule-reason" className="font-logik text-sm font-medium">
                Powód (opcjonalnie)
              </Label>
              <Input
                id="force-schedule-reason"
                placeholder="np. termin narzucony przez ligę, drużyny niedostępne..."
                value={forceScheduleReason}
                onChange={e => setForceScheduleReason(e.target.value)}
                className="font-logik"
              />
            </div>

            <div className="rounded-md bg-blue-500/10 border border-blue-500/20 p-3 text-sm font-logik text-blue-700 dark:text-blue-400">
              Termin zostanie ustawiony jako potwierdzony i nadpisze wszelkie wcześniejsze propozycje.
              Drużyny nadal mogą przesunąć mecz standardowym procesem.
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowForceScheduleDialog(false)}
              className="font-logik"
              disabled={isForceScheduling}
            >
              Anuluj
            </Button>
            <Button
              onClick={handleForceSchedule}
              disabled={isForceScheduling || !forceScheduleDateTime}
              className="font-logik bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isForceScheduling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Zapisuję...
                </>
              ) : (
                <>
                  <CalendarClock className="h-4 w-4 mr-2" />
                  Ustaw termin
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Forfeit / Walkover Dialog */}
      <Dialog open={showForfeitDialog} onOpenChange={setShowForfeitDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-logik-extended-bold flex items-center gap-2">
              <Flag className="h-5 w-5 text-orange-500" />
              Walkover / Forfeit
            </DialogTitle>
            <DialogDescription className="font-logik">
              {forfeitMatch
                ? `${forfeitMatch.teamAName} vs ${forfeitMatch.teamBName}`
                : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Who forfeits */}
            <div className="space-y-2">
              <Label className="font-logik text-sm font-medium">Która drużyna poddaje?</Label>
              <div className="flex gap-2">
                <Button
                  variant={forfeitingTeam === 'teamA' ? 'default' : 'outline'}
                  className={cn('flex-1 font-logik', forfeitingTeam === 'teamA' && 'text-white')}
                  style={forfeitingTeam === 'teamA' ? { backgroundColor: theme.primaryColor } : {}}
                  onClick={() => setForfeitingTeam('teamA')}
                >
                  {forfeitMatch?.teamAName}
                </Button>
                <Button
                  variant={forfeitingTeam === 'teamB' ? 'default' : 'outline'}
                  className={cn('flex-1 font-logik', forfeitingTeam === 'teamB' && 'text-white')}
                  style={forfeitingTeam === 'teamB' ? { backgroundColor: theme.primaryColor } : {}}
                  onClick={() => setForfeitingTeam('teamB')}
                >
                  {forfeitMatch?.teamBName}
                </Button>
              </div>
            </div>

            {/* Scope */}
            <div className="space-y-2">
              <Label className="font-logik text-sm font-medium">Zakres forfeita</Label>
              <div className="flex gap-2">
                <Button
                  variant={forfeitScope === 'series' ? 'default' : 'outline'}
                  className={cn('flex-1 font-logik', forfeitScope === 'series' && 'text-white')}
                  style={forfeitScope === 'series' ? { backgroundColor: theme.primaryColor } : {}}
                  onClick={() => { setForfeitScope('series'); setForfeitedGames([]); }}
                >
                  Całe spotkanie (0-2)
                </Button>
                <Button
                  variant={forfeitScope === 'games' ? 'default' : 'outline'}
                  className={cn('flex-1 font-logik', forfeitScope === 'games' && 'text-white')}
                  style={forfeitScope === 'games' ? { backgroundColor: theme.primaryColor } : {}}
                  onClick={() => setForfeitScope('games')}
                >
                  Wybrane gry
                </Button>
              </div>
            </div>

            {/* Game selection (only when scope = games) */}
            {forfeitScope === 'games' && (
              <div className="space-y-2">
                <Label className="font-logik text-sm font-medium">Które gry?</Label>
                <div className="flex gap-2">
                  {[1, 2].map(n => (
                    <Button
                      key={n}
                      variant={forfeitedGames.includes(n) ? 'default' : 'outline'}
                      className={cn('flex-1 font-logik', forfeitedGames.includes(n) && 'text-white')}
                      style={forfeitedGames.includes(n) ? { backgroundColor: theme.primaryColor } : {}}
                      onClick={() => toggleForfeitGame(n)}
                    >
                      Gra {n}
                    </Button>
                  ))}
                </div>
                {forfeitedGames.length === 0 && (
                  <p className="text-xs text-orange-500 font-logik">Wybierz przynajmniej jedną grę</p>
                )}
              </div>
            )}

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="forfeit-reason" className="font-logik text-sm font-medium">
                Powód (opcjonalnie)
              </Label>
              <Input
                id="forfeit-reason"
                placeholder="np. niestawienie się, brak graczy..."
                value={forfeitReason}
                onChange={e => setForfeitReason(e.target.value)}
                className="font-logik"
              />
            </div>

            {/* Summary */}
            <div className="rounded-md bg-orange-500/10 border border-orange-500/20 p-3 text-sm font-logik text-orange-700 dark:text-orange-400">
              {forfeitScope === 'series' ? (
                <>
                  <strong>{forfeitingTeam === 'teamA' ? forfeitMatch?.teamAName : forfeitMatch?.teamBName}</strong>{' '}
                  poddaje całe spotkanie. Wynik:{' '}
                  {forfeitingTeam === 'teamA' ? '0:2' : '2:0'} — mecz zakończony.
                </>
              ) : forfeitedGames.length > 0 ? (
                <>
                  <strong>{forfeitingTeam === 'teamA' ? forfeitMatch?.teamAName : forfeitMatch?.teamBName}</strong>{' '}
                  poddaje {forfeitedGames.map(g => `Grę ${g}`).join(' i ')}.
                  Wynik serii zostanie przeliczony automatycznie.
                </>
              ) : (
                'Wybierz przynajmniej jedną grę.'
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowForfeitDialog(false)}
              className="font-logik"
              disabled={isForfeitSaving}
            >
              Anuluj
            </Button>
            <Button
              onClick={handleForfeit}
              disabled={
                isForfeitSaving ||
                (forfeitScope === 'games' && forfeitedGames.length === 0)
              }
              className="font-logik bg-orange-500 hover:bg-orange-600 text-white"
            >
              {isForfeitSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Zapisuję...
                </>
              ) : (
                <>
                  <Flag className="h-4 w-4 mr-2" />
                  Zapisz walkover
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Draft Penalty Dialog */}
      <Dialog open={!!penaltyMatch} onOpenChange={(open) => { if (!open) setPenaltyMatch(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-logik-extended-bold">
              <Gavel className="h-5 w-5 text-purple-400" /> Kara draftu
            </DialogTitle>
            <DialogDescription className="font-logik">
              {penaltyMatch ? `${penaltyMatch.teamAName} vs ${penaltyMatch.teamBName}` : ''}
              {' — '}kara skróconego czasu na draft, nakładana przez bota w lobby.
            </DialogDescription>
          </DialogHeader>

          {penaltyMatch && (
            <div className="space-y-4">
              {/* Existing penalties */}
              {(penaltyMatch.draftPenalties?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <Label className="font-logik-extended-bold text-xs">Aktywne kary</Label>
                  {penaltyMatch.draftPenalties!.map((p) => {
                    const teamName = p.teamId === penaltyMatch.teamA?.id ? penaltyMatch.teamAName
                      : p.teamId === penaltyMatch.teamB?.id ? penaltyMatch.teamBName : p.teamId;
                    const gamesLabel = !p.games || p.games.length === 0 ? 'cała seria' : `gry ${p.games.join(', ')}`;
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border border-purple-500/20 bg-purple-500/5 px-3 py-2">
                        <div className="text-xs font-logik">
                          <span className="font-logik-extended-bold">{teamName}</span>
                          {' · '}{DRAFT_PENALTY_LEVELS[p.level].label}{' · '}{gamesLabel}
                          {p.reason ? <span className="text-muted-foreground"> · {p.reason}</span> : null}
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:bg-red-500/10 shrink-0" onClick={() => removePenalty(p.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Team selection */}
              <div className="space-y-1">
                <Label className="font-logik-extended-bold text-xs">Drużyna (można obie)</Label>
                <div className="flex gap-2">
                  <Button variant={penaltyTeamA ? 'default' : 'outline'} className={cn('flex-1 font-logik', penaltyTeamA && 'text-white')}
                    style={penaltyTeamA ? { backgroundColor: theme.primaryColor } : {}} onClick={() => setPenaltyTeamA((v) => !v)}>
                    {penaltyMatch.teamAName}
                  </Button>
                  <Button variant={penaltyTeamB ? 'default' : 'outline'} className={cn('flex-1 font-logik', penaltyTeamB && 'text-white')}
                    style={penaltyTeamB ? { backgroundColor: theme.primaryColor } : {}} onClick={() => setPenaltyTeamB((v) => !v)}>
                    {penaltyMatch.teamBName}
                  </Button>
                </div>
              </div>

              {/* Scope */}
              <div className="space-y-1">
                <Label className="font-logik-extended-bold text-xs">Zakres</Label>
                <div className="flex gap-2">
                  <Button variant={penaltyScope === 'series' ? 'default' : 'outline'} className={cn('flex-1 font-logik', penaltyScope === 'series' && 'text-white')}
                    style={penaltyScope === 'series' ? { backgroundColor: theme.primaryColor } : {}} onClick={() => setPenaltyScope('series')}>
                    Cała seria
                  </Button>
                  <Button variant={penaltyScope === 'games' ? 'default' : 'outline'} className={cn('flex-1 font-logik', penaltyScope === 'games' && 'text-white')}
                    style={penaltyScope === 'games' ? { backgroundColor: theme.primaryColor } : {}} onClick={() => setPenaltyScope('games')}>
                    Wybrane gry
                  </Button>
                </div>
                {penaltyScope === 'games' && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {Array.from({ length: gamesInMatch(penaltyMatch) }, (_, i) => i + 1).map((g) => (
                      <Button key={g} variant={penaltyGames.includes(g) ? 'default' : 'outline'} size="sm"
                        className={cn('font-logik w-10', penaltyGames.includes(g) && 'text-white')}
                        style={penaltyGames.includes(g) ? { backgroundColor: theme.primaryColor } : {}}
                        onClick={() => togglePenaltyGame(g)}>
                        {g}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {/* Level */}
              <div className="space-y-1">
                <Label className="font-logik-extended-bold text-xs">Poziom kary</Label>
                <Select value={String(penaltyLevel)} onValueChange={(v) => setPenaltyLevel(Number(v) as DraftPenaltyLevel)}>
                  <SelectTrigger className="font-logik"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {([1, 2, 3] as DraftPenaltyLevel[]).map((lvl) => (
                      <SelectItem key={lvl} value={String(lvl)}>
                        {DRAFT_PENALTY_LEVELS[lvl].label} — {DRAFT_PENALTY_LEVELS[lvl].description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reason */}
              <div className="space-y-1">
                <Label className="font-logik-extended-bold text-xs">Powód (opcjonalnie)</Label>
                <Input value={penaltyReason} onChange={(e) => setPenaltyReason(e.target.value)} placeholder="np. spóźnienie, złamanie zasad…" className="font-logik" />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPenaltyMatch(null)} className="font-logik">Zamknij</Button>
            <Button onClick={issuePenalty} disabled={isIssuingPenalty || (!penaltyTeamA && !penaltyTeamB)}
              className="font-logik text-white" style={{ backgroundColor: theme.primaryColor }}>
              {isIssuingPenalty ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Gavel className="h-4 w-4 mr-2" />}
              Nałóż karę
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revert Forfeit Confirmation Dialog */}
      <Dialog open={showRevertForfeitDialog} onOpenChange={(open) => {
        setShowRevertForfeitDialog(open);
        if (!open) setRevertForfeitMatch(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-logik-extended-bold flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-yellow-500" />
              Cofnij forfeit / walkover
            </DialogTitle>
            <DialogDescription className="font-logik">
              {revertForfeitMatch
                ? `${revertForfeitMatch.teamAName} vs ${revertForfeitMatch.teamBName}`
                : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 p-3 text-sm font-logik text-yellow-700 dark:text-yellow-400 space-y-1">
            {revertForfeitMatch?.forfeit && (
              <>
                {(revertForfeitMatch.forfeit as { scope: string }).scope === 'series' ? (
                  <p>Anuluje walkover całej serii. Wynik zostanie zresetowany do <strong>0:0</strong>, a mecz wróci do statusu <strong>Zaplanowany</strong>.</p>
                ) : (
                  <p>Usuwa syntetyczne gry forfeit. Wynik zostanie przeliczony na podstawie rzeczywiście rozegranych gier.</p>
                )}
                <p className="text-xs opacity-70 mt-1">Tabele podziałów zostaną automatycznie przeliczone.</p>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRevertForfeitDialog(false)}
              className="font-logik"
              disabled={isRevertingForfeit}
            >
              Anuluj
            </Button>
            <Button
              onClick={handleRevertForfeit}
              disabled={isRevertingForfeit}
              className="font-logik bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              {isRevertingForfeit ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cofam...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Cofnij forfeit
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
          <CardContent className="py-6">
            <Button variant="outline" className="w-full font-logik h-12">
              <Plus className="h-4 w-4 mr-2" />
              Dodaj mecz ręcznie
            </Button>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
          <CardContent className="py-6">
            <Button variant="outline" className="w-full font-logik h-12">
              <Upload className="h-4 w-4 mr-2" />
              Importuj z replay
            </Button>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
          <CardContent className="py-6">
            <Button variant="outline" className="w-full font-logik h-12">
              <Calendar className="h-4 w-4 mr-2" />
              Generuj harmonogram
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Skipped Games                                                        */}
      {/* ------------------------------------------------------------------ */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
                <Ban className="h-5 w-5 text-yellow-500" />
                Pominięte gry
              </CardTitle>
              <CardDescription className="font-logik mt-1">
                Gry rozegrane w lidze, które nie są wliczane do żadnego meczu turniejowego.
                Pominięcia automatyczne (skrymy, remakey) oraz ręczne dodane przez admina.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="font-logik shrink-0"
              onClick={() => setShowAddSkippedDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Dodaj ręcznie
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingSkipped ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : skippedGames.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground font-logik">
              <Ban className="mx-auto h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Brak pominiętych gier</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-logik-extended-bold">ID gry (OpenDota)</TableHead>
                  <TableHead className="font-logik-extended-bold">Powód pominięcia</TableHead>
                  <TableHead className="font-logik-extended-bold">Pominięto przez</TableHead>
                  <TableHead className="font-logik-extended-bold">Data</TableHead>
                  <TableHead className="font-logik-extended-bold w-24">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {skippedGames.map(sg => (
                  <TableRow key={sg.gameId} className="hover:bg-background/50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-logik-extended-bold">
                          {sg.gameId}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          title="Otwórz w OpenDota"
                          onClick={() =>
                            window.open(`https://www.opendota.com/matches/${sg.gameId}`, '_blank')
                          }
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-logik text-sm text-muted-foreground">
                        {sg.reason || '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        'font-logik text-xs px-2 py-0.5 rounded-full border',
                        sg.skippedBy === 'system'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : 'bg-orange-500/10 text-orange-400 border-orange-500/20',
                      )}>
                        {sg.skippedBy === 'system' ? 'System' : 'Admin'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-logik text-sm text-muted-foreground">
                        {sg.skippedAt
                          ? new Date(sg.skippedAt).toLocaleDateString('pl-PL', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })
                          : '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        title="Usuń z listy pominiętych"
                        disabled={removingSkippedId === sg.gameId}
                        onClick={() => handleRemoveSkippedGame(sg.gameId)}
                      >
                        {removingSkippedId === sg.gameId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Skipped Game Dialog */}
      <Dialog
        open={showAddSkippedDialog}
        onOpenChange={(open) => {
          setShowAddSkippedDialog(open);
          if (!open) {
            setNewSkippedGameId('');
            setNewSkippedReason('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-logik-extended-bold flex items-center gap-2">
              <Ban className="h-5 w-5 text-yellow-500" />
              Pomiń grę ręcznie
            </DialogTitle>
            <DialogDescription className="font-logik">
              Oznacz grę jako pominiętą — nie będzie wliczana do wyników żadnego meczu
              i nie zostanie zaimportowana podczas synchronizacji.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="skip-game-id" className="font-logik text-sm font-medium">
                ID gry (OpenDota) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="skip-game-id"
                placeholder="np. 8423006415 lub URL OpenDota"
                value={newSkippedGameId}
                onChange={(e) => setNewSkippedGameId(e.target.value)}
                className="font-logik"
              />
              <p className="text-xs text-muted-foreground font-logik">
                Możesz wkleić pełny URL, np.{' '}
                <span className="font-mono">https://www.opendota.com/matches/1234567</span>
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="skip-reason" className="font-logik text-sm font-medium">
                Powód (opcjonalnie)
              </Label>
              <Input
                id="skip-reason"
                placeholder="np. gra treningowa, remakeo, błędne lobby..."
                value={newSkippedReason}
                onChange={(e) => setNewSkippedReason(e.target.value)}
                className="font-logik"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddSkippedDialog(false)}
              className="font-logik"
              disabled={isAddingSkipped}
            >
              Anuluj
            </Button>
            <Button
              onClick={handleAddSkippedGame}
              disabled={isAddingSkipped || !newSkippedGameId.trim()}
              className="font-logik bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              {isAddingSkipped ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Zapisuję...
                </>
              ) : (
                <>
                  <Ban className="h-4 w-4 mr-2" />
                  Pomiń grę
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
