'use client';

// "Dodaj mecz": a match outside the planned schedule — a tiebreaker, a showmatch, or a rematch of
// an earlier match between the same teams. What each counts towards: src/lib/match-flags.ts.

import React, { useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DateTimeInput } from '@/components/ui/date-time-input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus } from 'lucide-react';
import type { ExtraMatchKind, Match } from '@/lib/definitions';
import { formatDateTimePL } from '@/lib/utils';

type Row = Match & { teamAName: string; teamBName: string };

const KIND_OPTIONS: Array<{ kind: Exclude<ExtraMatchKind, 'rematch'>; label: string; hint: string }> = [
  { kind: 'tiebreak', label: 'Tiebreaker', hint: 'Rozstrzyga remis — kto awansuje, zaznaczasz jak dotąd (np. w zakładce Swiss).' },
  { kind: 'showmatch', label: 'Showmatch', hint: 'Mecz pokazowy.' },
  { kind: 'other', label: 'Inny', hint: 'Każdy inny dodatkowy mecz.' },
];
const FORMATS = ['bo1', 'bo2', 'bo3', 'bo5'] as const;

export function ExtraMatchDialog({ tournamentId, tournamentType, defaultFormat, matches, teams, divisions, onDone }: {
  tournamentId: string;
  tournamentType?: string;
  defaultFormat?: string;
  matches: Row[];
  teams: Array<{ id: string; name: string }>;
  divisions: Map<string, string>;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [rematch, setRematch] = useState(false);
  const [replaces, setReplaces] = useState('');
  const [kind, setKind] = useState<Exclude<ExtraMatchKind, 'rematch'>>('tiebreak');
  const [note, setNote] = useState('');
  const [when, setWhen] = useState('');
  const [format, setFormat] = useState<string>(FORMATS.includes(defaultFormat as typeof FORMATS[number]) ? defaultFormat! : 'bo3');
  const [round, setRound] = useState('');
  const [matchday, setMatchday] = useState('');
  const [division, setDivision] = useState('');
  const [saving, setSaving] = useState(false);

  const swiss = tournamentType === 'swiss';
  const league = tournamentType === 'league';
  const sorted = useMemo(() => [...teams].sort((x, y) => x.name.localeCompare(y.name)), [teams]);
  // earlier matches of these two teams that can be replayed
  const previous = useMemo(() => matches.filter(m =>
    a && b && [m.teamA?.id, m.teamB?.id].includes(a) && [m.teamA?.id, m.teamB?.id].includes(b)
    && !m.isPlayoff && !m.isSwissByeMatch && !m.isBanForfeit && !m.replacedByMatchId && (!m.extra || m.extra.kind === 'rematch'),
  ), [matches, a, b]);
  const rounds = useMemo(() => {
    const rs = [...new Set(matches.filter(m => !m.isPlayoff).map(m => m.round || m.matchday || 0).filter(r => r > 0))].sort((x, y) => x - y);
    return rs.length ? rs : [1];
  }, [matches]);

  const reset = () => { setA(''); setB(''); setRematch(false); setReplaces(''); setKind('tiebreak'); setNote(''); setWhen(''); setRound(''); setMatchday(''); setDivision(''); };
  const ready = a && b && a !== b && (!rematch || replaces);

  const submit = async () => {
    if (!user || !ready) return;
    setSaving(true);
    try {
      const res = await fetch('/api/manage/extra-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({
          tournamentId, teamAId: a, teamBId: b,
          kind: rematch ? 'rematch' : kind, replacesMatchId: rematch ? replaces : undefined,
          note, seriesFormat: format,
          scheduledFor: when ? new Date(when).toISOString() : null,
          round: !rematch && round ? Number(round) : undefined,
          matchday: !rematch && matchday ? Number(matchday) : undefined,
          divisionId: !rematch && division ? division : undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      toast({ title: 'Mecz dodany', description: rematch ? 'Powtórka zastąpi pierwotny mecz w tabeli i statystykach.' : 'Mecz pojawi się w terminarzu i u kapitanów obu drużyn.' });
      setOpen(false); reset(); onDone();
    } catch (e: any) {
      toast({ title: 'Nie udało się dodać meczu', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const teamSelect = (value: string, set: (v: string) => void, other: string, label: string) => (
    <div className="space-y-1">
      <Label className="font-logik">{label}</Label>
      <Select value={value} onValueChange={v => { set(v); setReplaces(''); }}>
        <SelectTrigger className="font-logik"><SelectValue placeholder="Wybierz drużynę" /></SelectTrigger>
        <SelectContent>{sorted.filter(t => t.id !== other).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="font-logik"><Plus className="h-4 w-4 mr-2" />Dodaj mecz</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-logik-extended-bold">Dodaj mecz</DialogTitle>
          <DialogDescription className="font-logik">
            Mecz spoza planu: tiebreaker, showmatch albo powtórka. Pojawi się w terminarzu, u kapitanów obu drużyn i wszędzie tam, gdzie zwykły mecz; bot otworzy dla niego lobby jak dla każdego innego.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {teamSelect(a, setA, b, 'Drużyna A')}
            {teamSelect(b, setB, a, 'Drużyna B')}
          </div>

          <label className="flex items-start gap-2 font-logik text-sm cursor-pointer">
            <Checkbox checked={rematch} onCheckedChange={v => { setRematch(!!v); setReplaces(''); }} className="mt-0.5" />
            <span>To powtórka meczu tych drużyn<span className="block text-xs text-muted-foreground">Wynik i statystyki powtórki zastąpią pierwotny mecz w tabeli, rekordach Swiss i statystykach. Pierwotny zostanie widoczny jako „powtórzony”.</span></span>
          </label>

          {rematch ? (
            <div className="space-y-1">
              <Label className="font-logik">Który mecz jest powtarzany</Label>
              {!a || !b ? <p className="text-xs text-muted-foreground font-logik">Najpierw wybierz obie drużyny.</p>
                : !previous.length ? <p className="text-xs text-muted-foreground font-logik">Te drużyny nie mają meczu, który można powtórzyć (playoffy powtarza się w drabince).</p>
                : (
                  <Select value={replaces} onValueChange={setReplaces}>
                    <SelectTrigger className="font-logik"><SelectValue placeholder="Wybierz mecz" /></SelectTrigger>
                    <SelectContent>
                      {previous.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {[m.round ? `Runda ${m.round}` : null, m.scheduledFor ? formatDateTimePL(m.scheduledFor) : 'bez daty', m.status === 'completed' ? `${m.teamAName} ${m.teamA?.score ?? 0}:${m.teamB?.score ?? 0} ${m.teamBName}` : 'nierozegrany'].filter(Boolean).join(' · ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              <p className="text-xs text-muted-foreground font-logik">Powtórka trafia w to samo miejsce terminarza co pierwotny mecz.</p>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <Label className="font-logik">Rodzaj</Label>
                <div className="flex gap-2">
                  {KIND_OPTIONS.map(o => (
                    <Button key={o.kind} type="button" size="sm" variant={kind === o.kind ? 'default' : 'outline'} className="font-logik" onClick={() => setKind(o.kind)}>{o.label}</Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground font-logik">{KIND_OPTIONS.find(o => o.kind === kind)?.hint} Nie zmienia tabeli ani rekordów Swiss; gry liczą się do statystyk graczy.</p>
              </div>
              <div className="space-y-1">
                <Label className="font-logik">Opis (opcjonalnie)</Label>
                <Input value={note} onChange={e => setNote(e.target.value)} maxLength={80} placeholder={kind === 'tiebreak' ? 'np. o 4. miejsce' : 'np. mecz gwiazd'} className="font-logik" />
              </div>
              {(swiss || league) && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="font-logik">Pokaż w rundzie</Label>
                    <Select value={round} onValueChange={setRound}>
                      <SelectTrigger className="font-logik"><SelectValue placeholder="Wybierz rundę" /></SelectTrigger>
                      <SelectContent>{rounds.map(r => <SelectItem key={r} value={String(r)}>Runda {r}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {league && (
                    <div className="space-y-1">
                      <Label className="font-logik">Kolejka</Label>
                      <Input type="number" min={1} value={matchday} onChange={e => setMatchday(e.target.value)} placeholder="np. 3" className="font-logik" />
                    </div>
                  )}
                </div>
              )}
              {divisions.size > 0 && (
                <div className="space-y-1">
                  <Label className="font-logik">{swiss ? 'Dywizja' : 'Grupa / dywizja'}</Label>
                  <Select value={division} onValueChange={setDivision}>
                    <SelectTrigger className="font-logik"><SelectValue placeholder="Bez przypisania" /></SelectTrigger>
                    <SelectContent>{[...divisions.entries()].map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="font-logik">Termin (opcjonalnie)</Label>
              <DateTimeInput value={when} onChange={setWhen} className="font-logik" />
            </div>
            <div className="space-y-1">
              <Label className="font-logik">Format</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger className="font-logik"><SelectValue /></SelectTrigger>
                <SelectContent>{FORMATS.map(f => <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} className="font-logik">Anuluj</Button>
          <Button onClick={submit} disabled={!ready || saving} className="font-logik">
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Dodaję…</> : 'Dodaj mecz'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
