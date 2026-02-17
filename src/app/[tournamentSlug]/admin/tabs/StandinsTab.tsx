"use client";

import React, { useState } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import { 
  UserPlus,
  Save,
  RotateCcw,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  AlertTriangle,
  Gavel,
} from 'lucide-react';

interface StandinAppeal {
  id: string;
  teamName: string;
  standinName: string;
  originalPlayer: string;
  matchName: string;
  matchDate: string;
  reason: string;
  denialReason: string;
  status: 'pending' | 'approved' | 'denied';
  requestedAt: string;
  deniedBy: string;
  appealedAt: string;
}

/**
 * Standins Tab - Manage standin appeals (requests that were denied by opponent and appealed)
 * 
 * Flow:
 * 1. Captain issues standin request
 * 2. Opponent captain approves/denies on their my-team page
 * 3. If denied, original captain can appeal
 * 4. Appeal appears here for admin to make final decision
 */
export function StandinsTab() {
  const { tournament, theme, refetchTournament } = useTournament();
  const { toast } = useToast();
  
  // Mock appeals data - only shows requests that were denied and then appealed
  const [appeals, setAppeals] = useState<StandinAppeal[]>([
    {
      id: '1',
      teamName: 'Team Liquid',
      standinName: 'miracle-',
      originalPlayer: 'matu',
      matchName: 'TL vs OG',
      matchDate: '2025-02-25',
      reason: 'Choroba gracza',
      denialReason: 'Standin jest zbyt silny',
      status: 'pending',
      requestedAt: '2025-02-23 14:30',
      deniedBy: 'OG Captain',
      appealedAt: '2025-02-23 16:45',
    },
  ]);
  
  const [adminNote, setAdminNote] = useState<Record<string, string>>({});
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
      
      // Update appeal statuses and notes
      appeals.forEach(appeal => {
        const appealRef = doc(db, 'tournaments', tournament.id, 'standinAppeals', appeal.id);
        batch.update(appealRef, {
          status: appeal.status,
          adminNote: adminNote[appeal.id] || null,
          reviewedAt: appeal.status !== 'pending' ? new Date().toISOString() : null,
          updatedAt: new Date().toISOString(),
        });
      });

      await batch.commit();

      toast({
        title: 'Zapisano',
        description: 'Decyzje dotyczące zastępstw zostały zapisane',
      });

      await refetchTournament();
    } catch (error) {
      console.error('Error saving standin appeals:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się zapisać decyzji. Spróbuj ponownie.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateAppealStatus = (appealId: string, status: StandinAppeal['status']) => {
    setAppeals(appeals.map(a => 
      a.id === appealId ? { ...a, status } : a
    ));
  };

  const getStatusBadge = (status: StandinAppeal['status']) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-green-500/20 text-green-500 border-green-500/30 font-logik">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Zatwierdzony
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 font-logik">
            <Gavel className="h-3 w-3 mr-1" />
            Oczekuje na decyzję
          </Badge>
        );
      case 'denied':
        return (
          <Badge className="bg-red-500/20 text-red-500 border-red-500/30 font-logik">
            <XCircle className="h-3 w-3 mr-1" />
            Odrzucony
          </Badge>
        );
    }
  };

  const pendingCount = appeals.filter(a => a.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-logik-extended-bold">Zastępstwa (standiny)</h2>
          <p className="text-muted-foreground font-logik">
            Rozpatrywanie odwołań od odrzuconych próśb o zastępstwo
          </p>
        </div>
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

      {/* Info Banner */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm border-l-4" style={{ borderLeftColor: theme.primaryColor }}>
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 mt-0.5" style={{ color: theme.primaryColor }} />
            <div>
              <p className="font-logik-extended-bold">Jak działa system zastępstw</p>
              <p className="text-sm text-muted-foreground font-logik mt-1">
                1. Kapitan drużyny zgłasza prośbę o standina<br />
                2. Kapitan przeciwnej drużyny akceptuje lub odrzuca prośbę<br />
                3. Jeśli odrzucona, wnioskujący kapitan może złożyć odwołanie<br />
                4. Odwołanie trafia tutaj - admin podejmuje ostateczną decyzję
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appeals List */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
                <Gavel className="h-5 w-5" style={{ color: theme.primaryColor }} />
                Odwołania do rozpatrzenia
                {pendingCount > 0 && (
                  <Badge className="ml-2 bg-amber-500 text-black font-logik">
                    {pendingCount} oczekujących
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="font-logik">
                Prośby o standina odrzucone przez przeciwnika i zaskarżone przez wnioskodawcę
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {appeals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground font-logik">
              <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-logik-extended-bold mb-2">Brak odwołań</p>
              <p>Wszystkie prośby o zastępstwo zostały rozpatrzone przez kapitanów drużyn.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {appeals.map(appeal => (
                <div 
                  key={appeal.id}
                  className={cn(
                    "p-5 rounded-xl border transition-colors",
                    appeal.status === 'pending' 
                      ? "border-amber-500/30 bg-amber-500/5" 
                      : "border-border"
                  )}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center font-logik-extended-bold text-white"
                        style={{ backgroundColor: theme.primaryColor }}
                      >
                        {appeal.teamName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-logik-extended-bold text-lg">{appeal.teamName}</p>
                        <p className="text-sm text-muted-foreground font-logik">
                          Mecz: {appeal.matchName} ({appeal.matchDate})
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(appeal.status)}
                  </div>

                  {/* Standin Details */}
                  <div className="p-4 rounded-lg bg-background/50 border border-border mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <UserPlus className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground font-logik">Standin:</span>
                    </div>
                    <p className="font-logik">
                      <span className="font-logik-extended-bold">{appeal.standinName}</span>
                      <span className="text-muted-foreground"> za </span>
                      <span className="font-logik-extended-bold">{appeal.originalPlayer}</span>
                    </p>
                  </div>

                  {/* Reason & Denial */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <p className="text-xs text-blue-400 font-logik mb-1 flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        Powód prośby o standina
                      </p>
                      <p className="text-sm font-logik">"{appeal.reason}"</p>
                    </div>
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <p className="text-xs text-red-400 font-logik mb-1 flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        Powód odrzucenia przez {appeal.deniedBy}
                      </p>
                      <p className="text-sm font-logik">"{appeal.denialReason}"</p>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground font-logik mb-4">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Zgłoszono: {appeal.requestedAt}
                    </span>
                    <span>→</span>
                    <span>Odrzucono przez kapitana</span>
                    <span>→</span>
                    <span>Odwołano: {appeal.appealedAt}</span>
                  </div>

                  {/* Admin Note & Actions */}
                  {appeal.status === 'pending' && (
                    <div className="space-y-4 pt-4 border-t border-border">
                      <div className="space-y-2">
                        <Label className="font-logik text-sm">Notatka admina (opcjonalna)</Label>
                        <Textarea
                          value={adminNote[appeal.id] || ''}
                          onChange={(e) => setAdminNote({ ...adminNote, [appeal.id]: e.target.value })}
                          placeholder="Uzasadnienie decyzji..."
                          className="font-logik resize-none text-sm"
                          rows={2}
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          onClick={() => updateAppealStatus(appeal.id, 'approved')}
                          className="font-logik bg-green-500 hover:bg-green-600"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Zatwierdź standina
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => updateAppealStatus(appeal.id, 'denied')}
                          className="font-logik text-red-500 border-red-500/30 hover:bg-red-500/10"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Podtrzymaj odmowę
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <Clock className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Historia rozpatrywanych odwołań
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground font-logik">
            <p>Brak historycznych odwołań</p>
            <p className="text-sm mt-2">Rozpatrzone odwołania pojawią się tutaj</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
