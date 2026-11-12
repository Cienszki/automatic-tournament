'use client';

// Version 4 — "Analityk": an analyst's desk. The question box is the centre of the screen — ask
// anything about any player or team and keep the questions that matter — and under it a board of
// panels the caster assembles from a library (compare two players, hero pools, form, ranked form,
// records, history, lanes, talking points), each one movable and removable.

import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { C, ink, mix, useHeaderFont } from '@/components/stats-lab/kit';
import { RoleTag } from '@/components/draft-prep/role';
import { heroName } from '@/lib/stats-lab/heroes';
import { metric } from '@/lib/stats-lab/metrics';
import { SUBJECTS } from '@/lib/stats-lab/season';
import { cn } from '@/lib/utils';
import { HEADER_FACT, type PlayerBrief, laneTitle } from '@/lib/caster-corner/brief';
import { useCorner, useLocal } from '../data';
import { AskBuilder, Crest, Face, FactRow, FitName, HeroChip, MatchSwitch, Pick, SavedQuestion, nf1, when, usePinnedFirst } from '../ui';
import { Form, HeroCounts, PlayerDossier, ProbBar, teamLine, useTeamColors } from '../parts';

type W = 'compare' | 'pools' | 'talk' | 'form' | 'saved' | 'pubs' | 'records' | 'history' | 'lanes';
const W_LABEL: Record<W, string> = { compare: 'Porównanie graczy', pools: 'Pule bohaterów', talk: 'Do powiedzenia', form: 'Forma drużyn', saved: 'Twoje pytania', pubs: 'Poza turniejem', records: 'Rekordy w zasięgu', history: 'Historia', lanes: 'Linie' };
const DEFAULT: W[] = ['compare', 'pools', 'talk', 'form', 'saved', 'pubs'];

function Compare({ colors, onOpen }: { colors: [string, string]; onOpen: (p: PlayerBrief) => void }) {
  const { brief } = useCorner();
  const all = [...brief.a.players, ...brief.b.players];
  const mids = brief.lanes.find(l => l.key === 'mid');
  const [ids, setIds] = useState<[string, string]>([mids?.a[0]?.id ?? all[0]?.id, mids?.b[0]?.id ?? all[5]?.id ?? all[1]?.id]);
  const ps = ids.map(id => all.find(p => p.id === id)) as [PlayerBrief | undefined, PlayerBrief | undefined];
  const opts = all.map(p => ({ value: p.id, label: p.name, text: p.name, group: p.side === 'a' ? brief.a.name : brief.b.name, icon: <Face p={p} size={18} /> }));
  return (
    <div>
      <div className="grid grid-cols-2 gap-4 mb-3">
        {ps.map((p, i) => (
          <div key={i} className={cn('flex items-center gap-3 min-w-0', i && 'flex-row-reverse text-right')}>
            {p && <button type="button" onClick={() => onOpen(p)}><Face p={p} size={46} /></button>}
            <div className="min-w-0">
              <Pick value={ids[i]} options={opts} search placeholder="" className="text-[15px] font-bold" onChange={v => v && setIds(x => (i ? [x[0], String(v)] : [String(v), x[1]]))} />
              {p && <div className="text-[11px] mt-0.5" style={{ color: C.muted }}><RoleTag role={p.role} /></div>}
            </div>
          </div>
        ))}
      </div>
      {SUBJECTS.map(s => {
        const v = ps.map(p => p?.profile?.[s.key] ?? null);
        const raw = ps.map(p => p?.x?.agg[s.key].avg ?? null);
        const m = metric(s.key);
        return (
          <div key={s.key} className="grid grid-cols-[1fr_110px_1fr] items-center gap-3 py-[3px]" title={`${m.label}, percentyl wśród graczy tej samej pozycji`}>
            <div className="flex items-center justify-end gap-2"><span className="text-[11px] tabular-nums" style={{ color: C.muted }}>{raw[0] == null ? '–' : s.key === 'kp' ? `${Math.round(raw[0] * 100)}%` : nf1(raw[0])}</span><span className="h-[7px] rounded-l-full" style={{ width: `${(v[0] ?? 0) * 100}%`, maxWidth: '70%', background: colors[0], opacity: v[0] == null ? 0.2 : 1 }} /></div>
            <div className="text-center text-[10.5px] uppercase tracking-[0.12em]" style={{ color: C.muted }}>{s.name}</div>
            <div className="flex items-center gap-2"><span className="h-[7px] rounded-r-full" style={{ width: `${(v[1] ?? 0) * 100}%`, maxWidth: '70%', background: colors[1], opacity: v[1] == null ? 0.2 : 1 }} /><span className="text-[11px] tabular-nums" style={{ color: C.muted }}>{raw[1] == null ? '–' : s.key === 'kp' ? `${Math.round(raw[1] * 100)}%` : nf1(raw[1])}</span></div>
          </div>
        );
      })}
    </div>
  );
}

function Widget({ w }: { w: W }) {
  const { brief, questions, setQuestions } = useCorner();
  const colors = useTeamColors(brief);
  const [open, setOpen] = useState<PlayerBrief | null>(null);
  const talk = usePinnedFirst(brief.facts.filter(f => !HEADER_FACT.test(f.id)));
  let body: React.ReactNode = null;
  if (w === 'compare') body = <Compare colors={colors} onOpen={setOpen} />;
  if (w === 'pools') {
    body = (
      <div className="space-y-3">
        {[brief.a, brief.b].map(t => (
          <div key={t.id} className="flex items-start gap-3">
            <Crest t={t} size={28} />
            <div className="min-w-0"><HeroCounts list={t.picks.map(h => ({ heroId: h.heroId, games: h.games, wins: h.wins }))} n={7} size={46} label={h => `${h.wins}:${(h.games ?? 0) - (h.wins ?? 0)}`} /></div>
          </div>
        ))}
        {brief.contested.length > 0 && <div className="text-[12px]" style={{ color: C.muted }}>Wspólne: {brief.contested.slice(0, 4).map(c => `${heroName(c.heroId)} (${c.a}+${c.b})`).join(', ')}</div>}
      </div>
    );
  }
  if (w === 'talk') body = <div className="space-y-2">{talk.slice(0, 7).map(f => <FactRow key={f.id} f={f} />)}</div>;
  if (w === 'form') {
    body = (
      <div className="space-y-4">
        {[brief.a, brief.b].map(t => (
          <div key={t.id}>
            <div className="flex items-center gap-2.5"><Crest t={t} size={26} /><b className="text-[14px] truncate" style={{ color: C.heading }}>{t.name}</b><span className="ml-auto"><Form t={t} /></span></div>
            <div className="mt-1 text-[12px]" style={{ color: C.muted }}>{teamLine(t)}</div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px]" style={{ color: C.text }}>{t.results.slice(-4).map(r => <span key={r.id}><b style={{ color: r.win ? C.win : r.win === false ? C.loss : C.muted }}>{r.us}:{r.them}</b> {r.oppName}</span>)}</div>
          </div>
        ))}
        <ProbBar brief={brief} colors={colors} />
      </div>
    );
  }
  if (w === 'saved') body = questions.length ? questions.map(q => <SavedQuestion key={q.id} q={q} compact onRemove={() => setQuestions(p => p.filter(x => x.id !== q.id))} />) : <div className="text-[12.5px]" style={{ color: C.muted }}>Zapisz pytanie z paska u góry — tu zostanie z aktualną odpowiedzią.</div>;
  if (w === 'pubs') {
    body = (
      <table className="w-full text-[12.5px]">
        <thead><tr className="text-[9.5px] uppercase tracking-[0.15em]" style={{ color: C.muted }}><th className="text-left font-normal">Gracz</th><th className="text-right font-normal">7 dni</th><th className="text-right font-normal">30 dni</th><th className="text-right font-normal">%W</th><th className="text-left font-normal pl-3">Ostatnio</th></tr></thead>
        <tbody>{[...brief.a.players, ...brief.b.players].map(p => (
          <tr key={p.id} className="border-t" style={{ borderColor: ink(7) }}>
            <td className="py-[3px]"><button type="button" onClick={() => setOpen(p)} className="font-bold hover:underline underline-offset-4 truncate max-w-[110px] block text-left" style={{ color: p.side === 'a' ? colors[0] : colors[1] }}>{p.name}</button></td>
            <td className="text-right tabular-nums">{p.pubs?.d7 ?? '…'}</td><td className="text-right tabular-nums">{p.pubs?.d30 ?? '…'}</td>
            <td className="text-right tabular-nums">{p.pubs?.d30 ? `${Math.round(p.pubs.w30 / p.pubs.d30 * 100)}%` : '–'}</td>
            <td className="pl-3"><span className="flex gap-1">{(p.pubs?.top ?? []).slice(0, 3).map(h => <HeroChip key={h.hero} hero={h.hero} size={30} />)}</span></td>
          </tr>
        ))}</tbody>
      </table>
    );
  }
  if (w === 'records') { const l = brief.facts.filter(f => f.kind === 'rekord'); body = l.length ? <div className="space-y-2">{l.slice(0, 8).map(f => <FactRow key={f.id} f={f} showKind={false} />)}</div> : <div className="text-[12.5px]" style={{ color: C.muted }}>Nikt z tych drużyn nie ma rekordu turnieju.</div>; }
  if (w === 'history') { const l = brief.facts.filter(f => f.kind === 'historia'); body = l.length ? <div className="space-y-2">{l.slice(0, 8).map(f => <FactRow key={f.id} f={f} showKind={false} />)}</div> : <div className="text-[12.5px]" style={{ color: C.muted }}>Ci gracze nie mają wspólnej historii na stronie.</div>; }
  if (w === 'lanes') {
    body = (
      <div className="space-y-3">{brief.lanes.map(l => (
        <div key={l.key}>
          <div className="text-[10px] uppercase tracking-[0.18em] mb-1" style={{ color: C.muted }}>{laneTitle(l)}</div>
          <div className="grid grid-cols-2 gap-3">
            {[l.a, l.b].map((side, i) => (
              <div key={i} className={cn('flex flex-col gap-1', i && 'items-end')}>
                {side.map(p => <button key={p.id} type="button" onClick={() => setOpen(p)} className={cn('flex items-center gap-2 text-[13px]', i && 'flex-row-reverse')}><Face p={p} size={26} /><b style={{ color: C.heading }}>{p.name}</b><span className="text-[11px]" style={{ color: C.muted }}>{p.score != null ? `${nf1(p.score)} PF` : ''}</span></button>)}
              </div>
            ))}
          </div>
        </div>
      ))}</div>
    );
  }
  return <>{body}<PlayerDossier p={open} onClose={() => setOpen(null)} /></>;
}

export default function V4Desk() {
  const { brief, store, setQuestions, match, pending } = useCorner();
  const colors = useTeamColors(brief);
  const font = useHeaderFont();
  const [widgets, setWidgets] = useLocal<W[]>(`${store}:v4:widgets`, DEFAULT);
  const list = useMemo(() => widgets.filter(w => w in W_LABEL), [widgets]);
  const missing = (Object.keys(W_LABEL) as W[]).filter(w => !list.includes(w));
  const move = (i: number, d: -1 | 1) => setWidgets(() => { const l = [...list]; const j = i + d; if (j < 0 || j >= l.length) return l; [l[i], l[j]] = [l[j], l[i]]; return l; });

  return (
    <div className="h-full flex flex-col px-[var(--pad)] py-6">
      <div className="shrink-0 grid grid-cols-[minmax(0,1fr)_460px_minmax(0,1fr)] items-center gap-8">
        {[brief.a, null, brief.b].map((t, i) => t ? (
          <div key={t.id} className={cn('flex items-center gap-4 min-w-0', i === 2 && 'flex-row-reverse text-right')}>
            <Crest t={t} size={64} />
            <div className="min-w-0 flex-1">
              <FitName text={t.name} max={26} min={15} className="font-logik-extended-bold uppercase" style={{ color: colors[i ? 1 : 0], ...font }} />
              <div className="mt-1.5 text-[12px] truncate" style={{ color: C.muted }}>{teamLine(t)}</div>
            </div>
          </div>
        ) : (
          <div key="mid" className="text-center">
            <MatchSwitch />
            <div className="mt-1 text-[12px]" style={{ color: C.muted }}>{[when(match.scheduledFor), `Bo${match.bestOf}`, brief.stage?.label].filter(Boolean).join(' · ')}{pending > 0 && ' · wczytuję rankedy…'}</div>
            <ProbBar brief={brief} colors={colors} className="mt-2" labels={false} />
          </div>
        ))}
      </div>

      <div className="shrink-0 mt-6 py-6 px-8 rounded-2xl" style={{ background: `linear-gradient(120deg, ${mix(C.primary, 16)}, ${mix(C.primary, 4)})` }}>
        <AskBuilder onSave={q => { setQuestions(p => [q, ...p]); if (!list.includes('saved')) setWidgets([...list, 'saved']); }} />
      </div>

      <div className="flex-1 min-h-0 mt-6 grid grid-cols-3 auto-rows-[minmax(0,1fr)] gap-x-10 gap-y-6">
        {list.map((w, i) => (
          <section key={w} className="group min-h-0 flex flex-col border-t pt-3" style={{ borderColor: ink(12) }}>
            <div className="flex items-center gap-2 mb-2.5 shrink-0">
              <h3 className="text-[11px] font-logik-extended-bold uppercase tracking-[0.22em]" style={{ color: C.primary, ...font }}>{W_LABEL[w]}</h3>
              <span className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-70 transition-opacity">
                <button type="button" onClick={() => move(i, -1)} disabled={!i} className="p-0.5 disabled:opacity-20" aria-label="W lewo"><ArrowLeft className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === list.length - 1} className="p-0.5 disabled:opacity-20" aria-label="W prawo"><ArrowRight className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => setWidgets(list.filter(x => x !== w))} className="p-0.5" aria-label="Usuń panel"><X className="w-3.5 h-3.5" /></button>
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1"><Widget w={w} /></div>
          </section>
        ))}
        {missing.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="min-h-[120px] border-t border-dashed pt-3 flex items-start gap-2 text-[11px] font-bold uppercase tracking-widest hover:underline underline-offset-4" style={{ borderColor: ink(18), color: C.muted }}>
                <Plus className="w-3.5 h-3.5" />Dodaj panel
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[240px] p-1.5" style={{ background: 'var(--tournament-background, #0e0e14)', borderColor: ink(14), color: C.text }}>
              {missing.map(w => <button key={w} type="button" onClick={() => setWidgets([...list, w])} className="w-full text-left px-3 py-1.5 text-[13px] rounded hover:bg-white/5">{W_LABEL[w]}</button>)}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
