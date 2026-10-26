'use client';

// The draft simulator block shared by several prep pages: the 24-step strip, the win estimate,
// suggestions at our steps / predictions at theirs, and the hero grid to play any step. Fills
// whatever space it is given.

import React, { useMemo } from 'react';
import { Avatar, C, HeroImg, Tip, TipBody, useHeaderFont } from '@/components/stats-lab/kit';
import { heroName } from '@/lib/stats-lab/heroes';
import { evaluate, isUs, planDraft, predictBan, predictPick, suggestBan, suggestPick, type PlanStep } from '@/lib/draft-prep/engine';
import { useDP, useDraftView } from './state';
import { DraftStrip, GuessRow, HeroGrid, Label, RULE, SuggestionRow, WinBar, useRewind, useThinData, vh } from './ui';
import { CmExplainer } from './guide';

export function useStepInfo() {
  const dp = useDP(); const v = useDraftView(); const d = dp.input;
  const step = v?.next ?? 0;
  const done = !d || step >= dp.order.length;
  const ours = d && !done ? isUs(d, step) : false;
  const pick = !done && dp.order[step].pick;
  const sugg = useMemo(() => (!d || !v || done || !ours ? [] : (pick ? suggestPick(d, v) : suggestBan(d, v))), [d, v, done, ours, pick]);
  const guess = useMemo(() => (!d || !v || done || ours ? [] : (pick ? predictPick(d, v, 'them') : predictBan(d, v, 'them'))), [d, v, done, ours, pick]);
  const ev = d && v ? evaluate(d, v) : null;
  return { dp, v, d, step, done, ours, pick, sugg, guess, ev };
}

export const textBtn = 'text-xs font-bold uppercase tracking-widest hover:underline';

/** Both finished lineups, hero by hero */
export function FinalLineups() {
  const dp = useDP(); const v = useDraftView();
  const heroOf = (key: string) => [...(v?.owner.entries() ?? [])].find(([, k]) => k === key)?.[0];
  return (
    <div className="flex-1 min-h-0 grid grid-cols-2 gap-6">
      {(['us', 'them'] as const).map(side => (
        <div key={side} className="flex flex-col min-h-0">
          {dp.players[side].map((pm, i) => {
            const h = heroOf(pm.p.key);
            return (
              <div key={pm.p.key} className="flex-1 min-h-0 flex items-center gap-3 border-b" style={{ borderColor: RULE }}>
                {h != null ? <HeroImg heroId={h} className="rounded-sm h-[80%] aspect-video w-auto" /> : null}
                <Avatar player={{ name: pm.p.name, avatar: (side === 'us' ? dp.lineUs : dp.lineThem)[i]?.avatar }} size={36} />
                <span className="flex-1 min-w-0 truncate font-bold" style={{ color: side === 'us' ? C.radiant : C.dire, fontSize: vh(13, 1.8, 18) }}>{pm.p.name}</span>
                {h != null && <span className="tabular-nums" style={{ color: C.muted }}>{Math.round(pm.strength(h) * 100)}%</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function Workbench() {
  const font = useHeaderFont();
  const { dp, step, done, ours, pick, sugg, guess, ev } = useStepInfo();
  const rewind = useRewind();
  const thin = useThinData();
  const top = sugg.slice(0, 8); const tg = guess.slice(0, 8);
  const range: [number, number] = top.length ? [Math.min(...top.map(s => s.score)), top[0].score] : [0, 0];
  const sugMap = new Map(top.map((s, k) => [s.hero, k])); const gMap = new Map(tg.map(g => [g.hero, g.p]));
  return (
    <div className="flex flex-col min-h-0 h-full">
      <DraftStrip size={72} onStepClick={rewind} />
      <div className="shrink-0 flex items-end gap-8 mt-2">
        <span className="font-logik-extended-bold uppercase whitespace-nowrap" style={{ color: done ? C.heading : ours ? C.radiant : C.dire, fontSize: vh(18, 2.8, 32), ...font }}>
          {done ? 'Draft gotowy' : `${step + 1}. ${pick ? 'pick' : 'ban'} · ${ours ? 'my' : 'oni'}`}
        </span>
        {ev && <div className="flex-1"><WinBar pUs={ev.pUs} height={8} note={thin ? 'szacowana szansa · mało danych, traktuj orientacyjnie' : 'szacowana szansa'} /></div>}
        <span className="flex gap-4 pb-1" style={{ color: C.muted }}>
          <CmExplainer />
          <button type="button" onClick={dp.undo} className={textBtn}>Cofnij</button>
          <button type="button" onClick={dp.reset} className={textBtn}>Od nowa</button>
        </span>
      </div>
      <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,42%)_minmax(0,1fr)] gap-6 mt-3">
        <div className="flex flex-col min-h-0">
          <Label color={ours ? (pick ? C.win : C.loss) : C.dire}>{done ? 'Składy' : ours ? (pick ? 'Proponujemy wybrać' : 'Proponujemy zbanować') : (pick ? 'Prawdopodobnie wybiorą' : 'Prawdopodobnie zbanują')}</Label>
          {done ? <FinalLineups /> : ours
            ? top.map((s, k) => <SuggestionRow key={s.hero} s={s} rank={k} ban={!pick} range={range} onPick={dp.pushHero} />)
            : tg.map((g, k) => <GuessRow key={g.hero} g={g} rank={k} onPick={dp.pushHero} />)}
        </div>
        <HeroGrid tile={96} onPick={dp.pushHero} mark={h => {
          const k = sugMap.get(h); if (k != null) return { color: pick ? C.loss : C.win, strength: 1 - k / 8, label: `${k + 1}. propozycja` };
          const p = gMap.get(h); if (p && p > 0.02) return { color: C.dire, strength: Math.min(1, p * 4), label: `${Math.round(p * 100)}% że to wybiorą` };
          return null;
        }} />
      </div>
    </div>
  );
}

/**
 * The whole expected draft from here, phase by phase: our moves are the engine's suggestions,
 * theirs the likeliest prediction — so ban timing and pick order come from one consistent story.
 */
export function PlanBoard() {
  const dp = useDP(); const d = dp.input;
  const plan = useMemo(() => (d ? planDraft({ ...d, steps: d.steps.map(() => null) }) : []), [d]);
  if (!d) return null;
  const owner = (st: PlanStep) => (st.player ? ` · ${st.player.p.name}` : '');
  const phases: Array<{ pick: boolean; steps: PlanStep[] }> = [];
  for (const st of plan) { const last = phases[phases.length - 1]; if (last && last.pick === st.pick) last.steps.push(st); else phases.push({ pick: st.pick, steps: [st] }); }
  // three columns: each ban phase with the picks that follow it
  const cols: Array<typeof phases> = [];
  phases.forEach(ph => { if (!ph.pick || !cols.length) cols.push([ph]); else cols[cols.length - 1].push(ph); });
  const row = (st: PlanStep) => (
    <Tip key={st.i} content={<TipBody title={`${st.i + 1}. ${st.pick ? 'pick' : 'ban'} — ${st.us ? 'my' : 'oni'}`}>{st.reason}{st.p != null ? ` · ${Math.round(st.p * 100)}%` : ''}{!st.pick && st.player && st.when != null ? `. ${Math.round(st.when * 100)}% szans, że ${st.player.p.name} wybiera przed naszym kolejnym banem — potem byłoby za późno.` : ''}</TipBody>}>
      <div className="flex-1 min-h-0 max-h-[80px] flex items-center gap-3 border-b cursor-help" style={{ borderColor: RULE, boxShadow: `inset 3px 0 0 ${st.us ? C.radiant : C.dire}`, paddingLeft: 10 }}>
        <span className="w-5 shrink-0 tabular-nums" style={{ color: C.muted, fontSize: vh(10, 1.3, 13) }}>{st.i + 1}</span>
        <HeroImg heroId={st.hero} className="rounded-sm shrink-0" style={{ height: 'min(76%, 56px)', aspectRatio: '16 / 9', width: 'auto', filter: st.pick ? undefined : 'grayscale(0.7)' }} />
        <span className="min-w-0 flex-1">
          <span className="block font-bold truncate" style={{ color: C.heading, fontSize: vh(13, 1.8, 18), textDecoration: st.pick ? undefined : 'line-through' }}>{heroName(st.hero)}</span>
          <span className="block truncate" style={{ color: st.us ? C.radiant : C.dire, fontSize: vh(10, 1.4, 14) }}>
            {st.pick ? `${st.us ? 'my' : 'oni'}${owner(st)}` : `${st.us ? 'banujemy' : 'banują'}${st.player ? ` · przeciw: ${st.player.p.name}` : ''}`}
          </span>
        </span>
      </div>
    </Tip>
  );
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 pb-2 flex items-center gap-3" style={{ fontSize: vh(12, 1.6, 16) }}>
        <span className="font-bold uppercase tracking-wider" style={{ color: dp.usFirst ? C.radiant : C.dire }}>Wariant: {dp.usFirst ? 'zaczynamy my' : 'zaczynają oni'}</span>
        <span style={{ color: C.muted }}>— drugi wariant zobaczysz, przełączając „Zaczynamy my / Zaczynają oni” u góry. Ściąga zawiera oba.</span>
      </div>
      <div className="flex-1 min-h-0 grid grid-cols-3 gap-8">
        {cols.map((col, ci) => (
          <div key={ci} className="flex flex-col min-h-0">
            {col.map((ph, pi) => (
              <React.Fragment key={pi}>
                <div className={pi ? 'pt-3' : ''}><Label color={ph.pick ? C.heading : C.loss}>{ph.pick ? 'Picki' : 'Bany'} {ph.steps[0].i + 1}–{ph.steps[ph.steps.length - 1].i + 1}</Label></div>
                {ph.steps.map(row)}
              </React.Fragment>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
