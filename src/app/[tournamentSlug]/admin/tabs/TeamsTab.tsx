"use client";

import React, { useState, useEffect } from 'react';
import { useTournament, useTournamentType } from '@/context/TournamentContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { cn } from '@/lib/utils';
import {
  Users,
  Save,
  RotateCcw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  Shield,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  ExternalLink,
  ImageIcon,
  Trash2,
  RefreshCw,
  Ban,
  UserCog,
  Copy,
  Check,
} from 'lucide-react';
import { collection, getDocs, doc, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { DisplayPlayer } from '@/lib/team-players-loader';

interface TeamPlayer {
  nickname: string;
  role: string;
  mmr?: number;
  profileScreenshotUrl?: string;
  steamProfileUrl?: string;
  steamId32?: string;
  smurfAccounts?: { steamProfileUrl: string }[];
}

interface Team {
  id: string;
  name: string;
  tag: string;
  divisionId: string;
  divisionName: string;
  status: 'pending' | 'verified' | 'rejected' | 'eliminated' | 'banned';
  playersCount: number;
  captainDiscord: string;
  totalMmr?: number;
  logoUrl?: string;
  players?: TeamPlayer[];
}

/**
 * Teams Tab - Manage team statuses (pending, verified, eliminated)
 * Fetches real team data from the tournament's Firestore collection
 */
export function TeamsTab() {
  const { tournament, theme } = useTournament();
  const { isMmrLimited } = useTournamentType();
  const { user } = useAuth();
  const { toast } = useToast();

  const [teams, setTeams] = useState<Team[]>([]);
  const [originalTeams, setOriginalTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [divisionFilter, setDivisionFilter] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [deleteConfirmTeam, setDeleteConfirmTeam] = useState<Team | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSyncingAvatars, setIsSyncingAvatars] = useState(false);
  const [isRefreshingHeroes, setIsRefreshingHeroes] = useState(false);
  const [banConfirmTeam, setBanConfirmTeam] = useState<Team | null>(null);
  const [banReason, setBanReason] = useState('');
  const [isBanning, setIsBanning] = useState(false);
  // Resolved steamId32 values for smurf accounts with vanity URLs
  // keyed by the smurf's steamProfileUrl
  const [resolvedSmurfIds, setResolvedSmurfIds] = useState<Record<string, string>>({});
  // Captain-change: the team a code is being generated for, the resulting code, and UI flags
  const [captainChangeTeam, setCaptainChangeTeam] = useState<Team | null>(null);
  const [captainCode, setCaptainCode] = useState<string | null>(null);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const divisions = tournament?.divisions || [];

  const handleSyncSteamAvatars = async () => {
    if (!tournament?.id) return;
    setIsSyncingAvatars(true);
    try {
      const res = await fetch('/api/admin/sync-steam-avatars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: tournament.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Avatary zaktualizowane',
          description: data.message,
        });
      } else {
        toast({
          title: 'Błąd synchronizacji',
          description: data.error || 'Nie udało się zaktualizować avatarów.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Błąd',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsSyncingAvatars(false);
    }
  };

  const handleRefreshHeroes = async () => {
    if (!tournament?.id) return;
    setIsRefreshingHeroes(true);
    try {
      const res = await fetch('/api/player-heroes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: tournament.id, refreshAll: true }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Dane o bohaterach zaktualizowane',
          description: data.message,
        });
      } else {
        toast({
          title: 'Błąd pobierania danych',
          description: data.error || 'Nie udało się pobrać danych o bohaterach.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Błąd',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsRefreshingHeroes(false);
    }
  };

  // Fetch teams from database
  useEffect(() => {
    const loadTeams = async () => {
      if (!tournament?.id) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        const teamsRef = collection(db, 'tournaments', tournament.id, 'teams');
        const teamsSnapshot = await getDocs(teamsRef);

        // Load each team with its players subcollection
        const teamsData: Team[] = await Promise.all(
          teamsSnapshot.docs.map(async (teamDoc) => {
            const teamData = teamDoc.data();

            // Load players: prefers roster map (has nickname), falls back to subcollection
            const { loadTeamPlayersForDisplay } = await import('@/lib/team-players-loader');
            const players = await loadTeamPlayersForDisplay(teamDoc.id, tournament.id, teamData as Record<string, unknown>);

            // Get division name from tournament divisions
            const division = divisions.find(d => d.id === teamData.divisionId);

            // For MMR tournaments, extract player MMR data
            const teamPlayers: TeamPlayer[] | undefined = isMmrLimited
              ? players.map((p: DisplayPlayer) => ({
                  nickname: p.nickname,
                  role: p.role,
                  mmr: p.mmr,
                  profileScreenshotUrl: p.profileScreenshotUrl,
                  steamProfileUrl: p.steamProfileUrl,
                  steamId32: p.steamId32,
                  smurfAccounts: p.smurfAccounts,
                }))
              : undefined;

            const totalMmr = isMmrLimited
              ? players.reduce((sum: number, p: DisplayPlayer) => sum + (p.mmr || 0), 0)
              : undefined;

            return {
              id: teamDoc.id,
              name: teamData.name || teamDoc.id,
              tag: teamData.tag || '',
              divisionId: teamData.divisionId || '',
              divisionName: division?.name || teamData.divisionId || 'Brak',
              status: teamData.status || 'pending',
              playersCount: players.length,
              captainDiscord: (teamData.captainDiscordUsername as string) || '—',
              totalMmr,
              logoUrl: (teamData.logoUrl as string | undefined) || undefined,
              players: teamPlayers,
            };
          })
        );

        // Sort by division then by name
        const divisionOrder: Record<string, number> = { 'elite': 1, 'challenger': 2, 'adept': 3 };
        teamsData.sort((a, b) => {
          const aDivOrder = divisionOrder[a.divisionId?.toLowerCase() || ''] || 999;
          const bDivOrder = divisionOrder[b.divisionId?.toLowerCase() || ''] || 999;
          if (aDivOrder !== bDivOrder) return aDivOrder - bDivOrder;
          return (a.name || '').localeCompare(b.name || '');
        });

        setTeams(teamsData);
        setOriginalTeams(teamsData);
      } catch (err) {
        console.error('Error loading teams:', err);
        setError('Nie udało się załadować drużyn');
      } finally {
        setIsLoading(false);
      }
    };

    loadTeams();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament?.id]);

  // Resolve vanity Steam URLs for smurf accounts of the expanded team
  useEffect(() => {
    if (!expandedTeamId) return;
    const expandedTeam = teams.find(t => t.id === expandedTeamId);
    if (!expandedTeam?.players) return;

    const urlsToResolve: string[] = [];
    for (const player of expandedTeam.players) {
      for (const smurf of player.smurfAccounts || []) {
        const url = smurf.steamProfileUrl;
        if (!url) continue;
        // Already resolved or a numeric URL (no resolution needed)
        if (resolvedSmurfIds[url] !== undefined) continue;
        if (/\/profiles\/\d{17,}/.test(url)) continue;
        urlsToResolve.push(url);
      }
    }
    if (urlsToResolve.length === 0) return;

    // Mark as "in-progress" so we don't re-trigger on re-renders
    setResolvedSmurfIds(prev => {
      const next = { ...prev };
      for (const url of urlsToResolve) next[url] = '';
      return next;
    });

    (async () => {
      const resolved: Record<string, string> = {};
      await Promise.allSettled(
        urlsToResolve.map(async (url) => {
          try {
            const res = await fetch('/api/validate-steam', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ profileUrl: url }),
            });
            if (res.ok) {
              const data = await res.json();
              resolved[url] = data.steamId64 || '';
            }
          } catch { /* ignore */ }
        })
      );
      setResolvedSmurfIds(prev => ({ ...prev, ...resolved }));
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedTeamId, teams]);

  const handleSave = async () => {
    if (!tournament?.id) return;

    try {
      setIsSaving(true);
      
      // Find changed teams
      const changedTeams = teams.filter(team => {
        const original = originalTeams.find(t => t.id === team.id);
        return original && original.status !== team.status;
      });

      if (changedTeams.length === 0) {
        toast({
          title: "Brak zmian",
          description: "Nie wprowadzono żadnych zmian do zapisania.",
        });
        setIsSaving(false);
        return;
      }

      // Update teams in batch
      const batch = writeBatch(db);
      
      changedTeams.forEach(team => {
        const teamRef = doc(db, 'tournaments', tournament.id, 'teams', team.id);
        batch.update(teamRef, { 
          status: team.status,
          updatedAt: new Date().toISOString()
        });
      });

      await batch.commit();

      // Update original teams to match current state
      setOriginalTeams([...teams]);

      toast({
        title: "Zapisano pomyślnie",
        description: `Zaktualizowano status ${changedTeams.length} drużyn.`,
        variant: "default",
      });
    } catch (err) {
      console.error('Error saving teams:', err);
      toast({
        title: "Błąd zapisu",
        description: "Nie udało się zapisać zmian. Spróbuj ponownie.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateTeamStatus = (teamId: string, status: Team['status']) => {
    setTeams(teams.map(t => 
      t.id === teamId ? { ...t, status } : t
    ));
  };

  const bulkUpdateStatus = (status: Team['status']) => {
    setTeams(teams.map(t => 
      selectedTeams.includes(t.id) ? { ...t, status } : t
    ));
    setSelectedTeams([]);
  };

  const toggleTeamSelection = (teamId: string) => {
    setSelectedTeams(prev => 
      prev.includes(teamId) 
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  const toggleAllSelection = () => {
    if (selectedTeams.length === filteredTeams.length) {
      setSelectedTeams([]);
    } else {
      setSelectedTeams(filteredTeams.map(t => t.id));
    }
  };

  const handleDeleteTeam = async () => {
    if (!deleteConfirmTeam || !tournament?.id) return;
    try {
      setIsDeleting(true);
      // Delete players subcollection docs first
      const playersRef = collection(db, 'tournaments', tournament.id, 'teams', deleteConfirmTeam.id, 'players');
      const playersSnap = await getDocs(playersRef);
      const batch = writeBatch(db);
      playersSnap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, 'tournaments', tournament.id, 'teams', deleteConfirmTeam.id));
      await batch.commit();
      setTeams(prev => prev.filter(t => t.id !== deleteConfirmTeam.id));
      setOriginalTeams(prev => prev.filter(t => t.id !== deleteConfirmTeam.id));
      setSelectedTeams(prev => prev.filter(id => id !== deleteConfirmTeam.id));
      toast({ title: 'Drużyna usunięta', description: `"${deleteConfirmTeam.name}" została usunięta.` });
    } catch (err) {
      console.error('Error deleting team:', err);
      toast({ title: 'Błąd', description: 'Nie udało się usunąć drużyny.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setDeleteConfirmTeam(null);
    }
  };

  const handleBanTeam = async () => {
    if (!banConfirmTeam || !tournament?.id || !user) return;
    try {
      setIsBanning(true);
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/ban-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tournamentId: tournament.id,
          teamId: banConfirmTeam.id,
          reason: banReason || 'Cheating',
          adminUserId: user.uid,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTeams(prev => prev.map(t => t.id === banConfirmTeam.id ? { ...t, status: 'banned' } : t));
        setOriginalTeams(prev => prev.map(t => t.id === banConfirmTeam.id ? { ...t, status: 'banned' } : t));
        toast({ title: 'Drużyna zbanowana', description: data.message });
      } else {
        toast({ title: 'Błąd', description: data.error || 'Nie udało się zbanować drużyny.', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Błąd', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setIsBanning(false);
      setBanConfirmTeam(null);
      setBanReason('');
    }
  };

  // Open the captain-change dialog and immediately request a one-time code for the team.
  const handleOpenCaptainChange = async (team: Team) => {
    if (!tournament?.id || !user) return;
    setCaptainChangeTeam(team);
    setCaptainCode(null);
    setCodeCopied(false);
    setIsGeneratingCode(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/captain-change-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tournamentId: tournament.id, teamId: team.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCaptainCode(data.code);
      } else {
        toast({ title: 'Błąd', description: data.error || 'Nie udało się wygenerować kodu.', variant: 'destructive' });
        setCaptainChangeTeam(null);
      }
    } catch (err) {
      toast({ title: 'Błąd', description: (err as Error).message, variant: 'destructive' });
      setCaptainChangeTeam(null);
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const handleCopyCode = async () => {
    if (!captainCode) return;
    try {
      await navigator.clipboard.writeText(captainCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      toast({ title: 'Nie udało się skopiować', description: 'Skopiuj kod ręcznie.', variant: 'destructive' });
    }
  };

  const filteredTeams = teams.filter(team => {
    if (searchQuery && !team.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (statusFilter !== 'all' && team.status !== statusFilter) {
      return false;
    }
    if (divisionFilter !== 'all' && team.divisionId !== divisionFilter) {
      return false;
    }
    return true;
  });

  // Check if there are unsaved changes
  const hasUnsavedChanges = teams.some(team => {
    const original = originalTeams.find(t => t.id === team.id);
    return original && original.status !== team.status;
  });

  const getStatusBadge = (status: Team['status']) => {
    switch (status) {
      case 'verified':
        return (
          <Badge className="bg-green-500/20 text-green-500 border-green-500/30 font-logik">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Zweryfikowana
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 font-logik">
            <Clock className="h-3 w-3 mr-1" />
            Oczekuje
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30 font-logik">
            <XCircle className="h-3 w-3 mr-1" />
            Odrzucona
          </Badge>
        );
      case 'eliminated':
        return (
          <Badge className="bg-red-500/20 text-red-500 border-red-500/30 font-logik">
            <XCircle className="h-3 w-3 mr-1" />
            Wyeliminowana
          </Badge>
        );
      case 'banned':
        return (
          <Badge className="bg-red-900/30 text-red-400 border-red-700/40 font-logik">
            <Ban className="h-3 w-3 mr-1" />
            Zbanowana
          </Badge>
        );
    }
  };

  const statusCounts = {
    all: teams.length,
    pending: teams.filter(t => t.status === 'pending').length,
    verified: teams.filter(t => t.status === 'verified').length,
    rejected: teams.filter(t => t.status === 'rejected').length,
    eliminated: teams.filter(t => t.status === 'eliminated').length,
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin" style={{ color: theme.primaryColor }} />
          <p className="text-muted-foreground font-logik">Ładowanie drużyn...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm max-w-md">
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <p className="text-lg font-logik-extended-bold text-red-500 mb-2">Błąd</p>
            <p className="text-muted-foreground font-logik">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-logik-extended-bold">Zarządzanie drużynami</h2>
          <p className="text-muted-foreground font-logik">
            Weryfikacja i zarządzanie statusem drużyn ({teams.length} drużyn)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleSyncSteamAvatars}
            disabled={isSyncingAvatars}
            className="font-logik"
            title="Pobiera aktualne avatary i nazwy profili Steam dla wszystkich graczy"
          >
            {isSyncingAvatars ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Odśwież avatary Steam
          </Button>
          <Button
            variant="outline"
            onClick={handleRefreshHeroes}
            disabled={isRefreshingHeroes}
            className="font-logik"
            title="Pobiera dane o najczęściej granych bohaterach z OpenDota dla wszystkich graczy (może potrwać kilka minut)"
          >
            {isRefreshingHeroes ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Odśwież bohaterów
          </Button>
          {hasUnsavedChanges && (
            <span className="text-sm text-yellow-500 font-logik animate-pulse">
              Niezapisane zmiany
            </span>
          )}
          <Button 
            onClick={handleSave} 
            disabled={isSaving || !hasUnsavedChanges}
            className="font-logik"
            style={{ backgroundColor: hasUnsavedChanges ? theme.primaryColor : undefined }}
            variant={hasUnsavedChanges ? "default" : "outline"}
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

      {/* Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <button
          onClick={() => setStatusFilter('all')}
          className={cn(
            "p-4 rounded-xl border-2 transition-all duration-200",
            statusFilter === 'all' ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
          )}
        >
          <p className="text-2xl font-logik-extended-bold">{statusCounts.all}</p>
          <p className="text-sm text-muted-foreground font-logik">Wszystkie</p>
        </button>
        <button
          onClick={() => setStatusFilter('pending')}
          className={cn(
            "p-4 rounded-xl border-2 transition-all duration-200",
            statusFilter === 'pending' ? "border-yellow-500 bg-yellow-500/10" : "border-border hover:border-yellow-500/50"
          )}
        >
          <p className="text-2xl font-logik-extended-bold text-yellow-500">{statusCounts.pending}</p>
          <p className="text-sm text-muted-foreground font-logik">Oczekujące</p>
        </button>
        <button
          onClick={() => setStatusFilter('verified')}
          className={cn(
            "p-4 rounded-xl border-2 transition-all duration-200",
            statusFilter === 'verified' ? "border-green-500 bg-green-500/10" : "border-border hover:border-green-500/50"
          )}
        >
          <p className="text-2xl font-logik-extended-bold text-green-500">{statusCounts.verified}</p>
          <p className="text-sm text-muted-foreground font-logik">Zweryfikowane</p>
        </button>
        <button
          onClick={() => setStatusFilter('rejected')}
          className={cn(
            "p-4 rounded-xl border-2 transition-all duration-200",
            statusFilter === 'rejected' ? "border-orange-500 bg-orange-500/10" : "border-border hover:border-orange-500/50"
          )}
        >
          <p className="text-2xl font-logik-extended-bold text-orange-500">{statusCounts.rejected}</p>
          <p className="text-sm text-muted-foreground font-logik">Odrzucone</p>
        </button>
        <button
          onClick={() => setStatusFilter('eliminated')}
          className={cn(
            "p-4 rounded-xl border-2 transition-all duration-200",
            statusFilter === 'eliminated' ? "border-red-500 bg-red-500/10" : "border-border hover:border-red-500/50"
          )}
        >
          <p className="text-2xl font-logik-extended-bold text-red-500">{statusCounts.eliminated}</p>
          <p className="text-sm text-muted-foreground font-logik">Wyeliminowane</p>
        </button>
      </div>

      {/* Search and Filters */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Szukaj drużyny..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 font-logik"
              />
            </div>
            {!isMmrLimited && (
              <Select value={divisionFilter} onValueChange={setDivisionFilter}>
                <SelectTrigger className="w-full md:w-48 font-logik">
                  <SelectValue placeholder="Dywizja" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie dywizje</SelectItem>
                  {divisions.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedTeams.length > 0 && (
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm border-2 border-primary/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <p className="font-logik">
                Wybrano <span className="font-logik-extended-bold">{selectedTeams.length}</span> drużyn
              </p>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => bulkUpdateStatus('verified')}
                  className="font-logik text-green-500 border-green-500/30 hover:bg-green-500/10"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Zweryfikuj
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => bulkUpdateStatus('rejected')}
                  className="font-logik text-orange-500 border-orange-500/30 hover:bg-orange-500/10"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Odrzuć
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => bulkUpdateStatus('eliminated')}
                  className="font-logik text-red-500 border-red-500/30 hover:bg-red-500/10"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Wyeliminuj
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedTeams([])}
                  className="font-logik"
                >
                  Anuluj
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Teams Table */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox 
                  checked={selectedTeams.length === filteredTeams.length && filteredTeams.length > 0}
                  onCheckedChange={toggleAllSelection}
                />
              </TableHead>
              {isMmrLimited && <TableHead className="w-8" />}
              <TableHead className="font-logik-extended-bold">Drużyna</TableHead>
              {isMmrLimited ? (
                <TableHead className="font-logik-extended-bold">MMR</TableHead>
              ) : (
                <TableHead className="font-logik-extended-bold">Dywizja</TableHead>
              )}
              <TableHead className="font-logik-extended-bold">Kapitan</TableHead>
              <TableHead className="font-logik-extended-bold">Gracze</TableHead>
              <TableHead className="font-logik-extended-bold">Status</TableHead>
              <TableHead className="font-logik-extended-bold w-32">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTeams.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isMmrLimited ? 8 : 7} className="text-center py-8 text-muted-foreground font-logik">
                  Brak drużyn spełniających kryteria
                </TableCell>
              </TableRow>
            ) : (
              filteredTeams.map(team => (
                <React.Fragment key={team.id}>
                  <TableRow className="hover:bg-background/50">
                    <TableCell>
                      <Checkbox 
                        checked={selectedTeams.includes(team.id)}
                        onCheckedChange={() => toggleTeamSelection(team.id)}
                      />
                    </TableCell>
                    {isMmrLimited && (
                      <TableCell className="px-1">
                        <button
                          onClick={() => setExpandedTeamId(expandedTeamId === team.id ? null : team.id)}
                          className="p-1 rounded hover:bg-muted transition-colors"
                        >
                          {expandedTeamId === team.id ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {team.logoUrl ? (
                          <img
                            src={team.logoUrl}
                            alt={team.tag}
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center font-logik-extended-bold text-xs">
                            {team.tag}
                          </div>
                        )}
                        <div>
                          <p className="font-logik-extended-bold">{team.name}</p>
                          <p className="text-sm text-muted-foreground font-logik">[{team.tag}]</p>
                        </div>
                      </div>
                    </TableCell>
                    {isMmrLimited ? (
                      <TableCell>
                        <span className="font-logik-extended-bold">{(team.totalMmr || 0).toLocaleString()}</span>
                        {tournament?.mmrCap && (
                          <span className={cn(
                            "text-sm ml-1",
                            (team.totalMmr || 0) > tournament.mmrCap ? "text-red-400" : "text-muted-foreground"
                          )}>
                            / {tournament.mmrCap.toLocaleString()}
                          </span>
                        )}
                      </TableCell>
                    ) : (
                      <TableCell>
                        <Badge variant="outline" className="font-logik">{team.divisionName}</Badge>
                      </TableCell>
                    )}
                    <TableCell className="font-logik text-sm">{team.captainDiscord}</TableCell>
                    <TableCell className="font-logik">{team.playersCount}/5</TableCell>
                    <TableCell>{getStatusBadge(team.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select
                          value={team.status}
                          onValueChange={(v) => updateTeamStatus(team.id, v as Team['status'])}
                        >
                          <SelectTrigger className="flex-1 font-logik h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Oczekuje</SelectItem>
                            <SelectItem value="verified">Zweryfikowana</SelectItem>
                            <SelectItem value="rejected">Odrzucona</SelectItem>
                            <SelectItem value="eliminated">Wyeliminowana</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 flex-shrink-0"
                          title="Zmień kapitana"
                          onClick={() => handleOpenCaptainChange(team)}
                        >
                          <UserCog className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10 flex-shrink-0"
                          title="Zbanuj drużynę"
                          onClick={() => { setBanConfirmTeam(team); setBanReason(''); }}
                          disabled={team.status === 'banned'}
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 flex-shrink-0"
                          onClick={() => setDeleteConfirmTeam(team)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {/* Expandable player detail rows for MMR tournaments */}
                  {isMmrLimited && expandedTeamId === team.id && team.players && (
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={8} className="p-0">
                        <div className="px-6 py-4 space-y-4">
                          <p className="text-xs font-logik-extended-bold text-muted-foreground uppercase tracking-wider">
                            Weryfikacja graczy
                          </p>
                          {team.players.map((player, idx) => {
                            const accountId = player.steamId32 || '';
                            const dotabuffUrl = accountId ? `https://www.dotabuff.com/players/${accountId}` : null;
                            const opendotaUrl = accountId ? `https://www.opendota.com/players/${accountId}` : null;
                            return (
                              <div key={idx} className="rounded-lg border border-border/50 bg-background/40 p-4">
                                {/* Player header */}
                                <div className="flex items-center gap-3 mb-3">
                                  <Badge variant="outline" className="font-logik text-xs w-28 justify-center">{player.role}</Badge>
                                  <span className="font-logik-extended-bold">{player.nickname}</span>
                                  <span className="font-logik-extended-bold text-sm" style={{ color: theme.primaryColor }}>
                                    {(player.mmr || 0).toLocaleString()} MMR
                                  </span>
                                </div>
                                {/* Links row */}
                                <div className="flex flex-wrap gap-3 text-xs mb-3">
                                  {player.steamProfileUrl && (
                                    <a
                                      href={player.steamProfileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 font-logik text-blue-400 hover:text-blue-300 hover:underline"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      Steam
                                    </a>
                                  )}
                                  {dotabuffUrl && (
                                    <a
                                      href={dotabuffUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 font-logik text-orange-400 hover:text-orange-300 hover:underline"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      Dotabuff
                                    </a>
                                  )}
                                  {opendotaUrl && (
                                    <a
                                      href={opendotaUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 font-logik text-green-400 hover:text-green-300 hover:underline"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      OpenDota
                                    </a>
                                  )}
                                  {player.profileScreenshotUrl ? (
                                    <a
                                      href={player.profileScreenshotUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 font-logik hover:underline"
                                      style={{ color: theme.primaryColor }}
                                    >
                                      <ImageIcon className="h-3 w-3" />
                                      Screenshot MMR
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  ) : (
                                    <span className="flex items-center gap-1 text-xs text-red-400 font-logik">
                                      <AlertCircle className="h-3 w-3" />
                                      Brak screenshota MMR
                                    </span>
                                  )}
                                </div>
                                {/* Smurf accounts */}
                                {player.smurfAccounts && player.smurfAccounts.length > 0 && (
                                  <div className="mt-2 pt-2 border-t border-border/40">
                                    <p className="text-xs font-logik-extended-bold text-muted-foreground mb-2">
                                      Konta smerf ({player.smurfAccounts.length})
                                    </p>
                                    <div className="space-y-1.5">
                                      {player.smurfAccounts.map((smurf, sIdx) => {
                                        // Derive steamId64 — prefer direct numeric URL, then resolved vanity
                                        const numericMatch = smurf.steamProfileUrl.match(/\/profiles\/(\d{17,})/);
                                        const steamId64 = numericMatch
                                          ? numericMatch[1]
                                          : (resolvedSmurfIds[smurf.steamProfileUrl] || '');
                                        let smurfDotabuff: string | null = null;
                                        let smurfOpendota: string | null = null;
                                        if (steamId64) {
                                          try {
                                            const smurfAccountId = (BigInt(steamId64) - BigInt('76561197960265728')).toString();
                                            smurfDotabuff = `https://www.dotabuff.com/players/${smurfAccountId}`;
                                            smurfOpendota = `https://www.opendota.com/players/${smurfAccountId}`;
                                          } catch { /* ignore */ }
                                        }
                                        const isPending = !numericMatch && resolvedSmurfIds[smurf.steamProfileUrl] === '';
                                        return (
                                          <div key={sIdx} className="flex flex-wrap gap-3 text-xs pl-2">
                                            <span className="text-muted-foreground font-logik">#{sIdx + 1}</span>
                                            <a
                                              href={smurf.steamProfileUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="flex items-center gap-1 font-logik text-blue-400 hover:text-blue-300 hover:underline"
                                            >
                                              <ExternalLink className="h-3 w-3" />
                                              Steam
                                            </a>
                                            {smurfDotabuff && (
                                              <a
                                                href={smurfDotabuff}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 font-logik text-orange-400 hover:text-orange-300 hover:underline"
                                              >
                                                <ExternalLink className="h-3 w-3" />
                                                Dotabuff
                                              </a>
                                            )}
                                            {smurfOpendota && (
                                              <a
                                                href={smurfOpendota}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 font-logik text-green-400 hover:text-green-300 hover:underline"
                                              >
                                                <ExternalLink className="h-3 w-3" />
                                                OpenDota
                                              </a>
                                            )}
                                            {!smurfDotabuff && !isPending && (
                                              <span className="text-xs text-muted-foreground font-logik">
                                                (nie można rozwiązać URL)
                                              </span>
                                            )}
                                            {isPending && (
                                              <span className="text-xs text-muted-foreground font-logik flex items-center gap-1">
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                Rozwiązywanie...
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Ban confirmation dialog */}
      <AlertDialog open={!!banConfirmTeam} onOpenChange={(open) => { if (!open) { setBanConfirmTeam(null); setBanReason(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-500">
              <Ban className="h-5 w-5" />
              Zbanuj drużynę za oszustwo
            </AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz zbanować drużynę{' '}
              <strong>{banConfirmTeam?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 space-y-3 text-sm text-muted-foreground">
            <p>Ta operacja jest nieodwracalna i spowoduje:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Zmianę statusu drużyny na <strong className="text-foreground">zbanowana</strong></li>
              <li>Usunięcie danych z wszystkich rozegranych meczów (statystyki graczy)</li>
              <li>Zamianę wszystkich meczów na walkowery dla przeciwników</li>
              <li>Ukrycie meczów tej drużyny w widoku harmonogramu</li>
              <li>Przeliczenie tabeli dla wszystkich dotknętych dywizji</li>
            </ul>
          </div>
          <div className="px-1 pb-2">
            <label className="text-sm font-medium font-logik block mb-1.5">Powód bana</label>
            <Input
              placeholder="np. Korzystanie z cheaterów, smurf kont..."
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              className="font-logik"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBanning}>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBanTeam}
              disabled={isBanning}
              className="bg-orange-600 hover:bg-orange-700 focus:ring-orange-600 text-white"
            >
              {isBanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Ban className="h-4 w-4 mr-2" />}
              Zbanuj drużynę
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirmTeam} onOpenChange={(open) => { if (!open) setDeleteConfirmTeam(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń drużynę</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć drużynę <strong>{deleteConfirmTeam?.name}</strong>?
              Ta operacja jest nieodwracalna — wszystkie dane drużyny i graczy zostaną usunięte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTeam}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? <RotateCcw className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Usuń drużynę
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change captain — generate a one-time code to hand to the new captain */}
      <AlertDialog open={!!captainChangeTeam} onOpenChange={(open) => { if (!open) { setCaptainChangeTeam(null); setCaptainCode(null); setCodeCopied(false); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-blue-500">
              <UserCog className="h-5 w-5" />
              Zmień kapitana
            </AlertDialogTitle>
            <AlertDialogDescription>
              Przekaż poniższy jednorazowy kod nowemu kapitanowi drużyny{' '}
              <strong>{captainChangeTeam?.name}</strong>. Po wejściu na stronę{' '}
              <code className="text-foreground">/newcaptain</code>, zalogowaniu się i wpisaniu kodu
              przejmie on drużynę. Kod działa tylko raz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 py-2">
            {isGeneratingCode ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Generowanie kodu...
              </div>
            ) : captainCode ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 text-center text-2xl tracking-[0.3em] font-mono font-bold bg-muted rounded-md py-3 select-all">
                  {captainCode}
                </div>
                <Button variant="outline" size="icon" className="h-12 w-12 flex-shrink-0" onClick={handleCopyCode} title="Kopiuj kod">
                  {codeCopied ? <Check className="h-5 w-5 text-emerald-500" /> : <Copy className="h-5 w-5" />}
                </Button>
              </div>
            ) : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Zamknij</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
