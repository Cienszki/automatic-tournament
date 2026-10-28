'use client';

// Admin card: the hero data behind the match-prep tool (where each hero is played, how heroes do
// against and with each other) — fetched from STRATZ. Once a month is plenty; it is also fetched
// automatically when a tournament is created.

import React, { useEffect, useState } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { ClipboardList, Loader2, RefreshCw, Users } from 'lucide-react';
import { refreshHeroDataSteps } from '@/lib/draft-prep/refresh-client';

export function MatchPrepDataCard() {
  const { tournament } = useTournament();
  const { user } = useAuth();
  const { toast } = useToast();
  const [updatedAt, setUpdatedAt] = useState<string | null | undefined>(undefined);
  const [progress, setProgress] = useState<number | null>(null);

  const load = () => fetch('/api/draft-prep/heroes', { cache: 'no-store' }).then(r => r.json()).then(j => setUpdatedAt(j?.updatedAt ?? null)).catch(() => setUpdatedAt(null));
  useEffect(() => { load(); }, []);

  const refresh = async () => {
    if (!tournament?.id || !user) return;
    setProgress(0);
    try {
      await refreshHeroDataSteps(await user.getIdToken(), tournament.id, { force: true, onProgress: (d, t) => setProgress(Math.round((d / t) * 100)) });
      toast({ title: 'Dane bohaterów odświeżone', description: 'Narzędzie do przygotowania meczu korzysta już z nowych danych.' });
      setUpdatedAt(new Date().toISOString());
    } catch (e: any) {
      toast({ title: 'Nie udało się odświeżyć danych', description: e?.message, variant: 'destructive' });
    } finally {
      setProgress(null);
    }
  };

  const age = updatedAt ? Math.floor((Date.now() - Date.parse(updatedAt)) / 86400000) : null;
  return (
    <Card className="bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-logik-extended-bold flex items-center gap-2"><ClipboardList className="h-4 w-4" />Przygotowanie do meczu — dane bohaterów</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 font-logik">
        <p className="text-sm text-muted-foreground">
          Na jakich pozycjach gra się każdym bohaterem oraz jak bohaterowie radzą sobie przeciwko sobie i razem (STRATZ). Wystarczy odświeżać raz w miesiącu albo po dużym patchu. Trwa około minuty.
        </p>
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-sm">
            {updatedAt === undefined ? 'Sprawdzam…' : updatedAt ? `Ostatnio: ${new Date(updatedAt).toLocaleDateString('pl-PL')}${age != null && age > 35 ? ' — warto odświeżyć' : ''}` : 'Jeszcze nie pobrano — narzędzie korzysta z uproszczonych danych.'}
          </span>
          <Button variant="outline" onClick={refresh} disabled={progress != null || !user}>
            {progress != null ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Pobieranie… {progress}%</> : <><RefreshCw className="h-4 w-4 mr-2" />Odśwież dane bohaterów</>}
          </Button>
        </div>
        {progress != null && <Progress value={progress} className="h-2" />}
      </CardContent>
    </Card>
  );
}

/**
 * Admin card: refresh what we take from OpenDota about the players — the heroes in the teams view
 * (a snapshot saved on the team) and the game histories in the match-prep tool (cached 6 h).
 */
export function PlayerDataCard() {
  const { tournament } = useTournament();
  const { user } = useAuth();
  const { toast } = useToast();
  const [refreshedAt, setRefreshedAt] = useState<string | null | undefined>(undefined);
  const [step, setStep] = useState<string | null>(null);

  useEffect(() => {
    if (!tournament?.id || !user) return;
    user.getIdToken()
      .then(token => fetch(`/api/manage/draft-prep-histories?tournamentId=${encodeURIComponent(tournament.id)}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }))
      .then(r => r.json()).then(j => setRefreshedAt(j?.refreshedAt ?? null)).catch(() => setRefreshedAt(null));
  }, [tournament?.id, user]);

  const post = async (url: string, body: object) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user!.getIdToken()}` },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.success) throw new Error(j.error || `HTTP ${res.status}`);
    return j;
  };

  const refresh = async () => {
    if (!tournament?.id || !user) return;
    try {
      setStep('Proszę OpenDota o aktualne dane…');
      const h = await post('/api/manage/draft-prep-histories', { tournamentId: tournament.id });
      setRefreshedAt(h.refreshedAt);
      setStep('Aktualizuję bohaterów w widoku drużyn…');
      const p = await post('/api/player-heroes', { tournamentId: tournament.id, refreshAll: true });
      toast({
        title: 'Dane graczy odświeżone',
        description: `Bohaterowie: ${p.updatedCount} graczy${p.keptCount ? `, u ${p.keptCount} zostały poprzednie (OpenDota nic dla nich nie pokazuje)` : ''}${p.errorCount ? `, ${p.errorCount} bez odpowiedzi` : ''}. OpenDota pobierze na nowo historie ${h.queued} kont bez danych. Historie w przygotowaniu do meczu wczytają się na nowo.`,
      });
    } catch (e: any) {
      toast({ title: 'Nie udało się odświeżyć danych graczy', description: e?.message, variant: 'destructive' });
    } finally {
      setStep(null);
    }
  };

  return (
    <Card className="bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-logik-extended-bold flex items-center gap-2"><Users className="h-4 w-4" />Dane graczy z OpenDota</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 font-logik">
        <p className="text-sm text-muted-foreground">
          Bohaterowie graczy w widoku drużyn i historie gier w przygotowaniu do meczu. Odśwież, gdy dane wyglądają na nieaktualne
          albo ktoś dopiero udostępnił swoje mecze — wtedy najlepiej jeszcze raz za godzinę, bo OpenDota potrzebuje chwili.
        </p>
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-sm">
            {step ?? (refreshedAt === undefined ? 'Sprawdzam…' : refreshedAt ? `Ostatnio: ${new Date(refreshedAt).toLocaleString('pl-PL')}` : 'Jeszcze nie odświeżano.')}
          </span>
          <Button variant="outline" onClick={refresh} disabled={step != null || !user}>
            {step ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Odświeżanie…</> : <><RefreshCw className="h-4 w-4 mr-2" />Odśwież dane graczy</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
