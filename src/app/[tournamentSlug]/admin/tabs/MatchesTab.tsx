"use client";

import React, { useState } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc, collection, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
  Search,
  Edit2,
  Trash2,
  Upload,
  Plus,
  Calendar,
  Clock,
  ExternalLink,
  FileDown,
} from 'lucide-react';

interface Match {
  id: string;
  team1: string;
  team2: string;
  score1: number;
  score2: number;
  status: 'scheduled' | 'live' | 'completed' | 'postponed';
  date: string;
  time: string;
  division: string;
  round: number;
  games: number;
}

/**
 * Matches Tab - Score editing, game deletion, match import, reschedule
 */
export function MatchesTab() {
  const { tournament, theme, refetchTournament } = useTournament();
  const { toast } = useToast();
  
  const [matches, setMatches] = useState<Match[]>([
    { id: '1', team1: 'Team Liquid', team2: 'OG Esports', score1: 2, score2: 0, status: 'completed', date: '2025-02-20', time: '20:00', division: 'Elite', round: 1, games: 2 },
    { id: '2', team1: 'Nowi Challengers', team2: 'Test Team', score1: 0, score2: 0, status: 'scheduled', date: '2025-02-27', time: '20:00', division: 'Challenger', round: 1, games: 0 },
  ]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [matchIdToImport, setMatchIdToImport] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
          score1: match.score1,
          score2: match.score2,
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

  const handleImportMatch = async () => {
    if (!matchIdToImport) return;
    setIsImporting(true);
    // TODO: Implement match import from OpenDota
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsImporting(false);
    setShowImportDialog(false);
    setMatchIdToImport('');
  };

  const updateMatchScore = (matchId: string, team: 'team1' | 'team2', score: number) => {
    setMatches(matches.map(m => 
      m.id === matchId ? { ...m, [team === 'team1' ? 'score1' : 'score2']: score } : m
    ));
  };

  const deleteMatch = (matchId: string) => {
    setMatches(matches.filter(m => m.id !== matchId));
  };

  const filteredMatches = matches.filter(match => {
    if (searchQuery && 
        !match.team1.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !match.team2.toLowerCase().includes(searchQuery.toLowerCase())) {
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
      case 'postponed':
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 font-logik">Przełożony</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-logik-extended-bold">Zarządzanie meczami</h2>
          <p className="text-muted-foreground font-logik">
            Edycja wyników, import meczów, przesunięcia terminów
          </p>
        </div>
        <div className="flex items-center gap-3">
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
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <Gamepad2 className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Lista meczów
          </CardTitle>
          <CardDescription className="font-logik">
            {filteredMatches.length} meczów
          </CardDescription>
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
                          <p className="font-logik-extended-bold">{match.team1}</p>
                        </div>
                        <span className="text-muted-foreground font-logik">vs</span>
                        <div className="text-left">
                          <p className="font-logik-extended-bold">{match.team2}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          max="3"
                          value={match.score1}
                          onChange={(e) => updateMatchScore(match.id, 'team1', Number(e.target.value))}
                          className="w-12 text-center font-logik-extended-bold h-8"
                        />
                        <span className="text-muted-foreground">:</span>
                        <Input
                          type="number"
                          min="0"
                          max="3"
                          value={match.score2}
                          onChange={(e) => updateMatchScore(match.id, 'team2', Number(e.target.value))}
                          className="w-12 text-center font-logik-extended-bold h-8"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-logik">{match.division}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm font-logik">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {match.date}
                        <Clock className="h-4 w-4 text-muted-foreground ml-2" />
                        {match.time}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(match.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          onClick={() => deleteMatch(match.id)}
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
    </div>
  );
}
