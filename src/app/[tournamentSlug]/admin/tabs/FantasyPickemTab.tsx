"use client";

import React, { useState, useEffect } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  
  const [rounds, setRounds] = useState<FantasyRound[]>([]);
  const [loadingRounds, setLoadingRounds] = useState(true);
  const [newRoundName, setNewRoundName] = useState('');
  const [newRoundDeadline, setNewRoundDeadline] = useState('');
  const [isSavingRound, setIsSavingRound] = useState(false);
  const [deletingRoundId, setDeletingRoundId] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold">Fantasy & Pick'em</h2>
        <p className="text-muted-foreground">
          Zarządzanie rundami fantasy i predykcjami
        </p>
      </div>

      {/* Fantasy Rounds Management */}
      {fantasyEnabled && (
        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" style={{ color: theme.primaryColor }} />
              Rundy Fantasy
            </CardTitle>
            <CardDescription>
              Zarządzaj rundami fantasy. Gracze mogą ustawiać skład do momentu deadline'u aktywnej rundy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Create new round */}
            <div className="p-4 rounded-xl border border-border space-y-4">
              <p className="font-semibold text-sm">Nowa runda</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="roundName">Nazwa rundy</Label>
                  <Input
                    id="roundName"
                    value={newRoundName}
                    onChange={e => setNewRoundName(e.target.value)}
                    placeholder="np. Faza grupowa kolejka 1"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="roundDeadline">Deadline (opcjonalnie)</Label>
                  <Input
                    id="roundDeadline"
                    type="datetime-local"
                    value={newRoundDeadline}
                    onChange={e => setNewRoundDeadline(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleCreateRound}
                    disabled={isSavingRound || !newRoundName.trim()}
                    style={{ backgroundColor: theme.primaryColor }}
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
              <div className="text-center py-6 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                Ładowanie rund...
              </div>
            ) : rounds.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
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
                        borderColor: round.isCurrent ? theme.primaryColor : 'var(--border)',
                        backgroundColor: round.isCurrent ? `${theme.primaryColor}08` : undefined,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{round.name}</p>
                            {round.isCurrent && (
                              <Badge style={{ backgroundColor: theme.primaryColor }}>
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
                            <p className="text-xs text-muted-foreground mt-1">
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
        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Fantasy jest wyłączone w tym turnieju.</p>
          </CardContent>
        </Card>
      )}

      {/* Pick'em section */}
      <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Pick'em Predictions
          </CardTitle>
          <CardDescription>
            {pickemEnabled ? 'Status predykcji użytkowników' : 'Pick\'em jest wyłączony w tym turnieju.'}
          </CardDescription>
        </CardHeader>
        {pickemEnabled && (
          <CardContent>
            <div className="text-center py-6 text-muted-foreground">
              <p>Predykcje zostaną rozliczone automatycznie po zakończeniu meczów.</p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
