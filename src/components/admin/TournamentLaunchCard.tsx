'use client';

// The missing step between "wizard finished" and "teams can register".
//
// The wizard creates a tournament as status 'draft' + visibility 'inactive', but
// GeneralTab's status picker only ever offered registration/active/completed —
// so 'draft' matched no option and there was no visible way out of it. A
// wizard-created tournament was a dead end.
//
// This card states what is still missing, separates hard blockers from things
// that can wait, and gives one button that publishes.

import React, { useEffect, useState } from 'react';
import { doc, updateDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTournament } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Rocket, Check, X, Loader2, Copy, ExternalLink, AlertTriangle, RefreshCw,
} from 'lucide-react';

interface CheckItem {
  label: string;
  ok: boolean;
  hint?: string;
}

export function TournamentLaunchCard({ onGoLive }: { onGoLive?: () => void }) {
  const { tournament, refetchTournament } = useTournament();
  const { toast } = useToast();
  const [divisionCount, setDivisionCount] = useState<number | null>(null);
  const [rulesCount, setRulesCount] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isDraft = tournament?.status === 'draft';

  useEffect(() => {
    if (!tournament?.id || !isDraft) return;
    let cancelled = false;
    (async () => {
      try {
        const [divs, rules] = await Promise.all([
          getDocs(collection(db, 'tournaments', tournament.id, 'divisions')),
          getDocs(collection(db, 'tournaments', tournament.id, 'rules')),
        ]);
        if (cancelled) return;
        setDivisionCount(divs.size);
        setRulesCount(rules.size);
      } catch (err) {
        console.error('[LaunchCard] could not read setup state', err);
      }
    })();
    return () => { cancelled = true; };
  }, [tournament?.id, isDraft]);

  // Only relevant while a tournament is still a draft.
  if (!tournament || !isDraft) return null;

  const required: CheckItem[] = [
    { label: 'Nazwa turnieju', ok: !!tournament.name },
    { label: 'Adres (slug)', ok: !!tournament.slug },
    { label: 'Data rozpoczęcia', ok: !!tournament.startDate },
    {
      label: 'Logo',
      ok: !!tournament.theme?.logoUrl,
      hint: 'Bez logo strona główna i lista turniejów wyglądają na niedokończone.',
    },
    {
      label: 'Format rozgrywek',
      ok: !!tournament.type,
    },
  ];

  const optional: CheckItem[] = [
    { label: 'Opis turnieju', ok: !!tournament.description },
    {
      label: 'Okno rejestracji',
      ok: !!tournament.registrationStartDate && !!tournament.registrationEndDate,
      hint: 'Bez dat rejestracja zamyka się dopiero ręczną zmianą statusu.',
    },
    { label: 'Regulamin', ok: (rulesCount ?? 0) > 0, hint: 'Zakładka „Regulamin”.' },
    {
      label: tournament.type === 'swiss' ? 'Pole Swiss' : 'Grupy / dywizje',
      ok: (divisionCount ?? 0) > 0,
    },
    { label: 'Nagrody', ok: false, hint: 'Zakładka „Nagrody” — możesz dodać później.' },
    { label: 'Konfiguracja bota', ok: !!tournament.lobbySettings?.leagueName, hint: 'Zakładka „Bot”.' },
  ];

  const blockers = required.filter(r => !r.ok);
  const canLaunch = blockers.length === 0;

  const previewUrl =
    typeof window !== 'undefined' && tournament.previewToken
      ? `${window.location.origin}/${tournament.slug}?preview=${tournament.previewToken}`
      : null;

  const handleCopyPreview = async () => {
    if (!previewUrl) return;
    try {
      await navigator.clipboard.writeText(previewUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Nie udało się skopiować', variant: 'destructive' });
    }
  };

  const handleRotateToken = async () => {
    setBusy('rotate');
    try {
      const fresh =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID().replace(/-/g, '')
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
      await updateDoc(doc(db, 'tournaments', tournament.id), { previewToken: fresh });
      await refetchTournament();
      toast({ title: 'Nowy link podglądu', description: 'Poprzedni link przestał działać.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Błąd', description: 'Nie udało się odświeżyć linku.', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const handleGoLive = async () => {
    if (!canLaunch) return;
    if (!window.confirm(
      'Opublikować turniej? Strona stanie się widoczna publicznie i otworzy się rejestracja.'
    )) return;

    setBusy('launch');
    try {
      await updateDoc(doc(db, 'tournaments', tournament.id), {
        status: 'registration',
        visibility: 'active',
        updatedAt: serverTimestamp(),
      });
      await refetchTournament();
      toast({
        title: 'Turniej opublikowany',
        description: 'Rejestracja jest otwarta, a turniej widoczny na stronie głównej.',
      });
      onGoLive?.();
    } catch (err) {
      console.error(err);
      toast({
        title: 'Błąd publikacji',
        description: 'Nie udało się opublikować turnieju. Sprawdź uprawnienia.',
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm border-l-4 border-l-amber-500">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
          <Rocket className="h-5 w-5 text-amber-500" />
          Uruchomienie turnieju
        </CardTitle>
        <CardDescription className="font-logik">
          Ten turniej jest wersją roboczą — nikt poza Tobą go nie widzi. Uzupełnij wymagane
          pola i opublikuj, gdy będziesz gotowy.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-sm font-logik-extended-bold mb-2">Wymagane</p>
            <ul className="space-y-1.5">
              {required.map(item => <CheckRow key={item.label} item={item} />)}
            </ul>
          </div>
          <div>
            <p className="text-sm font-logik-extended-bold mb-2 text-muted-foreground">
              Opcjonalne — możesz dodać później
            </p>
            <ul className="space-y-1.5">
              {optional.map(item => <CheckRow key={item.label} item={item} muted />)}
            </ul>
          </div>
        </div>

        {previewUrl && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <p className="text-sm font-logik-extended-bold">Link podglądu</p>
            <p className="text-xs text-muted-foreground font-logik">
              Wyślij go współorganizatorom, żeby zobaczyli stronę przed publikacją.
              Każdy z tym linkiem zobaczy turniej, więc traktuj go jak hasło.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="text-xs bg-background px-2 py-1.5 rounded border border-border truncate max-w-full flex-1">
                {previewUrl}
              </code>
              <Button size="sm" variant="outline" onClick={handleCopyPreview}>
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                {copied ? 'Skopiowano' : 'Kopiuj'}
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={previewUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Otwórz
                </a>
              </Button>
              <Button size="sm" variant="ghost" onClick={handleRotateToken} disabled={busy === 'rotate'}>
                {busy === 'rotate'
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        )}

        {!canLaunch && (
          <p className="text-sm text-amber-500 font-logik flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            Uzupełnij {blockers.length === 1 ? 'brakujące pole' : `brakujące pola (${blockers.length})`},
            aby móc opublikować turniej.
          </p>
        )}

        <Button
          onClick={handleGoLive}
          disabled={!canLaunch || busy === 'launch'}
          size="lg"
          className="w-full md:w-auto"
        >
          {busy === 'launch'
            ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            : <Rocket className="h-4 w-4 mr-2" />}
          Opublikuj i otwórz rejestrację
        </Button>
      </CardContent>
    </Card>
  );
}

function CheckRow({ item, muted }: { item: CheckItem; muted?: boolean }) {
  return (
    <li className="flex items-start gap-2 text-sm font-logik">
      {item.ok
        ? <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
        : <X className={cn('h-4 w-4 shrink-0 mt-0.5', muted ? 'text-muted-foreground/50' : 'text-destructive')} />}
      <span className={cn(item.ok && 'text-muted-foreground', muted && !item.ok && 'text-muted-foreground')}>
        {item.label}
        {!item.ok && item.hint && (
          <span className="block text-xs text-muted-foreground/70">{item.hint}</span>
        )}
      </span>
    </li>
  );
}
