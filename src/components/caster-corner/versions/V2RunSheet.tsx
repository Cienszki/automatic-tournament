'use client';

// Version 2 — "Scenariusz": a TV run sheet. The broadcast is split into the moments a caster
// talks through (zapowiedź, draft, faza linii, gra, przerwa) and every talking point sits in the
// moment it fits, with the picture that helps there (stakes and odds, heroes to expect, lane
// duels). Tick what was said, pin what must be said, add your own points; ↑ ↓ move, space ticks,
// 1–6 jump between moments. On the right: who is who and the question box.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { C, ink, useHeaderFont } from '@/components/stats-lab/kit';
import { RoleTag } from '@/components/draft-prep/role';
import { cn } from '@/lib/utils';
import { count } from '@/lib/plural';
import { FACT_KIND_LABEL, HEADER_FACT, PHASE_LABEL, PHASES, factsAbout, type FactKind, type Phase, type PlayerBrief, type TeamBrief, laneTitle } from '@/lib/caster-corner/brief';
import { useCorner, useLocal } from '../data';
import { AskBuilder, Crest, Face, FactRow, MatchSwitch, SavedQuestion, nf1, usePinnedFirst, when } from '../ui';
import { Form, HeroCounts, PlayerDossier, ProbBar, teamLine, useTeamColors } from '../parts';

type Seg = Phase | 'own';
const SEGS: Seg[] = [...PHASES, 'own'];
const SEG_LABEL: Record<Seg, string> = { ...PHASE_LABEL, own: 'Twoje punkty' };
const KINDS = Object.keys(FACT_KIND_LABEL) as FactKind[];

function TeamPair({ a, b, colors, children }: { a: TeamBrief; b: TeamBrief; colors: [string, string]; children: (t: TeamBrief, c: string) => React.ReactNode }) {
  const font = useHeaderFont();
  return (
    <div className="grid grid-cols-2 gap-10">
      {[a, b].map((t, i) => (
        <div key={t.id} className="min-w-0">
          <div className="flex items-center gap-2.5 mb-2"><Crest t={t} size={26} /><span className="font-logik-extended-bold uppercase text-[14px] truncate" style={{ color: colors[i], ...font }}>{t.name}</span></div>
          {children(t, colors[i])}
        </div>
      ))}
    </div>
  );
}

/** The picture for a moment */
function Visual({ seg, colors }: { seg: Seg; colors: [string, string] }) {
  const { brief, match } = useCorner();
  const font = useHeaderFont();
  if (seg === 'intro') {
    return (
      <div className="space-y-4">
        {brief.stage?.stake && <div className="text-[20px] font-bold leading-snug" style={{ color: C.heading }}>{brief.stage.stake}</div>}
        <TeamPair a={brief.a} b={brief.b} colors={colors}>
          {t => (<>
            <div className="text-[13px]" style={{ color: C.text }}>{teamLine(t)}</div>
            <div className="mt-2"><Form t={t} size={20} /></div>
            {t.stageRecord && <div className="mt-2 text-[12px]" style={{ color: C.muted }}>{brief.stage?.label}: {t.stageRecord.w}:{t.stageRecord.l}</div>}
          </>)}
        </TeamPair>
        <ProbBar brief={brief} colors={colors} className="max-w-[520px]" />
        {match.status === 'completed' && <div className="font-logik-extended-bold text-[28px]" style={{ color: C.heading, ...font }}>Wynik {match.scoreA}:{match.scoreB}</div>}
      </div>
    );
  }
  if (seg === 'draft') {
    return (
      <TeamPair a={brief.a} b={brief.b} colors={colors}>
        {t => (
          <div className="space-y-2.5">
            <Row label="Picki"><HeroCounts list={t.picks.map(h => ({ heroId: h.heroId, games: h.games, wins: h.wins }))} n={6} size={52} label={h => `${h.wins}:${(h.games ?? 0) - (h.wins ?? 0)}`} /></Row>
            <Row label="Banują"><HeroCounts list={t.bansBy} n={6} size={52} /></Row>
            <Row label="Banowani"><HeroCounts list={t.bansAgainst} n={6} size={52} /></Row>
          </div>
        )}
      </TeamPair>
    );
  }
  if (seg === 'laning') {
    return (
      <div className="space-y-3">
        {brief.lanes.map(l => (
          <div key={l.key} className="grid grid-cols-[minmax(0,1fr)_110px_minmax(0,1fr)] items-center gap-4">
            <div className="flex justify-end gap-4">{l.a.map(p => <Duelist key={p.id} p={p} right />)}</div>
            <div className="text-center text-[11px] uppercase tracking-[0.2em]" style={{ color: C.muted }}>{laneTitle(l)}</div>
            <div className="flex gap-4">{l.b.map(p => <Duelist key={p.id} p={p} />)}</div>
          </div>
        ))}
      </div>
    );
  }
  return null;
}
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-start gap-3"><span className="w-[70px] shrink-0 pt-2 text-[10px] uppercase tracking-[0.18em]" style={{ color: C.muted }}>{label}</span>{children}</div>
);
function Duelist({ p, right }: { p: PlayerBrief; right?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5 min-w-0', right && 'flex-row-reverse text-right')}>
      <Face p={p} size={42} />
      <div className="min-w-0"><div className="font-bold text-[14px] truncate" style={{ color: C.heading }}>{p.name}</div><div className="text-[11px]" style={{ color: C.muted }}>{p.score != null ? `${nf1(p.score)} PF` : 'brak gier'}</div></div>
    </div>
  );
}

export default function V2RunSheet() {
  const { brief, store, used, toggleUsed, own, setOwn, questions, setQuestions, pending } = useCorner();
  const colors = useTeamColors(brief);
  const font = useHeaderFont();
  const [seg, setSeg] = useLocal<Seg>(`${store}:v2:seg`, 'intro');
  const [hidden, setHidden] = useLocal<FactKind[]>(`${store}:v2:hidden`, []);
  const [big, setBig] = useLocal<boolean>(`${store}:v2:big`, false);
  const [focus, setFocus] = useState(0);
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState<PlayerBrief | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const bySeg = useMemo(() => {
    const m = new Map<Seg, typeof brief.facts>(SEGS.map(s => [s, []]));
    for (const f of brief.facts) if (!hidden.includes(f.kind) && !HEADER_FACT.test(f.id)) m.get(f.phase)!.push(f);
    for (const o of own) m.get(o.phase)!.push({ id: o.id, text: o.text, kind: 'ciekawostka', phase: o.phase, weight: 1000, side: 'match' });
    m.set('own', own.map(o => ({ id: o.id, text: o.text, kind: 'ciekawostka' as const, phase: o.phase, weight: 1000, side: 'match' as const })));
    return m;
  }, [brief.facts, hidden, own]);
  const facts = usePinnedFirst(bySeg.get(seg) ?? []);

  useEffect(() => { setFocus(0); }, [seg]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea')) return;
      const n = Number(e.key); if (n >= 1 && n <= SEGS.length) { setSeg(SEGS[n - 1]); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setFocus(f => Math.min(facts.length - 1, f + 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setFocus(f => Math.max(0, f - 1)); }
      if (e.key === ' ' && facts[focus]) { e.preventDefault(); toggleUsed(facts[focus].id); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [facts, focus, toggleUsed, setSeg]);
  useEffect(() => { listRef.current?.querySelector(`[data-i="${focus}"]`)?.scrollIntoView({ block: 'nearest' }); }, [focus]);

  const addOwn = () => {
    const t = draft.trim(); if (!t) return;
    setOwn(p => [...p, { id: `own:${Date.now().toString(36)}`, text: t, phase: seg === 'own' ? 'intro' : seg }]);
    setDraft('');
  };

  return (
    <div className="h-full grid grid-cols-[300px_minmax(0,1fr)_400px]">
      {/* Moments */}
      <nav className="min-h-0 flex flex-col px-8 py-7 border-r" style={{ borderColor: ink(10) }}>
        <div className="flex items-center gap-2 -space-x-1"><Crest t={brief.a} size={40} /><Crest t={brief.b} size={40} /></div>
        <div className="mt-3"><MatchSwitch big /></div>
        <div className="mt-1 text-[12px]" style={{ color: C.muted }}>{when(brief.match.scheduledFor)} · Bo{brief.match.bestOf}</div>
        <div className="mt-8 flex-1 min-h-0 flex flex-col">
          {SEGS.map((s, i) => {
            const list = bySeg.get(s) ?? []; const left = list.filter(f => !used.has(f.id)).length; const on = s === seg;
            return (
              <button key={s} type="button" onClick={() => setSeg(s)} className="relative flex items-center gap-3 py-3 text-left group">
                <span className="absolute -left-8 top-2 bottom-2 w-[3px] rounded-r" style={{ background: on ? C.primary : 'transparent' }} />
                <span className="text-[10px] w-3 tabular-nums" style={{ color: C.muted }}>{i + 1}</span>
                <span className={cn('font-logik-extended-bold uppercase text-[15px] flex-1', !on && 'group-hover:underline underline-offset-4')} style={{ color: on ? C.heading : C.muted, ...font }}>{SEG_LABEL[s]}</span>
                <span className="text-[12px] tabular-nums" style={{ color: left ? C.text : C.win }}>{list.length ? (left ? left : '✓') : ''}</span>
              </button>
            );
          })}
        </div>
        <div className="pt-5 space-y-3 text-[12px]" style={{ color: C.muted }}>
          <button type="button" onClick={() => setBig(!big)} className="block underline decoration-2 underline-offset-[6px]" style={{ color: big ? C.heading : C.muted, textDecorationColor: big ? C.primary : ink(25) }}>Duża czcionka na żywo</button>
          <div className="leading-relaxed">↑ ↓ wybór · spacja odhacza · 1–6 momenty</div>
        </div>
      </nav>

      {/* The moment */}
      <main className="min-h-0 flex flex-col px-12 py-7">
        <div className="flex items-baseline gap-5">
          <h2 className="font-logik-extended-bold uppercase text-[34px] leading-none" style={{ color: C.heading, ...font }}>{SEG_LABEL[seg]}</h2>
          {pending > 0 && <span className="text-[12px]" style={{ color: C.muted }}>wczytuję rankedy…</span>}
          <div className="ml-auto flex flex-wrap justify-end gap-x-3 gap-y-1 text-[12px]">
            {KINDS.filter(k => k !== 'stawka').map(k => {
              const on = !hidden.includes(k);
              return <button key={k} type="button" onClick={() => setHidden(on ? [...hidden, k] : hidden.filter(x => x !== k))} className="underline decoration-2 underline-offset-[5px]" style={{ color: on ? C.heading : C.muted, textDecorationColor: on ? C.primary : 'transparent' }}>{FACT_KIND_LABEL[k]}</button>;
            })}
          </div>
        </div>
        <div className="mt-6 shrink-0"><Visual seg={seg} colors={colors} /></div>
        <div ref={listRef} className="mt-6 flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2">
          {facts.map((f, i) => (
            <div key={f.id} data-i={i} onClick={() => setFocus(i)} className="py-2.5 border-b relative" style={{ borderColor: ink(7) }}>
              {i === focus && <span className="absolute -left-4 top-3 bottom-3 w-[2px]" style={{ background: C.primary }} />}
              <FactRow f={f} big={big} showKind={seg !== 'own'}
                extra={f.id.startsWith('own:') ? <button type="button" onClick={() => setOwn(p => p.filter(o => o.id !== f.id))} className="ml-2 align-middle opacity-40 hover:opacity-100"><X className="inline w-3.5 h-3.5" /></button> : undefined} />
            </div>
          ))}
          {!facts.length && <div className="py-3 text-[13px]" style={{ color: C.muted }}>{seg === 'own' ? 'Twoje punkty pojawią się też w momentach, do których je dodasz.' : 'Nic tu nie ma przy obecnych filtrach.'}</div>}
          <div className="flex items-center gap-3 py-3">
            <Plus className="w-4 h-4 shrink-0" style={{ color: C.muted }} />
            <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addOwn(); }}
              placeholder={seg === 'own' ? 'Własny punkt (trafi do zapowiedzi)…' : `Własny punkt do: ${SEG_LABEL[seg].toLowerCase()}…`}
              className="flex-1 bg-transparent outline-none text-[14px] border-b border-dashed focus:border-solid py-1" style={{ borderColor: ink(18), color: C.heading }} />
          </div>
        </div>
      </main>

      {/* Who is who + questions */}
      <aside className="min-h-0 flex flex-col border-l px-8 py-7" style={{ borderColor: ink(10) }}>
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 space-y-5">
          {[brief.a, brief.b].map((t, ti) => (
            <div key={t.id}>
              <div className="h-[2px] w-10 mb-2" style={{ background: colors[ti] }} />
              {t.players.map(p => {
                const top = factsAbout(brief, t.side, p.id)[0];
                return (
                  <button key={p.id} type="button" onClick={() => setOpen(p)} className="w-full flex items-center gap-3 py-1.5 text-left group">
                    <Face p={p} size={38} ring={p.standin ? '#ffd27a' : undefined} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2"><b className="text-[14px] truncate group-hover:underline underline-offset-4" style={{ color: C.heading }}>{p.name}</b><span className="text-[11px]" style={{ color: C.muted }}><RoleTag role={p.role} label={false} /></span></span>
                      <span className="block text-[11.5px] truncate" style={{ color: C.muted }}>{top?.text ?? (p.games ? `${count(p.games, 'gra', 'gry', 'gier')} w turnieju` : 'pierwsze gry w turnieju')}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="shrink-0 pt-5 mt-3 border-t" style={{ borderColor: ink(10) }}>
          <AskBuilder compact onSave={q => setQuestions(p => [q, ...p])} />
          <div className="mt-3 max-h-[180px] overflow-y-auto custom-scrollbar">
            {questions.map(q => <SavedQuestion key={q.id} q={q} compact onRemove={() => setQuestions(p => p.filter(x => x.id !== q.id))} />)}
          </div>
        </div>
      </aside>
      <PlayerDossier p={open} onClose={() => setOpen(null)} />
    </div>
  );
}
