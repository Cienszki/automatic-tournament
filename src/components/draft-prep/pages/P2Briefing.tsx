'use client';

// Draft prep #2 — Briefing. The preparation as five steps a captain walks through before the
// match: 1) lineups and standins, 2) every opponent, one at a time — pool per period and source,
// where they pick, how to shut them down, 3) the ban plan, 4) the simulator, 5) a cheat sheet to
// paste into the team's Discord. Every step fills the screen.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar, C, HeroImg, HeroRender, Tip, TipBody, ink, mix, useHeaderFont } from '@/components/stats-lab/kit';
import { heroName } from '@/lib/stats-lab/heroes';
import {
  SOURCES, SOURCE_LABEL, WINDOWS, WINDOW_LABEL, planDraft, predictOrder, suggestBan, viewOf,
  type DraftInput, type PlayerModel,
} from '@/lib/draft-prep/engine';
import { useDP } from '../state';
import { Filters, GuessRow, Label, MatchBar, PlayerRow, PrepFrame, RULE, ShareBar, SourceLegend, vh } from '../ui';
import { PlanBoard, Workbench, textBtn } from '../workbench';

const STEPS = ['Składy', 'Rywale', 'Plan banów', 'Symulacja', 'Ściąga'];

/** Bans each side gets in each ban phase, from the draft order */
function banPhases(d: DraftInput) {
  const phases: Array<{ us: number; them: number }> = []; let cur: { us: number; them: number } | null = null; let lastPick = true;
  d.order.forEach(st => {
    if (st.pick) { lastPick = true; return; }
    if (lastPick) { cur = { us: 0, them: 0 }; phases.push(cur); lastPick = false; }
    if (st.first === d.usFirst) cur!.us++; else cur!.them++;
  });
  return phases;
}

function StepLineups() {
  const dp = useDP();
  return (
    <div className="flex-1 min-h-0 grid grid-cols-2 gap-10">
      {(['us', 'them'] as const).map(side => {
        const pending = side === 'us' ? dp.pendingUs : dp.pendingThem;
        return (
          <div key={side} className="flex flex-col min-h-0">
            <Label color={side === 'us' ? C.radiant : C.dire}>{(side === 'us' ? dp.us : dp.them)?.name}{pending.length ? ` · zgłoszeni stand-ini: ${pending.map(s => s.name).join(', ')} — wstaw ich klikając w nick` : ' · kliknij nick, by podmienić gracza'}</Label>
            {dp.players[side].map((pm, i) => <PlayerRow key={pm.p.key} side={side} i={i} pm={pm} avatar={72} why />)}
          </div>
        );
      })}
    </div>
  );
}

function StepRivals() {
  const font = useHeaderFont();
  const dp = useDP(); const d = dp.input;
  const [i, setI] = useState(0);
  const pm: PlayerModel | undefined = dp.players.them[i];
  const order = useMemo(() => (d ? predictOrder(d.habitsThem, dp.players.them) : []), [d, dp.players.them]);
  const slot = order.find(o => o.pm === pm);
  const counters = useMemo(() => {
    if (!d || !pm) return [];
    const v = viewOf(d);
    return suggestBan({ ...d, them: { ...d.them, players: [pm] } }, { ...v, freeThem: [pm] }).slice(0, 4);
  }, [d, pm]);
  const top = useMemo(() => (pm ? [...pm.p.heroes.values()].sort((a, b) => b.wg - a.wg).slice(0, 8) : []), [pm]);
  const likeTotal = top.reduce((a, h) => a + (pm?.like.get(h.hero) ?? 0), 0) || 1;
  if (!pm) return null;
  const fav = top[0]?.hero;
  return (
    <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,16%)_minmax(0,1fr)_minmax(0,24%)] gap-8">
      <div className="flex flex-col min-h-0">
        {dp.players.them.map((x, k) => (
          <button key={x.p.key} type="button" onClick={() => setI(k)} className="flex-1 min-h-0 flex items-center gap-3 border-b text-left" style={{ borderColor: RULE, boxShadow: k === i ? `inset 4px 0 0 ${C.dire}` : undefined, paddingLeft: k === i ? 12 : 0, opacity: k === i ? 1 : 0.6 }}>
            <Avatar player={{ name: x.p.name, avatar: dp.lineThem[k]?.avatar }} size={56} />
            <span className="min-w-0"><span className="block font-bold truncate" style={{ color: C.heading, fontSize: vh(14, 2, 20) }}>{x.p.name}</span><span className="block" style={{ color: C.muted, fontSize: vh(11, 1.4, 14) }}>{x.p.role ?? '—'}</span></span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={pm.p.key} className="flex flex-col min-h-0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
          <div className="relative shrink-0 flex items-center gap-6 pb-3" style={{ height: '28%' }}>
            {fav != null && <div className="absolute right-0 top-0 bottom-0 w-[38%] opacity-90 pointer-events-none"><HeroRender heroId={fav} sizes="360px" /></div>}
            <Avatar player={{ name: pm.p.name, avatar: dp.lineThem[i]?.avatar }} size={120} ring={C.dire} />
            <div className="relative min-w-0 flex-1">
              <div className="font-logik-extended-bold uppercase truncate" style={{ color: C.heading, fontSize: vh(26, 4.4, 52), ...font }}>{pm.p.name}</div>
              <div style={{ color: C.text, fontSize: vh(13, 1.8, 18) }}>{pm.p.role ?? '—'}{slot ? ` · zwykle ${slot.k + 1}. pick drużyny (${Math.round(slot.p * 100)}%)` : ''}</div>
              <div className="my-2" style={{ width: '55%' }}><ShareBar pm={pm} height={6} /></div>
              <div className="line-clamp-3 max-w-[62%]" style={{ color: C.muted, fontSize: vh(11, 1.5, 15) }}>{pm.p.why.join(' ')}</div>
            </div>
          </div>
          <div className="shrink-0 flex items-center justify-between border-b pb-2" style={{ borderColor: RULE }}><Filters /><SourceLegend /></div>
          <div className="shrink-0 grid items-end gap-x-4 pt-2 pb-1" style={{ gridTemplateColumns: 'minmax(0,1fr) repeat(4, 90px) 70px' }}>
            <span />{WINDOWS.map(w => <span key={w} className="text-center text-[11px] uppercase tracking-wider" style={{ color: C.muted }}>{WINDOW_LABEL[w]}</span>)}
            <Tip content="Nasza ocena, jak często go wybierze"><span className="text-right text-[11px] uppercase tracking-wider cursor-help" style={{ color: C.muted }}>Szansa</span></Tip>
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            {top.map(h => (
              <div key={h.hero} className="flex-1 min-h-0 grid items-center gap-x-4 border-b" style={{ gridTemplateColumns: 'minmax(0,1fr) repeat(4, 90px) 70px', borderColor: RULE }}>
                <span className="flex items-center gap-3 min-w-0 h-full overflow-hidden"><HeroImg heroId={h.hero} className="rounded-sm shrink-0" style={{ height: 'min(80%, 52px)', aspectRatio: '16 / 9', width: 'auto' }} /><span className="truncate font-bold" style={{ color: C.heading, fontSize: vh(13, 1.9, 19) }}>{heroName(h.hero)}</span></span>
                {WINDOWS.map(w => {
                  const g = dp.sources.reduce((a, s) => a + h.cells[s][w].g, 0); const wn = dp.sources.reduce((a, s) => a + h.cells[s][w].w, 0); const wr = g ? wn / g : 0;
                  return (
                    <Tip key={w} content={<TipBody title={`${heroName(h.hero)} · ${WINDOW_LABEL[w]}`}>{SOURCES.map(s => `${SOURCE_LABEL[s]}: ${h.cells[s][w].g}`).join(' · ')}</TipBody>}>
                      <span className="text-center tabular-nums cursor-help" style={{ fontSize: vh(13, 1.8, 18) }}><span style={{ color: g ? C.heading : C.muted }}>{g || '–'}</span>{g > 0 && <span className="ml-1.5 font-bold" style={{ color: wr >= 0.55 ? C.win : wr <= 0.45 ? C.loss : C.muted }}>{Math.round(wr * 100)}%</span>}</span>
                    </Tip>
                  );
                })}
                <span className="text-right font-bold tabular-nums" style={{ color: C.heading, fontSize: vh(14, 2, 20) }}>{Math.round(((pm.like.get(h.hero) ?? 0) / likeTotal) * 100)}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="flex flex-col min-h-0">
        <Label color={C.loss}>Jak go wyłączyć — bany</Label>
        {counters.map((s, k) => (
          <Tip key={s.hero} content={s.parts.map(p => p.label).join(' · ')}>
            <div className="flex-1 min-h-0 flex flex-col justify-center gap-1 border-b cursor-help" style={{ borderColor: RULE }}>
              <HeroImg heroId={s.hero} className="rounded-sm h-[62%] aspect-video w-auto" style={{ boxShadow: k === 0 ? `0 0 0 2px ${C.loss}` : undefined }} />
              <span className="font-bold truncate" style={{ color: C.heading, fontSize: vh(13, 1.8, 18) }}>{heroName(s.hero)}</span>
            </div>
          </Tip>
        ))}
      </div>
    </div>
  );
}

function StepBans() {
  return (
    <>
      <div className="shrink-0 pb-2" style={{ color: C.muted, fontSize: vh(11, 1.5, 15) }}>Spodziewany przebieg draftu: nasze ruchy to propozycje silnika, ich — najbardziej prawdopodobne. Bany celują w graczy, którzy wybierają przed naszą następną fazą banów.</div>
      <PlanBoard />
    </>
  );
}

function StepCheatSheet() {
  const dp = useDP(); const d = dp.input;
  const [copied, setCopied] = useState(false);
  const sheet = useMemo(() => {
    if (!d) return null;
    const plan = planDraft({ ...d, steps: d.steps.map(() => null) });
    return { bans: plan.filter(x => x.us && !x.pick), theirBans: plan.filter(x => !x.us && !x.pick), order: predictOrder(d.habitsThem, dp.players.them), picks: plan.filter(x => x.us && x.pick) };
  }, [d, dp.players.them]);
  if (!sheet) return null;
  const lines = [
    `DRAFT vs ${dp.them?.name}`,
    `Nasze bany (krok): ${sheet.bans.map(x => `${x.i + 1}. ${heroName(x.hero)}`).join(', ')}`,
    `Oni pewnie zbanują: ${sheet.theirBans.map(x => `${x.i + 1}. ${heroName(x.hero)}`).join(', ')}`,
    `Ich kolejność: ${sheet.order.map(o => `${o.k + 1}. ${o.pm.p.name}`).join(' → ')}`,
    ...dp.players.them.map(pm => `• ${pm.p.name}: ${[...pm.like.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([h]) => heroName(h)).join(', ')}`),
    `Nasze picki wg planu: ${sheet.picks.map(x => `${x.i + 1}. ${heroName(x.hero)} (${x.player?.p.name})`).join(', ')}`,
  ];
  return (
    <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_minmax(0,36%)] gap-10">
      <div className="flex flex-col min-h-0">
        <Label color={C.dire}>Ich kolejność i bohaterowie</Label>
        {[...sheet.order].map(o => (
          <div key={o.pm.p.key} className="flex-1 min-h-0 flex items-center gap-4 border-b" style={{ borderColor: RULE }}>
            <span className="w-10 font-bold" style={{ color: C.dire, fontSize: vh(14, 2.2, 22) }}>{o.k + 1}.</span>
            <Avatar player={{ name: o.pm.p.name, avatar: dp.lineThem.find(s => s.key === o.pm.p.key)?.avatar }} size={52} />
            <span className="w-40 shrink-0 truncate font-bold" style={{ color: C.heading, fontSize: vh(14, 2, 20) }}>{o.pm.p.name}</span>
            {[...o.pm.like.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([h]) => <Tip key={h} content={heroName(h)}><span className="w-[15%] max-w-[120px] aspect-video shrink"><HeroImg heroId={h} className="rounded-sm w-full h-full" /></span></Tip>)}
          </div>
        ))}
      </div>
      <div className="flex flex-col min-h-0">
        <Label>Do wklejenia na Discorda</Label>
        <div className="flex-1 min-h-0 flex flex-col justify-between py-2 border-t border-b" style={{ borderColor: RULE, fontSize: vh(12, 1.6, 16), color: C.text }}>
          {lines.map((l, k) => <div key={k} className={k === 0 ? 'font-bold' : ''} style={k === 0 ? { color: C.heading } : undefined}>{l}</div>)}
        </div>
        <button type="button" onClick={() => { navigator.clipboard?.writeText(lines.join('\n')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}
          className="shrink-0 mt-3 py-3 font-bold uppercase tracking-[0.3em] text-white" style={{ background: C.primary, fontSize: vh(12, 1.6, 15) }}>{copied ? 'Skopiowano' : 'Kopiuj'}</button>
      </div>
    </div>
  );
}

function Briefing() {
  const font = useHeaderFont();
  const [step, setStep] = useState(0);
  return (
    <>
      <MatchBar draft={step === 3} />
      <div className="shrink-0 flex items-center gap-8 py-3">
        {STEPS.map((s, i) => (
          <button key={s} type="button" onClick={() => setStep(i)} className="flex items-baseline gap-2 pb-1 border-b-2" style={{ borderColor: i === step ? C.secondary : 'transparent', color: i === step ? C.heading : C.muted }}>
            <span className="font-logik-extended-bold tabular-nums" style={{ fontSize: vh(14, 2, 22), ...font }}>{i + 1}</span>
            <span className="font-bold uppercase tracking-wider" style={{ fontSize: vh(12, 1.6, 16) }}>{s}</span>
          </button>
        ))}
        <span className="ml-auto flex gap-6" style={{ color: C.muted }}>
          {step > 0 && <button type="button" onClick={() => setStep(step - 1)} className={textBtn}>‹ Wstecz</button>}
          {step < STEPS.length - 1 && <button type="button" onClick={() => setStep(step + 1)} className={textBtn} style={{ color: C.heading }}>Dalej: {STEPS[step + 1]} ›</button>}
        </span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={step} className="flex-1 min-h-0 flex flex-col" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          {step === 0 && <StepLineups />}
          {step === 1 && <StepRivals />}
          {step === 2 && <StepBans />}
          {step === 3 && <Workbench />}
          {step === 4 && <StepCheatSheet />}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

export default function P2Briefing() {
  return <PrepFrame><Briefing /></PrepFrame>;
}
