"use client";

import React, { useState, useEffect } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { approveStandinAppeal, rejectStandinAppeal, undoStandinAppealResolution } from '@/lib/standin-actions';
import { cn } from '@/lib/utils';
import type { PDLStandinRequest, Team, Match } from '@/lib/definitions';
import { format } from 'date-fns';
import { 
  UserPlus,
  RotateCcw,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  AlertTriangle,
  Gavel,
  Loader2,
  ExternalLink,
  Undo2,
} from 'lucide-react';

interface EnrichedAppeal extends PDLStandinRequest {
  teamName: string;
  matchName: string;
  matchDate: string;
  opponentTeamName?: string;
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
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [pendingAppeals, setPendingAppeals] = useState<EnrichedAppeal[]>([]);
  const [resolvedAppeals, setResolvedAppeals] = useState<EnrichedAppeal[]>([]);
  const [allRequests, setAllRequests] = useState<EnrichedAppeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminNote, setAdminNote] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Fetch standin appeals from Firestore
  useEffect(() => {
    if (!tournament?.id) return;
    loadAppeals();
  }, [tournament?.id]);

  const loadAppeals = async () => {
    if (!tournament?.id) return;
    
    setLoading(true);
    try {
      const standinRequestsRef = collection(db, 'tournaments', tournament.id, 'standinRequests');
      
      // Fetch pending appeals
      const pendingQuery = query(standinRequestsRef, where('status', '==', 'appeal_pending'));
      const pendingSnap = await getDocs(pendingQuery);
      
      // Fetch resolved appeals (last 20)
      const resolvedQuery = query(
        standinRequestsRef, 
        where('status', 'in', ['appeal_approved', 'appeal_rejected'])
      );
      const resolvedSnap = await getDocs(resolvedQuery);

      // Enrich data with team and match info
      const teamsRef = collection(db, 'tournaments', tournament.id, 'teams');
      const teamsSnap = await getDocs(teamsRef);
      const teamsMap = new Map<string, Team>();
      teamsSnap.forEach(doc => {
        teamsMap.set(doc.id, { id: doc.id, ...doc.data() } as Team);
      });

      // Load BOTH regular matches and playoff bracket matches (stored in a separate
      // collection) so standin requests targeting a playoff match resolve to a real
      // match name instead of "Nieznany mecz".
      const matchesMap = new Map<string, Match>();
      const [matchesSnap, playoffSnap] = await Promise.all([
        getDocs(collection(db, 'tournaments', tournament.id, 'matches')),
        getDocs(collection(db, 'tournaments', tournament.id, 'playoff_matches')).catch(() => null),
      ]);
      matchesSnap.forEach(doc => {
        matchesMap.set(doc.id, { id: doc.id, ...doc.data() } as Match);
      });
      playoffSnap?.forEach(doc => {
        matchesMap.set(doc.id, { id: doc.id, ...doc.data() } as Match);
      });

      const enrichAppeal = (docSnap: any): EnrichedAppeal => {
        const data = docSnap.data() as PDLStandinRequest;
        const team = teamsMap.get(data.teamId);
        const match = matchesMap.get(data.matchId);

        let matchName = 'Nieznany mecz';
        let matchDate = '';
        let opponentTeamName = '';

        if (match) {
          const teamAName = teamsMap.get(match.teamA?.id || '')?.name || match.teamA?.name || 'Team A';
          const teamBName = teamsMap.get(match.teamB?.id || '')?.name || match.teamB?.name || 'Team B';
          matchName = `${teamAName} vs ${teamBName}`;
          matchDate = match.scheduledFor ? format(new Date(match.scheduledFor), 'dd.MM.yyyy HH:mm') : '';

          // Determine opponent
          if (match.teamA?.id === data.teamId) {
            opponentTeamName = teamBName;
          } else {
            opponentTeamName = teamAName;
          }
        } else if (data.matchTeamAName || data.matchTeamBName) {
          // Fallback to the labels denormalized onto the request at creation time,
          // in case the match doc was regenerated/removed.
          matchName = `${data.matchTeamAName || 'Team A'} vs ${data.matchTeamBName || 'Team B'}`;
          matchDate = data.matchScheduledFor ? format(new Date(data.matchScheduledFor), 'dd.MM.yyyy HH:mm') : '';
        }

        return {
          ...data,
          id: docSnap.id,
          teamName: team?.name || 'Nieznana drużyna',
          matchName,
          matchDate,
          opponentTeamName,
        };
      };

      const pending = pendingSnap.docs.map(enrichAppeal);
      const resolved = resolvedSnap.docs
        .map(enrichAppeal)
        .sort((a, b) => new Date(b.appealResolvedAt || b.updatedAt).getTime() - new Date(a.appealResolvedAt || a.updatedAt).getTime())
        .slice(0, 20);

      // Fetch ALL standin requests for overview
      const allRequestsSnap = await getDocs(standinRequestsRef);
      const all = allRequestsSnap.docs
        .map(enrichAppeal)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setPendingAppeals(pending);
      setResolvedAppeals(resolved);
      setAllRequests(all);
    } catch (error) {
      console.error('Error loading standin appeals:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się załadować odwołań',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAppeal = async (appealId: string) => {
    if (!tournament?.id || !user?.uid) return;

    setProcessingId(appealId);
    try {
      const result = await approveStandinAppeal(tournament.id, appealId, user.uid, adminNote[appealId]);
      if (!result.success) throw new Error(result.error);

      toast({
        title: 'Zatwierdzone',
        description: 'Odwołanie zostało zatwierdzone. Standin może teraz grać w meczu.',
      });

      await loadAppeals();
      setAdminNote(prev => {
        const newNote = { ...prev };
        delete newNote[appealId];
        return newNote;
      });
    } catch (error) {
      console.error('Error approving appeal:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się zatwierdzić odwołania',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectAppeal = async (appealId: string) => {
    if (!tournament?.id || !user?.uid) return;

    setProcessingId(appealId);
    try {
      const result = await rejectStandinAppeal(tournament.id, appealId, user.uid, adminNote[appealId]);
      if (!result.success) throw new Error(result.error);

      toast({
        title: 'Odrzucone',
        description: 'Odwołanie zostało odrzucone. Odmowa kapitana jest ostateczna.',
      });

      await loadAppeals();
      setAdminNote(prev => {
        const newNote = { ...prev };
        delete newNote[appealId];
        return newNote;
      });
    } catch (error) {
      console.error('Error rejecting appeal:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się odrzucić odwołania',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleUndoResolution = async (appealId: string) => {
    if (!tournament?.id) return;

    setProcessingId(appealId);
    try {
      const result = await undoStandinAppealResolution(tournament.id, appealId);
      if (!result.success) throw new Error(result.error);

      // Restore the previous admin note to the input field
      if (result.previousNote) {
        setAdminNote(prev => ({ ...prev, [appealId]: result.previousNote! }));
      }

      toast({
        title: 'Cofnięto',
        description: 'Decyzja została cofnięta. Odwołanie wróciło do oczekujących.',
      });

      await loadAppeals();
    } catch (error) {
      console.error('Error undoing resolution:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się cofnąć decyzji',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: PDLStandinRequest['status']) => {
    switch (status) {
      case 'appeal_approved':
        return (
          <Badge className="bg-green-500/20 text-green-500 border-green-500/30 font-logik">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Admin zatwierdził
          </Badge>
        );
      case 'appeal_pending':
        return (
          <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 font-logik">
            <Gavel className="h-3 w-3 mr-1" />
            Oczekuje na decyzję admina
          </Badge>
        );
      case 'appeal_rejected':
        return (
          <Badge className="bg-red-500/20 text-red-500 border-red-500/30 font-logik">
            <XCircle className="h-3 w-3 mr-1" />
            Admin odrzucił
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-500/20 text-red-500 border-red-500/30 font-logik">
            <XCircle className="h-3 w-3 mr-1" />
            Odrzucone przez kapitana
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="font-logik">
            {status}
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin" style={{ color: theme.primaryColor }} />
          <p className="text-muted-foreground font-logik">Ładowanie odwołań...</p>
        </div>
      </div>
    );
  }

  const pendingCount = pendingAppeals.length;

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
          {pendingAppeals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground font-logik">
              <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-logik-extended-bold mb-2">Brak odwołań</p>
              <p>Wszystkie prośby o zastępstwo zostały rozpatrzone przez kapitanów drużyn.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingAppeals.map(appeal => (
                <div 
                  key={appeal.id}
                  className={cn(
                    "p-5 rounded-xl border transition-colors",
                    "border-amber-500/30 bg-amber-500/5"
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
                          Mecz: {appeal.matchName} {appeal.matchDate && `(${appeal.matchDate})`}
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
                      <span className="font-logik-extended-bold">{appeal.standinNickname}</span>
                      <span className="text-muted-foreground"> za </span>
                      <span className="font-logik-extended-bold">{appeal.replacedPlayerNickname}</span>
                    </p>
                    {appeal.standinSteamProfileUrl && (
                      <a 
                        href={appeal.standinSteamProfileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-2"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Profil Steam standina
                      </a>
                    )}
                  </div>

                  {/* Reason & Denial */}
                  {appeal.rejectionReason && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 mb-4">
                      <p className="text-xs text-red-400 font-logik mb-1 flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        Powód odrzucenia przez {appeal.opponentTeamName || 'kapitana przeciwnika'}
                      </p>
                      <p className="text-sm font-logik">"{appeal.rejectionReason}"</p>
                    </div>
                  )}

                  {/* Timeline */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground font-logik mb-4">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Zgłoszono: {format(new Date(appeal.createdAt), 'dd.MM.yyyy HH:mm')}
                    </span>
                    {appeal.respondedAt && (
                      <>
                        <span>→</span>
                        <span>Odrzucono: {format(new Date(appeal.respondedAt), 'dd.MM.yyyy HH:mm')}</span>
                      </>
                    )}
                    {appeal.appealedAt && (
                      <>
                        <span>→</span>
                        <span>Odwołano: {format(new Date(appeal.appealedAt), 'dd.MM.yyyy HH:mm')}</span>
                      </>
                    )}
                  </div>

                  {/* Admin Note & Actions */}
                  <div className="space-y-4 pt-4 border-t border-border">
                    <div className="space-y-2">
                      <Label className="font-logik text-sm">Notatka admina (opcjonalna)</Label>
                      <Textarea
                        value={adminNote[appeal.id] || ''}
                        onChange={(e) => setAdminNote({ ...adminNote, [appeal.id]: e.target.value })}
                        placeholder="Uzasadnienie decyzji..."
                        className="font-logik resize-none text-sm"
                        rows={2}
                        disabled={processingId === appeal.id}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={() => handleApproveAppeal(appeal.id)}
                        disabled={processingId === appeal.id}
                        className="font-logik bg-green-500 hover:bg-green-600"
                      >
                        {processingId === appeal.id ? (
                          <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                        )}
                        Zatwierdź standina
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleRejectAppeal(appeal.id)}
                        disabled={processingId === appeal.id}
                        className="font-logik text-red-500 border-red-500/30 hover:bg-red-500/10"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Podtrzymaj odmowę
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Standin Requests Overview */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <UserPlus className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Wszystkie prośby o standinów
          </CardTitle>
          <CardDescription className="font-logik">
            Przegląd wszystkich próśb o zastępców w turnieju (dla kontroli)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground font-logik">
              <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Brak próśb o zastępców</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allRequests.map(request => (
                <div 
                  key={request.id}
                  className="p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-logik-extended-bold">{request.teamName}</p>
                      <p className="text-sm text-muted-foreground font-logik">
                        {request.standinNickname} za {request.replacedPlayerNickname} • {request.matchName}
                      </p>
                      {request.matchDate && (
                        <p className="text-xs text-muted-foreground font-logik mt-1">
                          📅 {request.matchDate}
                        </p>
                      )}
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
                  {request.rejectionReason && request.status === 'rejected' && (
                    <div className="mt-2 p-2 rounded bg-red-500/10 text-sm font-logik">
                      <p className="text-xs text-muted-foreground mb-1">Powód odrzucenia przez {request.opponentTeamName}:</p>
                      <p className="text-red-400">{request.rejectionReason}</p>
                    </div>
                  )}
                  {request.appealAdminNote && (
                    <div className="mt-2 p-2 rounded bg-muted/50 text-sm font-logik">
                      <p className="text-xs text-muted-foreground mb-1">Notatka admina:</p>
                      <p>{request.appealAdminNote}</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground font-logik mt-2">
                    Utworzono: {format(new Date(request.createdAt), 'dd.MM.yyyy HH:mm')}
                    {request.standinSteamProfileUrl && (
                      <a 
                        href={request.standinSteamProfileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="ml-3 inline-flex items-center text-blue-400 hover:text-blue-300"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Profil Steam
                      </a>
                    )}
                  </p>
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
          {resolvedAppeals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground font-logik">
              <p>Brak historycznych odwołań</p>
              <p className="text-sm mt-2">Rozpatrzone odwołania pojawią się tutaj</p>
            </div>
          ) : (
            <div className="space-y-3">
              {resolvedAppeals.map(appeal => (
                <div 
                  key={appeal.id}
                  className="p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-logik-extended-bold">{appeal.teamName}</p>
                      <p className="text-sm text-muted-foreground font-logik">
                        {appeal.standinNickname} za {appeal.replacedPlayerNickname} • {appeal.matchName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(appeal.status)}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUndoResolution(appeal.id)}
                        disabled={processingId === appeal.id}
                        className="font-logik text-xs"
                        title="Cofnij decyzję"
                      >
                        {processingId === appeal.id ? (
                          <RotateCcw className="h-3 w-3 animate-spin" />
                        ) : (
                          <Undo2 className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                  {appeal.appealAdminNote && (
                    <div className="mt-2 p-2 rounded bg-muted/50 text-sm font-logik">
                      <p className="text-xs text-muted-foreground mb-1">Notatka admina:</p>
                      <p>{appeal.appealAdminNote}</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground font-logik mt-2">
                    Rozpatrzone: {appeal.appealResolvedAt ? format(new Date(appeal.appealResolvedAt), 'dd.MM.yyyy HH:mm') : 'Nieznana data'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
