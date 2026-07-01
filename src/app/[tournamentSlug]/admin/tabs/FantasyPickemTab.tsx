"use client";

import React, { useState, useEffect } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Trophy,
  Target,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Sparkles,
  Plus,
  Trash2,
  Star,
  Download,
} from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

interface FantasyRound {
  id: string;
  name: string;
  lockDeadline: string;
  isCurrent: boolean;
  createdAt?: string;
}

/**
 * Fantasy & Pick'em Tab - Round management and recalculation
 */
export function FantasyPickemTab() {
  const { tournament, theme } = useTournament();
  const { toast } = useToast();

  const panelBackground = 'rgba(3, 8, 20, 0.72)';
  const sectionBackground = 'rgba(2, 6, 23, 0.45)';
  const panelBorder = 'rgba(148, 163, 184, 0.35)';
  const primaryText = 'rgba(241, 245, 249, 0.96)';
  const secondaryText = 'rgba(203, 213, 225, 0.86)';
  const subtleText = 'rgba(148, 163, 184, 0.92)';
  
  const [rounds, setRounds] = useState<FantasyRound[]>([]);
  const [loadingRounds, setLoadingRounds] = useState(true);
  const [newRoundName, setNewRoundName] = useState('');
  const [newRoundDeadline, setNewRoundDeadline] = useState('');
  const [isSavingRound, setIsSavingRound] = useState(false);
  const [deletingRoundId, setDeletingRoundId] = useState<string | null>(null);
  const [byeTeamsCount, setByeTeamsCount] = useState<number>(0);
  const [pickemInstructionsMarkdown, setPickemInstructionsMarkdown] = useState('');
  const [pickemSubmissionDeadline, setPickemSubmissionDeadline] = useState('');
  const [isSavingPickemSettings, setIsSavingPickemSettings] = useState(false);

  // Load fantasy rounds
  useEffect(() => {
    const loadRounds = async () => {
      if (!tournament?.id) return;
      try {
        const roundsRef = collection(db, 'tournaments', tournament.id, 'fantasyRounds');
        const snap = await getDocs(roundsRef);
        const loaded = snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
        })) as FantasyRound[];
        loaded.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        setRounds(loaded);
      } catch {
        // Collection may not exist
        setRounds([]);
      } finally {
        setLoadingRounds(false);
      }
    };
    loadRounds();
  }, [tournament?.id]);

  const handleCreateRound = async () => {
    if (!tournament?.id || !newRoundName.trim()) return;
    setIsSavingRound(true);
    try {
      const roundsRef = collection(db, 'tournaments', tournament.id, 'fantasyRounds');
      const isFirstRound = rounds.length === 0;
      const docRef = await addDoc(roundsRef, {
        name: newRoundName.trim(),
        lockDeadline: newRoundDeadline || null,
        isCurrent: isFirstRound,
        createdAt: new Date().toISOString(),
      });
      setRounds(prev => [...prev, {
        id: docRef.id,
        name: newRoundName.trim(),
        lockDeadline: newRoundDeadline || '',
        isCurrent: isFirstRound,
        createdAt: new Date().toISOString(),
      }]);
      setNewRoundName('');
      setNewRoundDeadline('');
      toast({ title: 'Runda utworzona', description: `Runda "${newRoundName.trim()}" została dodana.` });
    } catch (error) {
      console.error('Error creating round:', error);
      toast({ title: 'Błąd', description: 'Nie udało się utworzyć rundy.', variant: 'destructive' });
    } finally {
      setIsSavingRound(false);
    }
  };

  const handleSetCurrent = async (roundId: string) => {
    if (!tournament?.id) return;
    try {
      // Unset all, then set the targeted one
      for (const round of rounds) {
        if (round.isCurrent) {
          await updateDoc(doc(db, 'tournaments', tournament.id, 'fantasyRounds', round.id), { isCurrent: false });
        }
      }
      await updateDoc(doc(db, 'tournaments', tournament.id, 'fantasyRounds', roundId), { isCurrent: true });
      setRounds(prev => prev.map(r => ({ ...r, isCurrent: r.id === roundId })));
      toast({ title: 'Runda aktywna', description: 'Zmieniono aktywną rundę fantasy.' });
    } catch (error) {
      console.error('Error setting current round:', error);
      toast({ title: 'Błąd', description: 'Nie udało się zmienić aktywnej rundy.', variant: 'destructive' });
    }
  };

  const handleDeleteRound = async (roundId: string) => {
    if (!tournament?.id) return;
    setDeletingRoundId(roundId);
    try {
      await deleteDoc(doc(db, 'tournaments', tournament.id, 'fantasyRounds', roundId));
      setRounds(prev => prev.filter(r => r.id !== roundId));
      toast({ title: 'Runda usunięta' });
    } catch (error) {
      console.error('Error deleting round:', error);
      toast({ title: 'Błąd', description: 'Nie udało się usunąć rundy.', variant: 'destructive' });
    } finally {
      setDeletingRoundId(null);
    }
  };

  const fantasyEnabled = tournament?.fantasy?.enabled;
  const pickemEnabled = tournament?.pickem?.enabled;

  useEffect(() => {
    setByeTeamsCount(Math.max(0, Number(tournament?.pickem?.byeTeamsCount ?? 0)));
    setPickemInstructionsMarkdown(tournament?.pickem?.instructionsMarkdown || '');
    const deadlineIso = tournament?.pickem?.submissionDeadline || '';
    setPickemSubmissionDeadline(deadlineIso ? new Date(deadlineIso).toISOString().slice(0, 16) : '');
  }, [tournament?.pickem?.byeTeamsCount, tournament?.pickem?.instructionsMarkdown, tournament?.pickem?.submissionDeadline]);

  const handleExportPickemCsv = () => {
    if (!tournament?.id) return;
    const url = `/api/pickem/export?tournamentId=${encodeURIComponent(tournament.id)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSavePickemSettings = async () => {
    if (!tournament?.id) return;

    const playoffsTeamsCount = Number(tournament.playoffs?.teamsCount ?? 0);
    const sanitizedByeTeams = Math.max(
      0,
      Math.min(Number.isFinite(byeTeamsCount) ? Math.floor(byeTeamsCount) : 0, playoffsTeamsCount),
    );

    setIsSavingPickemSettings(true);
    try {
      const parsedDeadline = pickemSubmissionDeadline
        ? new Date(pickemSubmissionDeadline).toISOString()
        : null;

      await updateDoc(doc(db, 'tournaments', tournament.id), {
        'pickem.byeTeamsCount': sanitizedByeTeams,
        'pickem.instructionsMarkdown': pickemInstructionsMarkdown.trim(),
        'pickem.submissionDeadline': parsedDeadline,
      });

      setByeTeamsCount(sanitizedByeTeams);

      toast({
        title: 'Zapisano ustawienia Pick\'em',
        description: 'Liczba BYE, deadline i instrukcje zostały zaktualizowane.',
      });
    } catch (error) {
      console.error('Error saving pickem settings:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się zapisać ustawień Pick\'em.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingPickemSettings(false);
    }
  };

  return (
    <div className="space-y-6" style={{ color: primaryText }}>
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold" style={{ color: primaryText }}>Fantasy & Pick'em</h2>
        <p style={{ color: subtleText }}>
          Zarządzanie rundami fantasy i predykcjami
        </p>
      </div>

      {/* Fantasy Rounds Management */}
      {fantasyEnabled && (
        <Card style={{ backgroundColor: panelBackground, borderColor: panelBorder }}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2" style={{ color: primaryText }}>
              <Sparkles className="h-5 w-5" style={{ color: theme.primaryColor }} />
              Rundy Fantasy
            </CardTitle>
            <CardDescription style={{ color: secondaryText }}>
              Zarządzaj rundami fantasy. Gracze mogą ustawiać skład do momentu deadline'u aktywnej rundy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Create new round */}
            <div className="p-4 rounded-xl border space-y-4" style={{ borderColor: panelBorder, backgroundColor: sectionBackground }}>
              <p className="font-semibold text-sm" style={{ color: primaryText }}>Nowa runda</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="roundName" style={{ color: secondaryText }}>Nazwa rundy</Label>
                  <Input
                    id="roundName"
                    value={newRoundName}
                    onChange={e => setNewRoundName(e.target.value)}
                    placeholder="np. Faza grupowa kolejka 1"
                    className="bg-black/65 border-white/25 text-white placeholder:text-slate-400"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="roundDeadline" style={{ color: secondaryText }}>Deadline (opcjonalnie)</Label>
                  <Input
                    id="roundDeadline"
                    type="datetime-local"
                    value={newRoundDeadline}
                    onChange={e => setNewRoundDeadline(e.target.value)}
                    className="bg-black/65 border-white/25 text-white"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleCreateRound}
                    disabled={isSavingRound || !newRoundName.trim()}
                    style={{ backgroundColor: theme.primaryColor, color: '#ffffff' }}
                  >
                    {isSavingRound ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Dodaj rundę
                  </Button>
                </div>
              </div>
            </div>

            {/* Existing rounds */}
            {loadingRounds ? (
              <div className="text-center py-6" style={{ color: subtleText }}>
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                Ładowanie rund...
              </div>
            ) : rounds.length === 0 ? (
              <div className="text-center py-6" style={{ color: subtleText }}>
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Brak rund fantasy. Utwórz pierwszą rundę powyżej.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {rounds.map(round => {
                  const isLocked = round.lockDeadline && new Date(round.lockDeadline) < new Date();
                  return (
                    <div
                      key={round.id}
                      className="flex items-center justify-between p-4 rounded-xl border"
                      style={{
                        borderColor: round.isCurrent ? theme.primaryColor : panelBorder,
                        backgroundColor: round.isCurrent ? `${theme.primaryColor}20` : sectionBackground,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold" style={{ color: primaryText }}>{round.name}</p>
                            {round.isCurrent && (
                              <Badge style={{ backgroundColor: theme.primaryColor, color: '#ffffff' }}>
                                <Star className="h-3 w-3 mr-1" />
                                Aktywna
                              </Badge>
                            )}
                            {isLocked && (
                              <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                                <Clock className="h-3 w-3 mr-1" />
                                Zablokowana
                              </Badge>
                            )}
                          </div>
                          {round.lockDeadline && (
                            <p className="text-xs mt-1" style={{ color: subtleText }}>
                              Deadline: {new Date(round.lockDeadline).toLocaleString('pl-PL')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!round.isCurrent && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetCurrent(round.id)}
                            className="border-white/25 bg-black/35 text-slate-100 hover:bg-black/60"
                          >
                            Ustaw jako aktywną
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteRound(round.id)}
                          disabled={deletingRoundId === round.id}
                        >
                          {deletingRoundId === round.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Fantasy disabled info */}
      {!fantasyEnabled && (
        <Card style={{ backgroundColor: panelBackground, borderColor: panelBorder }}>
          <CardContent className="py-8 text-center" style={{ color: subtleText }}>
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Fantasy jest wyłączone w tym turnieju.</p>
          </CardContent>
        </Card>
      )}

      {/* Pick'em section */}
      <Card style={{ backgroundColor: panelBackground, borderColor: panelBorder }}>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2" style={{ color: primaryText }}>
            <Target className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Pick'em Predictions
          </CardTitle>
          <CardDescription style={{ color: secondaryText }}>
            {pickemEnabled ? 'Status predykcji użytkowników' : 'Pick\'em jest wyłączony w tym turnieju.'}
          </CardDescription>
        </CardHeader>
        {pickemEnabled && (
          <CardContent className="space-y-6">
            <div className="p-4 rounded-xl border space-y-4" style={{ borderColor: panelBorder, backgroundColor: sectionBackground }}>
              <p className="font-semibold text-sm" style={{ color: primaryText }}>Konfiguracja Pick'em (MMR Limited)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pickemByeTeamsCount" style={{ color: secondaryText }}>Liczba BYE zablokowanych w najniższym koszyku</Label>
                  <Input
                    id="pickemByeTeamsCount"
                    type="number"
                    min={0}
                    max={Math.max(0, Number(tournament?.playoffs?.teamsCount ?? 0))}
                    value={byeTeamsCount}
                    onChange={e => setByeTeamsCount(Number(e.target.value || 0))}
                    className="bg-black/65 border-white/25 text-white placeholder:text-slate-400"
                  />
                  <p className="text-xs" style={{ color: subtleText }}>
                    Maksymalnie: {Math.max(0, Number(tournament?.playoffs?.teamsCount ?? 0))} (wg ustawień Playoffs).
                  </p>

                  <div className="pt-2 space-y-2">
                    <Label htmlFor="pickemSubmissionDeadline" style={{ color: secondaryText }}>Deadline Pick'em (blokada zapisu)</Label>
                    <Input
                      id="pickemSubmissionDeadline"
                      type="datetime-local"
                      value={pickemSubmissionDeadline}
                      onChange={e => setPickemSubmissionDeadline(e.target.value)}
                      className="bg-black/65 border-white/25 text-white"
                    />
                    <p className="text-xs" style={{ color: subtleText }}>
                      Po tym terminie użytkownicy nie mogą zapisywać predykcji.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pickemInstructionsMarkdown" style={{ color: secondaryText }}>Instrukcja dla użytkowników (Markdown)</Label>
                  <Textarea
                    id="pickemInstructionsMarkdown"
                    value={pickemInstructionsMarkdown}
                    onChange={e => setPickemInstructionsMarkdown(e.target.value)}
                    placeholder={'Np. **Jak typować:**\n- Przeciągnij drużyny do koszyków\n- Uzupełnij wszystkie miejsca\n- Kliknij "Wyślij"'}
                    rows={7}
                    className="bg-black/65 border-white/25 text-white placeholder:text-slate-400"
                  />
                  <p className="text-xs" style={{ color: subtleText }}>
                    Obsługiwane podstawy: nagłówki, pogrubienie, kursywa, listy i linki.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleExportPickemCsv}
                  className="border-white/25 bg-black/35 text-slate-100 hover:bg-black/60"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Pick'em CSV
                </Button>
                <Button
                  onClick={handleSavePickemSettings}
                  disabled={isSavingPickemSettings}
                  style={{ backgroundColor: theme.primaryColor, color: '#ffffff' }}
                >
                  {isSavingPickemSettings ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Zapisz ustawienia Pick'em
                </Button>
              </div>
            </div>

            <div className="text-center py-2" style={{ color: subtleText }}>
              <p>Predykcje zostaną rozliczone automatycznie po zakończeniu meczów.</p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
