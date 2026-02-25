"use client";

import React, { useState, useEffect } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc, collection, getDocs, addDoc, writeBatch, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { 
  CalendarDays,
  Save,
  RotateCcw,
  Clock,
  Plus,
  Trash2,
  Edit2,
  Check,
  Sparkles,
  Info,
  Zap,
  Loader2,
} from 'lucide-react';
import { 
  generateDivisionSchedule, 
  calculateTotalMatchdays, 
  calculateTotalMatches,
  generateMatchdayStructure,
  convertMatchdaysToMatches,
  type DivisionScheduleConfig,
  type Team,
  type Matchday as ScheduleMatchday,
  type DivisionSchedule 
} from '@/lib/schedule-generator';
import { 
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';

interface MatchDay {
  id: string;
  divisionId: string;
  divisionName: string;
  date: string;
  time: string;
  round: number;
}

/**
 * Scheduling Tab - Manage matchday dates per division and generate full schedules
 */
export function SchedulingTab() {
  const { tournament, theme } = useTournament();
  
  const [matchdays, setMatchdays] = useState<MatchDay[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [selectedRound, setSelectedRound] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [divisionTeams, setDivisionTeams] = useState<Record<string, Team[]>>({});
  const [scheduleConfig, setScheduleConfig] = useState<Record<string, { startDate: string; matchday: string }>>({});
  const [selectedRoundForGeneration, setSelectedRoundForGeneration] = useState<number>(1);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [isLoadingDivisions, setIsLoadingDivisions] = useState(false);
  
  // Two-phase scheduling: structure generation then date assignment
  const [generatedStructures, setGeneratedStructures] = useState<DivisionSchedule[]>([]);
  const [selectedDivisionForScheduling, setSelectedDivisionForScheduling] = useState<string | null>(null);
  const [matchdayDates, setMatchdayDates] = useState<Record<string, Record<number, { date: string; time: string }>>>({});
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [createdMatches, setCreatedMatches] = useState<any[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [rescheduleRequests, setRescheduleRequests] = useState<any[]>([]);
  const [isLoadingReschedules, setIsLoadingReschedules] = useState(false);
  
  // New matchday form state
  const [newMatchday, setNewMatchday] = useState({
    divisionId: '',
    date: '',
    time: '20:00',
    round: 1,
  });

  const { toast } = useToast();

  // Load divisions from database
  useEffect(() => {
    const loadDivisions = async () => {
      if (!tournament?.id) return;
      
      try {
        setIsLoadingDivisions(true);
        const divisionsRef = collection(db, 'tournaments', tournament.id, 'divisions');
        const divisionsSnapshot = await getDocs(divisionsRef);
        
        const divisionsData = divisionsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || doc.id,
          tier: doc.data().tier || 0,
          color: doc.data().color || '#666666',
          matchday: doc.data().matchday || 'Thursday 20:00',
        }));
        
        // Sort by tier
        divisionsData.sort((a, b) => a.tier - b.tier);
        
        console.log('Loaded divisions:', divisionsData);
        setDivisions(divisionsData);
      } catch (error) {
        console.error('Error loading divisions:', error);
      } finally {
        setIsLoadingDivisions(false);
      }
    };
    
    loadDivisions();
  }, [tournament?.id]);

  // Load teams for each division
  useEffect(() => {
    const loadTeams = async () => {
      if (!tournament?.id) return;
      
      console.log('Loading teams for divisions:', divisions);
      
      try {
        const teamsRef = collection(db, 'tournaments', tournament.id, 'teams');
        const snapshot = await getDocs(teamsRef);
        const teams = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as any[];
        
        console.log('Loaded teams:', teams);
        
        // Group by division
        const grouped: Record<string, Team[]> = {};
        teams.forEach(team => {
          const divId = team.divisionId || 'unknown';
          if (!grouped[divId]) grouped[divId] = [];
          grouped[divId].push({
            id: team.id,
            name: team.name,
            logoUrl: team.logoUrl,
            divisionId: divId,
          });
        });
        
        console.log('Grouped teams by division:', grouped);
        setDivisionTeams(grouped);
        
        // Initialize schedule config with defaults
        const config: Record<string, { startDate: string; matchday: string }> = {};
        divisions.forEach(div => {
          const nextWeek = new Date();
          nextWeek.setDate(nextWeek.getDate() + 7);
          config[div.id] = {
            startDate: nextWeek.toISOString().split('T')[0],
            matchday: div.matchday || 'Thursday 20:00',
          };
        });
        setScheduleConfig(config);
      } catch (error) {
        console.error('Error loading teams:', error);
      }
    };
    
    loadTeams();
  }, [tournament?.id, divisions.length]);

  // Load created matches for viewing
  useEffect(() => {
    const loadCreatedMatches = async () => {
      if (!tournament?.id) return;
      
      setIsLoadingMatches(true);
      try {
        const matchesRef = collection(db, 'tournaments', tournament.id, 'matches');
        const snapshot = await getDocs(matchesRef);
        const matches = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        console.log('[SchedulingTab] Loaded matches:', matches.length);
        setCreatedMatches(matches);
        
        // Extract reschedule requests from matches
        const requests = matches
          .filter((m: any) => m.rescheduleRequest)
          .map((m: any) => ({
            matchId: m.id,
            teamAName: m.teamA?.name || 'Team A',
            teamBName: m.teamB?.name || 'Team B',
            divisionId: m.divisionId || m.group_id,
            round: m.round,
            matchday: m.matchday,
            originalDate: m.rescheduleRequest.originalDate,
            proposedDate: m.rescheduleRequest.proposedDate,
            requestedBy: m.rescheduleRequest.requestedBy,
            requestedByName: m.rescheduleRequest.requestedByName,
            status: m.rescheduleRequest.status,
          }));
        setRescheduleRequests(requests);
      } catch (error) {
        console.error('Error loading matches:', error);
      } finally {
        setIsLoadingMatches(false);
      }
    };
    
    loadCreatedMatches();
  }, [tournament?.id]);

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
      const tournamentRef = doc(db, 'tournaments', tournament.id);
      await updateDoc(tournamentRef, {
        matchdays: matchdays,
        updatedAt: new Date().toISOString(),
      });

      toast({
        title: 'Zapisano',
        description: 'Harmonogram meczów został zaktualizowany',
        action: <CheckCircle className="h-5 w-5 text-green-500" />,
      });

      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się zapisać harmonogramu',
        variant: 'destructive',
        action: <AlertCircle className="h-5 w-5" />,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const addMatchday = () => {
    if (!newMatchday.divisionId || !newMatchday.date) return;
    
    const division = divisions.find(d => d.id === newMatchday.divisionId);
    const matchday: MatchDay = {
      id: `matchday-${Date.now()}`,
      divisionId: newMatchday.divisionId,
      divisionName: division?.name || 'Unknown',
      date: newMatchday.date,
      time: newMatchday.time,
      round: newMatchday.round,
    };
    
    setMatchdays([...matchdays, matchday]);
    setNewMatchday({ divisionId: '', date: '', time: '20:00', round: 1 });
    setShowAddForm(false);
  };

  const removeMatchday = (id: string) => {
    setMatchdays(matchdays.filter(m => m.id !== id));
  };

  const filteredMatchdays = matchdays.filter(m => {
    if (selectedDivision !== 'all' && m.divisionId !== selectedDivision) return false;
    if (selectedRound !== 'all' && m.round !== Number(selectedRound)) return false;
    return true;
  });

  const getDayOfWeek = (dateStr: string) => {
    const days = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
    const date = new Date(dateStr);
    return days[date.getDay()];
  };

  const handleGenerateSchedule = async () => {
    if (!tournament?.id) {
      toast({
        title: 'Błąd',
        description: 'Nie znaleziono ID turnieju',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const structures: DivisionSchedule[] = [];

      // Generate matchday structures for each division
      for (const division of divisions) {
        const teams = divisionTeams[division.id] || [];
        
        if (teams.length < 2) {
          console.warn(`Skipping division ${division.name}: not enough teams`);
          continue;
        }

        const structure = generateMatchdayStructure(
          division.id,
          division.name,
          teams,
          selectedRoundForGeneration
        );

        structures.push(structure);
      }

      setGeneratedStructures(structures);

      toast({
        title: 'Sukces!',
        description: `Wygenerowano strukturę meczów dla rundy ${selectedRoundForGeneration}. Teraz przypisz daty i godziny do każdego dnia meczowego.`,
        action: <CheckCircle className="h-5 w-5 text-green-500" />,
      });
    } catch (error) {
      console.error('Error generating schedule structure:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się wygenerować struktury harmonogramu',
        variant: 'destructive',
        action: <AlertCircle className="h-5 w-5" />,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFinalizeSchedule = async () => {
    if (!tournament?.id) {
      toast({
        title: 'Błąd',
        description: 'Nie znaleziono ID turnieju',
        variant: 'destructive',
      });
      return;
    }

    // Validate that all matchdays have dates/times assigned
    const missingDates = generatedStructures.some(struct =>
      struct.matchdays.some(md => {
        const divisionDates = matchdayDates[struct.divisionId];
        return !divisionDates || !divisionDates[md.matchdayNumber] || 
               !divisionDates[md.matchdayNumber].date || 
               !divisionDates[md.matchdayNumber].time;
      })
    );

    if (missingDates) {
      toast({
        title: 'Błąd',
        description: 'Przypisz daty i godziny do wszystkich dni meczowych przed finalizacją',
        variant: 'destructive',
      });
      return;
    }

    setIsFinalizing(true);
    try {
      console.log('[SchedulingTab] Starting finalize with structures:', generatedStructures);
      console.log('[SchedulingTab] Matchday dates:', matchdayDates);

      const matchesRef = collection(db, 'tournaments', tournament.id, 'matches');
      let totalMatches = 0;
      const allMatches: any[] = [];

      // Convert structures with dates to matches
      for (const structure of generatedStructures) {
        const divisionDates = matchdayDates[structure.divisionId];
        
        console.log(`[SchedulingTab] Processing division ${structure.divisionId}:`, structure);
        
        // Assign dates to matchdays
        const matchdaysWithDates = structure.matchdays.map(md => ({
          ...md,
          date: divisionDates[md.matchdayNumber].date,
          time: divisionDates[md.matchdayNumber].time,
        }));

        console.log(`[SchedulingTab] Matchdays with dates:`, matchdaysWithDates);

        // Convert to match objects
        const matches = convertMatchdaysToMatches(matchdaysWithDates);

        console.log(`[SchedulingTab] Generated ${matches.length} matches for division ${structure.divisionId}`);

        // Prepare match data
        matches.forEach((match, index) => {
          const matchRef = doc(matchesRef);
          const matchData = {
            ...match,
            id: matchRef.id,
            tournamentId: tournament.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            schedulingStatus: 'confirmed',
            schedulingMethod: 'admin-scheduled',
            format: match.series_format,
            result: null,
            winner: null,
            game_ids: [],
          };
          
          allMatches.push({ ref: matchRef, data: matchData });
        });

        totalMatches += matches.length;
      }

      console.log(`[SchedulingTab] Total matches to create: ${totalMatches}`);

      // Split into batches of 500 (Firestore limit)
      const batchSize = 500;
      const batches = [];
      
      for (let i = 0; i < allMatches.length; i += batchSize) {
        batches.push(allMatches.slice(i, i + batchSize));
      }

      console.log(`[SchedulingTab] Splitting into ${batches.length} batch(es)`);

      // Commit each batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = writeBatch(db);
        const currentBatch = batches[batchIndex];
        
        currentBatch.forEach(({ ref, data }) => {
          console.log(`[SchedulingTab] Batch ${batchIndex + 1}/${batches.length} - Adding match:`, data);
          batch.set(ref, data);
        });

        console.log(`[SchedulingTab] Committing batch ${batchIndex + 1}/${batches.length} with ${currentBatch.length} matches...`);
        await batch.commit();
        console.log(`[SchedulingTab] Batch ${batchIndex + 1}/${batches.length} committed successfully!`);
      }

      console.log('[SchedulingTab] All batches committed successfully!');

      toast({
        title: 'Sukces!',
        description: `Utworzono ${totalMatches} meczów dla rundy ${selectedRoundForGeneration}`,
        action: <CheckCircle className="h-5 w-5 text-green-500" />,
      });

      // Reset state
      setGeneratedStructures([]);
      setMatchdayDates({});

      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('[SchedulingTab] Error finalizing schedule:', error);
      console.error('[SchedulingTab] Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      toast({
        title: 'Błąd',
        description: `Nie udało się sfinalizować harmonogramu: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
        action: <AlertCircle className="h-5 w-5" />,
      });
    } finally {
      setIsFinalizing(false);
    }
  };

  const updateMatchdayDate = (divisionId: string, matchdayNumber: number, field: 'date' | 'time', value: string) => {
    setMatchdayDates(prev => ({
      ...prev,
      [divisionId]: {
        ...prev[divisionId],
        [matchdayNumber]: {
          ...(prev[divisionId]?.[matchdayNumber] || { date: '', time: '20:00' }),
          [field]: value,
        },
      },
    }));
  };

  const autoFillDates = (divisionId: string, startDate: string, matchdayTime: string, weeksInterval: number = 1) => {
    const structure = generatedStructures.find(s => s.divisionId === divisionId);
    if (!structure) return;

    const newDates: Record<number, { date: string; time: string }> = {};
    const start = new Date(startDate);

    structure.matchdays.forEach((md, index) => {
      const matchDate = new Date(start);
      matchDate.setDate(start.getDate() + (index * weeksInterval * 7));
      
      newDates[md.matchdayNumber] = {
        date: matchDate.toISOString().split('T')[0],
        time: matchdayTime,
      };
    });

    setMatchdayDates(prev => ({
      ...prev,
      [divisionId]: newDates,
    }));

    toast({
      title: 'Uzupełniono daty',
      description: `Automatycznie przypisano daty dla ${structure.divisionName}`,
    });
  };

  const handleDeleteRoundMatches = async () => {
    if (!tournament?.id) {
      toast({
        title: 'Błąd',
        description: 'Nie znaleziono ID turnieju',
        variant: 'destructive',
      });
      return;
    }

    const confirmed = window.confirm(
      `Czy na pewno chcesz usunąć WSZYSTKIE mecze rundy ${selectedRoundForGeneration}?\n\nTa operacja jest nieodwracalna!`
    );

    if (!confirmed) return;

    setIsDeleting(true);
    try {
      console.log(`[SchedulingTab] Deleting all matches for round ${selectedRoundForGeneration}...`);

      const matchesRef = collection(db, 'tournaments', tournament.id, 'matches');
      const q = query(matchesRef, where('round', '==', selectedRoundForGeneration));
      const snapshot = await getDocs(q);

      console.log(`[SchedulingTab] Found ${snapshot.docs.length} matches to delete`);

      if (snapshot.docs.length === 0) {
        toast({
          title: 'Info',
          description: `Nie znaleziono meczów dla rundy ${selectedRoundForGeneration}`,
        });
        return;
      }

      // Delete in batches of 500
      const batchSize = 500;
      const batches = [];
      
      for (let i = 0; i < snapshot.docs.length; i += batchSize) {
        batches.push(snapshot.docs.slice(i, i + batchSize));
      }

      console.log(`[SchedulingTab] Deleting in ${batches.length} batch(es)`);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = writeBatch(db);
        const currentBatch = batches[batchIndex];
        
        currentBatch.forEach(docSnapshot => {
          batch.delete(docSnapshot.ref);
        });

        console.log(`[SchedulingTab] Deleting batch ${batchIndex + 1}/${batches.length} with ${currentBatch.length} matches...`);
        await batch.commit();
        console.log(`[SchedulingTab] Batch ${batchIndex + 1}/${batches.length} deleted successfully!`);
      }

      console.log('[SchedulingTab] All matches deleted successfully!');

      toast({
        title: 'Sukces!',
        description: `Usunięto ${snapshot.docs.length} meczów z rundy ${selectedRoundForGeneration}`,
        action: <CheckCircle className="h-5 w-5 text-green-500" />,
      });

      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('[SchedulingTab] Error deleting matches:', error);
      toast({
        title: 'Błąd',
        description: `Nie udało się usunąć meczów: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
        action: <AlertCircle className="h-5 w-5" />,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const updateScheduleConfig = (divisionId: string, field: 'startDate' | 'matchday', value: string) => {
    setScheduleConfig(prev => ({
      ...prev,
      [divisionId]: {
        ...prev[divisionId],
        [field]: value,
      },
    }));
  };

  if (isLoadingDivisions) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin" style={{ color: theme.primaryColor }} />
          <p className="text-muted-foreground font-logik">Ładowanie dywizji...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-logik-extended-bold">Harmonogram meczów</h2>
          <p className="text-muted-foreground font-logik">
            Planowanie dat i godzin meczów dla każdej dywizji
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline"
            onClick={() => setShowAddForm(true)}
            className="font-logik"
          >
            <Plus className="h-4 w-4 mr-2" />
            Dodaj dzień meczowy
          </Button>
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

      {/* Schedule Generation Section */}
      <Card className="border-0 shadow-xl bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur-sm border-2 border-primary/20">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/20">
                <Sparkles className="h-6 w-6" style={{ color: theme.primaryColor }} />
              </div>
              <div>
                <CardTitle className="font-logik-extended-bold text-xl">Generator Harmonogramu (2-fazowy)</CardTitle>
                <CardDescription className="font-logik mt-1">
                  {generatedStructures.length === 0 
                    ? 'Krok 1: Generuj pary meczowe • Krok 2: Przypisz daty'
                    : `Krok 2: Przypisz daty i godziny do ${generatedStructures.length} dywizji`
                  }
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle className="font-logik-extended-bold">Jak to działa?</AlertTitle>
            <AlertDescription className="font-logik">
              <strong>Krok 1:</strong> Wygeneruj strukturę meczów (pary drużyn w dni meczowe) używając algorytmu round-robin.
              <br />
              <strong>Krok 2:</strong> Przypisz daty i godziny dla każdego dnia meczowego w każdej dywizji osobno.
              <br />
              <strong>Krok 3:</strong> Finalizuj harmonogram - mecze zostaną utworzone w bazie danych.
            </AlertDescription>
          </Alert>

          {generatedStructures.length === 0 ? (
            // Phase 1: Generate structure
            <>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <Label className="font-logik-extended-bold">Runda do wygenerowania:</Label>
                  <Select 
                    value={selectedRoundForGeneration.toString()}
                    onValueChange={(v) => setSelectedRoundForGeneration(Number(v))}
                  >
                    <SelectTrigger className="w-32 font-logik">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(r => (
                        <SelectItem key={r} value={r.toString()}>Runda {r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground font-logik">
                    Struktura zostanie wygenerowana dla tej rundy
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-logik-extended-bold flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Przegląd dywizji
                </h3>
                
                {divisions.map(division => {
                  const teams = divisionTeams[division.id] || [];
                  const totalMatchdays = calculateTotalMatchdays(teams.length, 1);
                  const totalMatches = calculateTotalMatches(teams.length, 1);

                  return (
                    <Card key={division.id} className="border border-border/50">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Label className="font-logik font-bold text-lg" style={{ color: division.color }}>
                              {division.name}
                            </Label>
                            <p className="text-sm text-muted-foreground font-logik">
                              {teams.length} drużyn • {totalMatches} meczów • {totalMatchdays} dni meczowych
                            </p>
                          </div>
                          <Badge variant="outline" className="font-logik">
                            {division.matchday || 'Nie ustawiono'}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground font-logik">
                  <strong>Krok 1 z 3:</strong> Wygeneruj pary meczowe dla rundy {selectedRoundForGeneration}
                </p>
                <Button
                  onClick={handleGenerateSchedule}
                  disabled={isGenerating || divisions.length === 0}
                  className="font-logik-extended-bold"
                  style={{ backgroundColor: theme.primaryColor }}
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <RotateCcw className="h-5 w-5 mr-2 animate-spin" />
                      Generowanie...
                    </>
                  ) : (
                    <>
                      <Zap className="h-5 w-5 mr-2" />
                      Generuj strukturę meczów
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            // Phase 2: Assign dates
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="font-logik-extended-bold">
                      Struktura wygenerowana dla rundy {selectedRoundForGeneration}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setGeneratedStructures([]);
                      setMatchdayDates({});
                    }}
                    className="font-logik"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Generuj od nowa
                  </Button>
                </div>

                <h3 className="font-logik-extended-bold flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Przypisz daty i godziny
                </h3>

                {generatedStructures.map(structure => {
                  const division = divisions.find(d => d.id === structure.divisionId);
                  const divisionDates = matchdayDates[structure.divisionId] || {};
                  const allAssigned = structure.matchdays.every(md => 
                    divisionDates[md.matchdayNumber]?.date && divisionDates[md.matchdayNumber]?.time
                  );

                  return (
                    <Card key={structure.divisionId} className="border border-border/50">
                      <CardContent className="pt-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Label className="font-logik font-bold text-lg" style={{ color: division?.color }}>
                              {structure.divisionName}
                            </Label>
                            {allAssigned && (
                              <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Gotowe
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="date"
                              placeholder="Data rozpoczęcia"
                              className="w-40 font-logik text-sm"
                              onChange={(e) => {
                                const startDate = e.target.value;
                                if (startDate) {
                                  autoFillDates(structure.divisionId, startDate, division?.matchday.split(' ')[1] || '20:00');
                                }
                              }}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const firstDate = divisionDates[structure.matchdays[0]?.matchdayNumber]?.date;
                                if (firstDate) {
                                  autoFillDates(structure.divisionId, firstDate, division?.matchday.split(' ')[1] || '20:00');
                                }
                              }}
                              className="font-logik text-xs"
                              disabled={!divisionDates[structure.matchdays[0]?.matchdayNumber]?.date}
                            >
                              <Zap className="h-3 w-3 mr-1" />
                              Autouzupełnij
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                          {structure.matchdays.map(matchday => {
                            const mdDate = divisionDates[matchday.matchdayNumber];
                            return (
                              <div key={matchday.matchdayNumber} className="flex items-center gap-3 p-3 bg-background/50 rounded-lg border border-border">
                                <Label className="font-logik font-bold w-32">
                                  Dzień {matchday.matchdayNumber}
                                </Label>
                                <div className="flex items-center gap-6 flex-1">
                                  <div className="flex items-center gap-2">
                                    <Label className="text-xs text-muted-foreground font-logik">Data:</Label>
                                    <Input
                                      type="date"
                                      value={mdDate?.date || ''}
                                      onChange={(e) => updateMatchdayDate(structure.divisionId, matchday.matchdayNumber, 'date', e.target.value)}
                                      className="w-40 font-logik"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Label className="text-xs text-muted-foreground font-logik">Godzina:</Label>
                                    <Input
                                      type="time"
                                      value={mdDate?.time || '20:00'}
                                      onChange={(e) => updateMatchdayDate(structure.divisionId, matchday.matchdayNumber, 'time', e.target.value)}
                                      className="w-32 font-logik"
                                    />
                                  </div>
                                  <p className="text-sm text-muted-foreground font-logik">
                                    {matchday.pairings.length} par meczowych
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground font-logik">
                  <strong>Krok 2 z 3:</strong> Przypisz daty i godziny do wszystkich dni meczowych, następnie finalizuj
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleDeleteRoundMatches}
                    disabled={isDeleting || isFinalizing}
                    variant="destructive"
                    className="font-logik-extended-bold"
                    size="lg"
                  >
                    {isDeleting ? (
                      <>
                        <RotateCcw className="h-5 w-5 mr-2 animate-spin" />
                        Usuwanie...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-5 w-5 mr-2" />
                        Usuń mecze rundy {selectedRoundForGeneration}
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleFinalizeSchedule}
                    disabled={isFinalizing || isDeleting}
                    className="font-logik-extended-bold"
                    style={{ backgroundColor: theme.primaryColor }}
                    size="lg"
                  >
                    {isFinalizing ? (
                      <>
                        <RotateCcw className="h-5 w-5 mr-2 animate-spin" />
                        Finalizowanie...
                      </>
                    ) : (
                      <>
                        <Check className="h-5 w-5 mr-2" />
                        Finalizuj harmonogram ({generatedStructures.reduce((sum, s) => sum + s.matchdays.reduce((msum, m) => msum + m.pairings.length, 0), 0)} meczów)
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add Form Modal */}
      {showAddForm && (
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm border-2 border-primary/30">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
              <Plus className="h-5 w-5" style={{ color: theme.primaryColor }} />
              Nowy dzień meczowy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="font-logik">Dywizja</Label>
                <Select 
                  value={newMatchday.divisionId}
                  onValueChange={(v) => setNewMatchday({ ...newMatchday, divisionId: v })}
                >
                  <SelectTrigger className="font-logik">
                    <SelectValue placeholder="Wybierz dywizję" />
                  </SelectTrigger>
                  <SelectContent>
                    {divisions.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-logik">Data</Label>
                <Input
                  type="date"
                  value={newMatchday.date}
                  onChange={(e) => setNewMatchday({ ...newMatchday, date: e.target.value })}
                  className="font-logik"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-logik">Godzina</Label>
                <Input
                  type="time"
                  value={newMatchday.time}
                  onChange={(e) => setNewMatchday({ ...newMatchday, time: e.target.value })}
                  className="font-logik"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-logik">Runda</Label>
                <Select 
                  value={newMatchday.round.toString()}
                  onValueChange={(v) => setNewMatchday({ ...newMatchday, round: Number(v) })}
                >
                  <SelectTrigger className="font-logik">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(r => (
                      <SelectItem key={r} value={r.toString()}>Runda {r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
              <Button 
                variant="outline" 
                onClick={() => setShowAddForm(false)}
                className="font-logik"
              >
                Anuluj
              </Button>
              <Button 
                onClick={addMatchday}
                className="font-logik"
                style={{ backgroundColor: theme.primaryColor }}
              >
                <Check className="h-4 w-4 mr-2" />
                Dodaj
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="font-logik text-muted-foreground">Dywizja:</Label>
              <Select value={selectedDivision} onValueChange={setSelectedDivision}>
                <SelectTrigger className="w-40 font-logik">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie</SelectItem>
                  {divisions.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="font-logik text-muted-foreground">Runda:</Label>
              <Select value={selectedRound} onValueChange={setSelectedRound}>
                <SelectTrigger className="w-32 font-logik">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie</SelectItem>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(r => (
                    <SelectItem key={r} value={r.toString()}>Runda {r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reschedule Requests Overview */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <CalendarDays className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Prośby o zmianę terminu
          </CardTitle>
          <CardDescription className="font-logik">
            Przegląd wszystkich wniosków o przełożenie meczów
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rescheduleRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground font-logik">
              <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Brak próśb o zmianę terminu</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rescheduleRequests.map((req, idx) => {
                const isPending = req.status === 'pending';
                const isApproved = req.status === 'approved';
                const isRejected = req.status === 'rejected';
                
                return (
                  <div 
                    key={idx}
                    className={cn(
                      "p-4 rounded-lg border transition-colors",
                      isPending && "border-yellow-500/30 bg-yellow-500/5",
                      isApproved && "border-green-500/30 bg-green-500/5",
                      isRejected && "border-red-500/30 bg-red-500/5"
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-logik-extended-bold">{req.teamAName} vs {req.teamBName}</p>
                        <p className="text-sm text-muted-foreground font-logik">
                          Runda {req.round} • Dzień meczowy {req.matchday}
                        </p>
                      </div>
                      <Badge 
                        className={cn(
                          "font-logik",
                          isPending && "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
                          isApproved && "bg-green-500/20 text-green-400 border-green-500/30",
                          isRejected && "bg-red-500/20 text-red-400 border-red-500/30"
                        )}
                      >
                        {isPending && '⏳ Oczekuje'}
                        {isApproved && '✓ Zatwierdzony'}
                        {isRejected && '✗ Odrzucony'}
                      </Badge>
                    </div>
                    <div className="mt-2 space-y-1 text-sm font-logik">
                      <p className="text-muted-foreground">
                        <span className="font-logik-extended-bold">Wnioskodawca:</span> {req.requestedByName}
                      </p>
                      <p className="text-muted-foreground">
                        <span className="font-logik-extended-bold">Oryginalny termin:</span> {req.originalDate ? new Date(req.originalDate).toLocaleString('pl-PL') : '-'}
                      </p>
                      <p className="text-muted-foreground">
                        <span className="font-logik-extended-bold">Proponowany termin:</span> {req.proposedDate ? new Date(req.proposedDate).toLocaleString('pl-PL') : '-'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Matchdays List */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <Clock className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Utworzone mecze
          </CardTitle>
          <CardDescription className="font-logik">
            {createdMatches.length} meczów w bazie danych
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingMatches ? (
            <div className="text-center py-8 text-muted-foreground font-logik">
              <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin" style={{ color: theme.primaryColor }} />
              <p>Ładowanie meczów...</p>
            </div>
          ) : createdMatches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground font-logik">
              <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Brak utworzonych meczów</p>
              <p className="text-sm mt-2">Wygeneruj harmonogram aby utworzyć mecze</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Group by round and matchday */}
              {Object.entries(
                createdMatches
                  .filter(m => selectedRound === 'all' || m.round === Number(selectedRound))
                  .filter(m => selectedDivision === 'all' || m.divisionId === selectedDivision || m.group_id === selectedDivision)
                  .reduce((acc, match) => {
                    const key = `R${match.round}-M${match.matchday}`;
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(match);
                    return acc;
                  }, {} as Record<string, any[]>)
              )
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, matchesGroup]) => {
                  const matches = matchesGroup as any[];
                  const [roundPart, matchdayPart] = key.split('-');
                  const round = roundPart.replace('R', '');
                  const matchday = matchdayPart.replace('M', '');
                  const sampleMatch = matches[0];
                  const dateStr = sampleMatch.scheduledFor || sampleMatch.scheduled_for || '';
                  const date = dateStr ? new Date(dateStr) : null;

                  return (
                    <div 
                      key={key}
                      className="p-4 rounded-xl border border-border hover:bg-background/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="font-logik">
                            Runda {round} • Dzień {matchday}
                          </Badge>
                          {date && (
                            <span className="text-sm text-muted-foreground font-logik">
                              {date.toLocaleDateString('pl-PL', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          )}
                        </div>
                        <Badge className="font-logik">
                          {matches.length} {matches.length === 1 ? 'mecz' : 'meczy'}
                        </Badge>
                      </div>
                      <div className="space-y-2 pl-6">
                        {matches.slice(0, 5).map(match => (
                          <div key={match.id} className="text-sm text-muted-foreground font-logik">
                            {match.teamA?.name || 'Team A'} vs {match.teamB?.name || 'Team B'}
                          </div>
                        ))}
                        {matches.length > 5 && (
                          <div className="text-sm text-muted-foreground/60 font-logik italic">
                            ... i {matches.length - 5} więcej
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Matchdays List (Legacy - Manual Entry) */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <Clock className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Lista dni meczowych (ręczne wpisy)
          </CardTitle>
          <CardDescription className="font-logik">
            {filteredMatchdays.length} dni meczowych
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredMatchdays.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground font-logik">
              <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Brak zaplanowanych dni meczowych</p>
              <p className="text-sm mt-2">Kliknij "Dodaj dzień meczowy" aby zaplanować pierwszy termin</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMatchdays.map(matchday => (
                <div 
                  key={matchday.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-border hover:bg-background/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Badge 
                      variant="outline" 
                      className="font-logik"
                    >
                      {matchday.divisionName}
                    </Badge>
                    <div>
                      <p className="font-logik-extended-bold">
                        {getDayOfWeek(matchday.date)}, {matchday.date}
                      </p>
                      <p className="text-sm text-muted-foreground font-logik">
                        Godzina {matchday.time} • Runda {matchday.round}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMatchday(matchday.id)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
