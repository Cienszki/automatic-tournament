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
import { ClipboardList, Loader2, RefreshCw } from 'lucide-react';
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

/** Admin card: re-check every player's match history (after someone makes their profile public, or when histories look stale) */
export function PlayerHistoriesCard() {
  const { tournament } = useTournament();
  const { user } = useAuth();
  const { toast } = useToast();
  const [refreshedAt, setRefreshedAt] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!tournament?.id || !user) return;
    user.getIdToken()
      .then(token => fetch(`/api/manage/draft-prep-histories?tournamentId=${encodeURIComponent(tournament.id)}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }))
      .then(r => r.json()).then(j => setRefreshedAt(j?.refreshedAt ?? null)).catch(() => setRefreshedAt(null));
  }, [tournament?.id, user]);

  const refresh = async () => {
    if (!tournament?.id || !user) return;
    setBusy(true);
    try {
      const res = await fetch('/api/manage/draft-prep-histories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ tournamentId: tournament.id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.success) throw new Error(j.error || `HTTP ${res.status}`);
      setRefreshedAt(j.refreshedAt);
      toast({
        title: 'Historie graczy odświeżane',
        description: `OpenDota przyjęło ${j.queued} z ${j.accounts} kont${j.failed ? ` (${j.failed} nie odpowiedziało — spróbuj ponownie później)` : ''}. Starsze gry pojawią się w ciągu kilku minut do kilku godzin.`,
      });
    } catch (e: any) {
      toast({ title: 'Nie udało się odświeżyć historii', description: e?.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-logik-extended-bold flex items-center gap-2"><ClipboardList className="h-4 w-4" />Przygotowanie do meczu — historie graczy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 font-logik">
        <p className="text-sm text-muted-foreground">
          Historie gier zawodników (OpenDota + STRATZ) są pobierane, gdy ktoś otworzy mecz z ich udziałem, i odświeżane co 6 godzin.
          Ten przycisk prosi OpenDota o ponowne pobranie historii wszystkich graczy, smurfów i stand-inów turnieju i czyści naszą pamięć podręczną —
          przydaje się, gdy ktoś dopiero udostępnił dane meczów („Expose Public Match Data”). Przez 2 godziny potem historie są czytane na nowo co 15 minut.
        </p>
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-sm">
            {refreshedAt === undefined ? 'Sprawdzam…' : refreshedAt ? `Ostatnio: ${new Date(refreshedAt).toLocaleString('pl-PL')}` : 'Jeszcze nie odświeżano ręcznie.'}
          </span>
          <Button variant="outline" onClick={refresh} disabled={busy || !user}>
            {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Odświeżanie…</> : <><RefreshCw className="h-4 w-4 mr-2" />Odśwież historie graczy</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
