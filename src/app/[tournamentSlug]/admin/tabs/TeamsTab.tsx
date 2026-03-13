"use client";

import React, { useState, useEffect } from 'react';
import { useTournament } from '@/context/TournamentContext';
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
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { collection, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

interface Team {
  id: string;
  name: string;
  tag: string;
  divisionId: string;
  divisionName: string;
  status: 'pending' | 'verified' | 'eliminated';
  playersCount: number;
  captainName: string;
}

/**
 * Teams Tab - Manage team statuses (pending, verified, eliminated)
 * Fetches real team data from the tournament's Firestore collection
 */
export function TeamsTab() {
  const { tournament, theme } = useTournament();
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

  const divisions = tournament?.divisions || [];

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

            // Find captain name from players (captainId is Firebase Auth UID, not steamId — so
            // this lookup may not match; the captainName display is best-effort only)
            const captain = players.find((p: { id: string; nickname?: string }) => p.id === teamData.captainId);
            
            // Get division name from tournament divisions
            const division = divisions.find(d => d.id === teamData.divisionId);

            return {
              id: teamDoc.id,
              name: teamData.name || teamDoc.id,
              tag: teamData.tag || '',
              divisionId: teamData.divisionId || '',
              divisionName: division?.name || teamData.divisionId || 'Brak',
              status: teamData.status || 'pending',
              playersCount: players.length,
              captainName: (captain as { nickname?: string })?.nickname || 'Brak kapitana',
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
  }, [tournament?.id, divisions]);

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
      case 'eliminated':
        return (
          <Badge className="bg-red-500/20 text-red-500 border-red-500/30 font-logik">
            <XCircle className="h-3 w-3 mr-1" />
            Wyeliminowana
          </Badge>
        );
    }
  };

  const statusCounts = {
    all: teams.length,
    pending: teams.filter(t => t.status === 'pending').length,
    verified: teams.filter(t => t.status === 'verified').length,
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <TableHead className="font-logik-extended-bold">Drużyna</TableHead>
              <TableHead className="font-logik-extended-bold">Dywizja</TableHead>
              <TableHead className="font-logik-extended-bold">Kapitan</TableHead>
              <TableHead className="font-logik-extended-bold">Gracze</TableHead>
              <TableHead className="font-logik-extended-bold">Status</TableHead>
              <TableHead className="font-logik-extended-bold w-32">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTeams.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground font-logik">
                  Brak drużyn spełniających kryteria
                </TableCell>
              </TableRow>
            ) : (
              filteredTeams.map(team => (
                <TableRow key={team.id} className="hover:bg-background/50">
                  <TableCell>
                    <Checkbox 
                      checked={selectedTeams.includes(team.id)}
                      onCheckedChange={() => toggleTeamSelection(team.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center font-logik-extended-bold">
                        {team.tag}
                      </div>
                      <div>
                        <p className="font-logik-extended-bold">{team.name}</p>
                        <p className="text-sm text-muted-foreground font-logik">[{team.tag}]</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-logik">{team.divisionName}</Badge>
                  </TableCell>
                  <TableCell className="font-logik">{team.captainName}</TableCell>
                  <TableCell className="font-logik">{team.playersCount}/5</TableCell>
                  <TableCell>{getStatusBadge(team.status)}</TableCell>
                  <TableCell>
                    <Select 
                      value={team.status} 
                      onValueChange={(v) => updateTeamStatus(team.id, v as Team['status'])}
                    >
                      <SelectTrigger className="w-full font-logik h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Oczekuje</SelectItem>
                        <SelectItem value="verified">Zweryfikowana</SelectItem>
                        <SelectItem value="eliminated">Wyeliminowana</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
