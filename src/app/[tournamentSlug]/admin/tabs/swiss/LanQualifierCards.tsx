"use client";

// Admin cards of the LAN-qualifier Swiss format (see src/lib/lan-qualifier/engine.ts): the format
// switch, the top group, the organiser's tiebreak decision, and progress + places. Round
// generation, scheduling, results and forfeits stay in the Swiss tab's shared round builder.

import { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Crown, GitBranch, Loader2, Save, Scale, Trophy } from 'lucide-react';
import type { LQConfig, LQDerived, LQMatch, LQPlan } from '@/lib/lan-qualifier/engine';
import type { SwissTeam } from '@/lib/swiss/actions';

type Run = (key: string, fn: () => Promise<void>) => Promise<void>;

export const LAN_STAGE_LABEL: Record<string, string> = {
  A: 'Grupa A',
  B: 'Swiss',
  F: 'Finał',
  P: 'O miejsca',
};
const SLOT_LABEL: Record<string, string> = {
  o1: 'otwarcie', o2: 'otwarcie', w: 'zwycięzców', l: 'przegranych', d: 'decydujący', tb: 'dogrywka o miejsce',
};

/** "Grupa A · zwycięzców" — the admin-facing name of a pairing's slot in the format. */
export function lanPairingLabel(stage?: string, slot?: string | null): string {
  if (!stage) return '';
  return [LAN_STAGE_LABEL[stage], slot ? SLOT_LABEL[slot] : null].filter(Boolean).join(' · ');
}

// ── Format ─────────────────────────────────────────────────────────────────

export function FormatCard({ format, hasRounds, busy, onSave, primary }: {
  format: 'standard' | 'lan-qualifier';
  hasRounds: boolean;
  busy: boolean;
  onSave: (f: 'standard' | 'lan-qualifier') => void;
  primary: string;
}) {
  const [value, setValue] = useState(format);
  useEffect(() => setValue(format), [format]);
  return (
    <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
          <GitBranch className="h-5 w-5" style={{ color: primary }} /> Format
        </CardTitle>
        <CardDescription className="font-logik">
          Kwalifikacje LAN: 4 najwyżej rozstawione drużyny grają grupę GSL (1–2 → LAN), reszta Swiss;
          potem Finał (3.–4. z grupy A + dwie najlepsze ze Swissa, 1–2 → LAN) i mecze o miejsca 7+. Wszystko bo3.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={value} onValueChange={v => setValue(v as typeof value)}>
            <SelectTrigger className="w-[320px] font-logik"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Swiss (jedna tabela, punkty za mapy)</SelectItem>
              <SelectItem value="lan-qualifier">Kwalifikacje LAN (grupa A + Swiss → Finał)</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => onSave(value)} disabled={busy || value === format} style={{ backgroundColor: primary }}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Zapisz format
          </Button>
        </div>
        {hasRounds && value !== format && (
          <p className="text-sm text-amber-500 font-logik flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            Ten turniej ma już zatwierdzone rundy. Po zmianie formatu wycofaj je (przycisk „Wycofaj” przy rundzie),
            zanim wygenerujesz rundę 1 w nowym formacie — mecze z dwóch formatów nie mogą się mieszać.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Top group ──────────────────────────────────────────────────────────────

export function GroupACard({ cfg, field, stored, locked, run, onSave, primary }: {
  cfg: LQConfig;
  field: SwissTeam[];
  stored: string[];
  locked: boolean;
  run: Run;
  onSave: (ids: string[]) => Promise<void>;
  primary: string;
}) {
  const [pick, setPick] = useState<string[]>(cfg.groupA);
  useEffect(() => setPick(cfg.groupA), [cfg.groupA]);
  const dirty = pick.join() !== cfg.groupA.join() || stored.length !== 4;
  const valid = pick.length === 4 && new Set(pick).size === 4;
  const name = (id: string) => field.find(t => t.id === id)?.name ?? id;
  return (
    <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
          <Crown className="h-5 w-5" style={{ color: primary }} /> Grupa A (4 drużyny)
        </CardTitle>
        <CardDescription className="font-logik">
          Domyślnie 4 drużyny z najwyższym rozstawieniem. Pozostałe {Math.max(0, field.length - 4)} grają Swiss
          ({cfg.groupB.length >= 2 ? `${Math.max(1, Math.ceil(Math.log2(cfg.groupB.length)))} rundy` : 'za mało drużyn'}).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {field.length < 6 && (
          <p className="text-sm text-amber-500 font-logik flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Potrzeba co najmniej 6 drużyn (4 w grupie A + 2 w Swissie).
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          {[0, 1, 2, 3].map(i => (
            <Select key={i} value={pick[i] ?? ''} disabled={locked}
              onValueChange={v => setPick(prev => { const next = [...prev]; next[i] = v; return next; })}>
              <SelectTrigger className="font-logik"><SelectValue placeholder={`Drużyna ${i + 1}`} /></SelectTrigger>
              <SelectContent>
                {field.map(t => (
                  <SelectItem key={t.id} value={t.id} disabled={pick.includes(t.id) && pick[i] !== t.id}>
                    {cfg.seed[t.id]}. {t.name}{t.seedMmr != null ? ` · ${t.seedMmr}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>
        {locked ? (
          <p className="text-xs text-muted-foreground font-logik">
            Zablokowane — runda 1 jest zatwierdzona. Aby zmienić grupę, wycofaj rundę 1.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => run('groupA', () => onSave(pick))} disabled={!valid || !dirty} style={{ backgroundColor: primary }}>
              <Save className="h-4 w-4 mr-2" /> Zapisz grupę A
            </Button>
            {stored.length !== 4 && (
              <span className="text-xs text-muted-foreground font-logik">
                Nie zapisano — używane jest domyślne rozstawienie: {cfg.groupA.map(name).join(', ')}.
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Tiebreak ───────────────────────────────────────────────────────────────

export function TiebreakCard({ derived, field, finalStarted, run, onSave, primary }: {
  derived: LQDerived;
  field: SwissTeam[];
  finalStarted: boolean;
  run: Run;
  onSave: (advanced: string[] | null) => Promise<void>;
  primary: string;
}) {
  const tie = derived.tie!;
  const current = [derived.b1, derived.b2].filter((id): id is string => !!id && tie.teams.includes(id));
  const [pick, setPick] = useState<string[]>(current);
  useEffect(() => setPick(current), [current.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = (id: string) => field.find(t => t.id === id)?.name ?? id;
  const toggle = (id: string) => setPick(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id].slice(-tie.spots)));
  const decided = current.length === tie.spots;
  return (
    <Card className={cn('border-0 shadow-lg bg-card/50 backdrop-blur-sm', !decided && 'ring-1 ring-amber-500/50')}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
          <Scale className="h-5 w-5" style={{ color: primary }} /> Dogrywka o awans do Finału
        </CardTitle>
        <CardDescription className="font-logik">
          {tie.teams.length} drużyny mają bilans {tie.record[0]}:{tie.record[1]}, a do Finału {tie.spots === 1 ? 'awansuje jedna' : `awansują ${tie.spots}`}.
          Dogrywkę organizujecie poza terminarzem — tutaj zaznacz, kto ją wygrał. Na stronie drużyny widzą ją jako „dogrywka o awans”.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {tie.teams.map(id => (
            <button key={id} type="button" disabled={finalStarted} onClick={() => toggle(id)}
              className={cn('px-3 py-2 rounded-lg border font-logik text-sm transition-colors',
                pick.includes(id) ? 'border-green-500 bg-green-500/10 text-green-500' : 'border-border hover:bg-muted',
                finalStarted && 'opacity-60 cursor-not-allowed')}>
              {pick.includes(id) && <CheckCircle2 className="inline h-4 w-4 mr-1.5" />}{name(id)}
            </button>
          ))}
        </div>
        {finalStarted ? (
          <p className="text-xs text-muted-foreground font-logik">
            Zablokowane — Finał już się zaczął. Aby zmienić decyzję, wycofaj pierwszą rundę Finału.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={pick.length !== tie.spots || pick.join() === current.join()} style={{ backgroundColor: primary }}
              onClick={() => run('tiebreak', () => onSave(pick))}>
              <Save className="h-4 w-4 mr-2" /> Zapisz: awansuje {pick.map(name).join(', ') || '…'}
            </Button>
            {decided && (
              <Button variant="ghost" className="text-muted-foreground" onClick={() => run('tiebreak', () => onSave(null))}>
                Cofnij decyzję
              </Button>
            )}
            {!decided && <Badge variant="outline" className="font-logik text-amber-500 border-amber-500/40">czeka na decyzję — blokuje Finał</Badge>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Progress + places ──────────────────────────────────────────────────────

export function LanStatusCard({ cfg, derived, matches, nextPlan, field, primary }: {
  cfg: LQConfig;
  derived: LQDerived;
  matches: LQMatch[];
  nextPlan: LQPlan | null;
  field: SwissTeam[];
  primary: string;
}) {
  const name = (id: string | null) => (id ? field.find(t => t.id === id)?.name ?? id : '—');
  const stage = (s: string) => {
    const ms = matches.filter(m => m.stage === s);
    return { total: ms.length, done: ms.filter(m => m.done).length };
  };
  const lanFour = derived.placements.slice(0, 4);
  const rows = useMemo(() => derived.placements, [derived]);
  const status = (label: string, s: string, note: string) => {
    const st = stage(s);
    return (
      <div className="rounded-lg border border-border p-3">
        <div className="font-logik-extended-bold text-sm">{label}</div>
        <div className="text-xs text-muted-foreground font-logik">{st.total ? `${st.done}/${st.total} meczów z wynikiem` : 'jeszcze nie rozpoczęte'}</div>
        <div className="text-xs text-muted-foreground font-logik mt-1">{note}</div>
      </div>
    );
  };
  return (
    <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
          <Trophy className="h-5 w-5" style={{ color: primary }} /> Przebieg i miejsca
        </CardTitle>
        <CardDescription className="font-logik">
          Rundy 1–{derived.finalStart - 1}: grupa A i Swiss równolegle · rundy {derived.finalStart}–{derived.placementEnd}: Finał i mecze o miejsca ·
          potem ewentualne dogrywki o miejsca dla drużyn z tym samym bilansem.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {nextPlan && nextPlan.kind !== 'pairings' && (
          <p className={cn('text-sm font-logik flex items-start gap-2', nextPlan.kind === 'done' ? 'text-green-500' : 'text-amber-500')}>
            {nextPlan.kind === 'done' ? <CheckCircle2 className="h-4 w-4 mt-0.5" /> : <AlertTriangle className="h-4 w-4 mt-0.5" />}
            {nextPlan.kind === 'done' && 'Kwalifikacje rozegrane — wszystkie miejsca ustalone.'}
            {nextPlan.kind === 'wait' && nextPlan.reason}
            {nextPlan.kind === 'decide' && 'Następna runda czeka na decyzję w sprawie dogrywki o awans (karta wyżej).'}
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {status('Grupa A', 'A', `LAN: ${name(derived.aPlaces[0])}, ${name(derived.aPlaces[1])}`)}
          {status('Swiss', 'B', `Do Finału: ${name(derived.b1)}, ${name(derived.b2)}`)}
          {status('Finał', 'F', `LAN: ${name(derived.fPlaces[0])}, ${name(derived.fPlaces[1])}`)}
          {status('O miejsca', 'P', derived.restSettled ? 'wszystkie miejsca ustalone' : 'w toku')}
        </div>

        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 space-y-1">
          <div className="text-sm font-logik-extended-bold text-green-500">LAN</div>
          <p className="text-sm font-logik">{lanFour.map(p => name(p.teamId)).join(' · ')}</p>
          <p className="text-xs text-muted-foreground font-logik">
            Drabinkę LAN (format z ustawień playoffów) rozstawiasz w zakładce Playoffs — przypisz te drużyny do slotów.
          </p>
        </div>

        <table className="w-full text-sm font-logik">
          <tbody>
            {rows.map(p => (
              <tr key={p.place} className="border-b border-border/50">
                <td className={cn('py-1.5 pr-3 w-10 font-mono', p.lan ? 'text-green-500' : 'text-muted-foreground')}>{p.place}.</td>
                <td className="py-1.5">{name(p.teamId)}</td>
                <td className="py-1.5 text-right text-xs text-muted-foreground">
                  {p.place <= 2 ? 'grupa A' : p.place <= 6 ? 'Finał' : 'o miejsca'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground font-logik">
          Grupa A: {cfg.groupA.map(name).join(', ')} · Swiss: {cfg.groupB.length} drużyn.
        </p>
      </CardContent>
    </Card>
  );
}
