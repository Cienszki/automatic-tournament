'use client';

// Draft prep #2 — Briefing. The preparation as five steps a captain walks through before the
// match: 1) lineups and standins, 2) every opponent, one at a time — pool per period and source,
// where they pick, how to shut them down — and the team's real drafts, 3) the ban plan, 4) the
// simulator, 5) a cheat sheet (both "who starts" variants) to paste into the team's Discord.
// Every step fills the screen; phones get a read-only scrolling version (MobilePrep).

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ChevronDown, ChevronRight } from 'lucide-react';
import { Avatar, C, HeroImg, Tip, TipBody, ink, useHeaderFont } from '@/components/stats-lab/kit';
import { heroName } from '@/lib/stats-lab/heroes';
import { count } from '@/lib/plural';
import { SOURCES, SOURCE_LABEL, WINDOWS, WINDOW_LABEL, predictOrder, roleLabel, suggestBan, viewOf, type PlayerModel, type Window } from '@/lib/draft-prep/engine';
import { useDP } from '../state';
import { DataChip, Filters, Label, LoadBanner, MatchBar, PlayerRow, PlayerTip, PrepFrame, RULE, ShareBar, dotabuff, vh } from '../ui';
import { PlanBoard, Workbench, textBtn } from '../workbench';
import { Intro, useIntro } from '../guide';
import { TeamDrafts } from '../drafts';
import { useCheatSheet } from '../sheet';
import { OrderChart } from '../order-chart';
import { MobilePrep } from '../mobile';

const STEPS = ['Składy', 'Rywale', 'Plan banów', 'Symulacja', 'Ściąga'];

function StepLineups() {
  const dp = useDP();
  return (
    <div className="flex-1 min-h-0 grid grid-cols-2 gap-10">
      {(['us', 'them'] as const).map(side => {
        const pending = side === 'us' ? dp.pendingUs : dp.pendingThem;
        return (
          <div key={side} className="flex flex-col min-h-0">
            <Label color={side === 'us' ? C.radiant : C.dire}>{(side === 'us' ? dp.us : dp.them)?.name}{pending.length ? ` · zgłoszeni stand-ini: ${pending.map(s => s.name).join(', ')} — wstawisz ich przez „Stand-iny” u góry` : ''}</Label>
            {dp.players[side].map((pm, i) => <PlayerRow key={pm.p.key} side={side} i={i} pm={pm} avatar={72} why />)}
          </div>
        );
      })}
    </div>
  );
}

/** One opponent: pool per period, when they pick, and the bans that take their heroes away */
function RivalPlayers() {
  const dp = useDP(); const d = dp.input;
  const [i, setI] = useState(0);
  const pm: PlayerModel | undefined = dp.players.them[i];
  const order = useMemo(() => (d ? predictOrder(d.habitsThem, dp.players.them) : []), [d, dp.players.them]);
  const slot = order.find(o => o.pm === pm);
  // from an empty draft, whatever was clicked in the simulator: only bans that take THIS player's heroes
  const counters = useMemo(() => {
    if (!d || !pm) return [];
    const base = { ...d, steps: d.steps.map(() => null), assign: {}, them: { ...d.them, players: [pm] } };
    const threat = (s: { parts: Array<{ label: string; v: number }> }) => s.parts.find(p => p.label.startsWith('odbiera'))?.v ?? 0;
    return suggestBan(base, { ...viewOf(base), freeThem: [pm] }).filter(s => threat(s) > 0).sort((a, b) => threat(b) - threat(a)).slice(0, 4);
  }, [d, pm]);
  const [sort, setSort] = useState<Window | 'chance'>('chance');
  const top = useMemo(() => {
    if (!pm) return [];
    const games = (h: number, w: Window) => { const st = pm.p.heroes.get(h); return st ? dp.sources.reduce((a, s) => a + st.cells[s][w].g, 0) : 0; };
    const ids = [...new Set([...pm.p.heroes.keys(), ...[...pm.like.entries()].filter(([, l]) => l > 0.01).map(([h]) => h)])].filter(h => (pm.like.get(h) ?? 0) > 0);
    const by = sort === 'chance' ? (h: number) => pm.like.get(h) ?? 0 : (h: number) => games(h, sort) + (pm.like.get(h) ?? 0) * 1e-3;
    return ids.sort((a, b) => by(b) - by(a)).slice(0, 8);
  }, [pm, sort, dp.sources]);
  const font = useHeaderFont();
  if (!pm) return null;
  const known = !!d?.habitsThem.games;
  return (
    <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,16%)_minmax(0,1fr)_minmax(0,24%)] gap-8">
      <div className="flex flex-col min-h-0">
        {dp.players.them.map((x, k) => (
          <PlayerTip key={x.p.key} pm={x}>
            <button type="button" onClick={() => setI(k)} className="flex-1 min-h-0 flex items-center gap-3 border-b text-left" style={{ borderColor: RULE, boxShadow: k === i ? `inset 4px 0 0 ${C.dire}` : undefined, paddingLeft: k === i ? 12 : 0, opacity: k === i ? 1 : 0.6 }}>
              <Avatar player={{ name: x.p.name, avatar: dp.lineThem[k]?.avatar }} size={56} />
              <span className="min-w-0"><span className="block font-bold truncate" style={{ color: C.heading, fontSize: vh(14, 2, 20) }}>{x.p.name}</span><span className="flex items-center gap-2" style={{ color: C.muted, fontSize: vh(11, 1.4, 14) }}>{roleLabel(x.p.role)}<DataChip pm={x} short /></span></span>
            </button>
          </PlayerTip>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={pm.p.key} className="flex flex-col min-h-0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
          <PlayerTip pm={pm}>
          <div className="relative shrink-0 flex items-center gap-6 pb-3">
            <Avatar player={{ name: pm.p.name, avatar: dp.lineThem[i]?.avatar }} size={104} ring={C.dire} />
            <div className="relative min-w-0 flex-1">
              <a href={dotabuff(pm.p.sid32)} target="_blank" rel="noopener noreferrer" className="block font-logik-extended-bold uppercase truncate hover:underline" style={{ color: C.heading, fontSize: vh(26, 4.4, 52), ...font }}>{pm.p.name}</a>
              <div style={{ color: C.text, fontSize: vh(13, 1.8, 18) }}>
                {roleLabel(pm.p.role)}
                {slot ? (known ? ` · zwykle ${slot.k + 1}. pick drużyny (${Math.round(slot.p0 * 100)}%)` : ` · pewnie ${slot.k + 1}. pick drużyny — typowo dla ligi, ich draftów jeszcze nie ma`) : ''}
              </div>
              <div className="my-2 flex items-center gap-4"><DataChip pm={pm} /><span className="w-[40%]"><ShareBar pm={pm} height={6} /></span></div>
              <div className="line-clamp-2 max-w-[80%]" style={{ color: C.muted, fontSize: vh(11, 1.45, 15) }}>{pm.p.why.join(' ')}</div>
            </div>
          </div>
          </PlayerTip>
          <div className="shrink-0 flex items-center justify-between border-b pb-2" style={{ borderColor: RULE }}><Filters windows={false} /></div>
          <div className="shrink-0 grid items-end gap-x-4 pt-2 pb-1" style={{ gridTemplateColumns: 'minmax(0,1fr) repeat(4, 90px) 70px' }}>
            <span className="text-[11px]" style={{ color: C.muted }}>kliknij kolumnę, by posortować</span>
            {WINDOWS.map(w => (
              <button key={w} type="button" onClick={() => setSort(w)} className="flex items-center justify-center gap-0.5 text-[11px] uppercase tracking-wider hover:text-white" style={{ color: sort === w ? C.heading : C.muted }}>
                {WINDOW_LABEL[w]}{sort === w && <ChevronDown className="w-3 h-3" />}
              </button>
            ))}
            <Tip content={<TipBody title="Szansa">Nasza ocena, jak często wybierze tego bohatera w drafcie. Liczona ze wszystkich źródeł naraz (ważonych), więc nie zmienia się po odznaczeniu źródła wyżej.</TipBody>}>
              <button type="button" onClick={() => setSort('chance')} className="flex items-center justify-end gap-0.5 text-[11px] uppercase tracking-wider underline decoration-dotted hover:text-white" style={{ color: sort === 'chance' ? C.heading : C.muted }}>
                Szansa{sort === 'chance' && <ChevronDown className="w-3 h-3" />}
              </button>
            </Tip>
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            {pm.p.heroes.size ? top.map(hero => {
              const h = pm.p.heroes.get(hero);
              const like = pm.like.get(hero) ?? 0;
              return (
                <div key={hero} className="flex-1 min-h-0 grid items-center gap-x-4 border-b" style={{ gridTemplateColumns: 'minmax(0,1fr) repeat(4, 90px) 70px', borderColor: RULE }}>
                  <span className="flex items-center gap-3 min-w-0 h-full overflow-hidden"><HeroImg heroId={hero} className="rounded-sm shrink-0" style={{ height: 'min(80%, 52px)', aspectRatio: '16 / 9', width: 'auto' }} /><span className="truncate font-bold" style={{ color: C.heading, fontSize: vh(13, 1.9, 19) }}>{heroName(hero)}</span></span>
                  {WINDOWS.map(w => {
                    const g = h ? dp.sources.reduce((a, s) => a + h.cells[s][w].g, 0) : 0; const wn = h ? dp.sources.reduce((a, s) => a + h.cells[s][w].w, 0) : 0; const wr = g ? wn / g : 0;
                    return (
                      <Tip key={w} content={<TipBody title={`${heroName(hero)} · ${WINDOW_LABEL[w]}`}>{h ? SOURCES.map(s => `${SOURCE_LABEL[s]}: ${h.cells[s][w].g}`).join(' · ') : 'brak gier'}</TipBody>}>
                        <span className="text-center tabular-nums cursor-help" style={{ fontSize: vh(13, 1.8, 18) }}><span style={{ color: g ? C.heading : C.muted }}>{g || '–'}</span>{g > 0 && <span className="ml-1.5 font-bold" style={{ color: wr >= 0.55 ? C.win : wr <= 0.45 ? C.loss : C.muted }}>{Math.round(wr * 100)}%</span>}</span>
                      </Tip>
                    );
                  })}
                  <span className="text-right font-bold tabular-nums" style={{ color: C.heading, fontSize: vh(14, 2, 20) }}>{like < 0.005 ? '<1%' : `${Math.round(like * 100)}%`}</span>
                </div>
              );
            }) : <div className="flex-1 flex items-center" style={{ color: C.muted }}>Brak gier tego gracza — nie wiemy, czym gra. Bany lepiej wydać na pozostałych.</div>}
          </div>
          <div className="shrink-0 pt-1 text-[11px]" style={{ color: C.muted }}>W kolumnach: gry · procent wygranych w danym okresie.</div>
        </motion.div>
      </AnimatePresence>
      <div className="flex flex-col min-h-0">
        <Label color={C.loss}>Jak go wyłączyć — bany</Label>
        {counters.length ? counters.map((s, k) => {
          const st = pm.p.heroes.get(s.hero);
          const g = st ? SOURCES.reduce((a, x) => a + st.cells[x].all.g, 0) : 0; const w = st ? SOURCES.reduce((a, x) => a + st.cells[x].all.w, 0) : 0;
          return (
            <Tip key={s.hero} content={s.parts.map(p => p.label).join(' · ')}>
              <div className="flex-1 min-h-0 flex flex-col justify-center gap-1 border-b cursor-help" style={{ borderColor: RULE }}>
                <HeroImg heroId={s.hero} className="rounded-sm h-[58%] aspect-video w-auto" style={{ boxShadow: k === 0 ? `0 0 0 2px ${C.loss}` : undefined }} />
                <span className="font-bold truncate" style={{ color: C.heading, fontSize: vh(13, 1.8, 18) }}>{heroName(s.hero)}</span>
                <span className="truncate" style={{ color: C.muted, fontSize: vh(10, 1.35, 13) }}>{g ? `${count(g, 'gra', 'gry', 'gier')} · ${Math.round((w / g) * 100)}% wygranych` : 'pasuje do jego roli i mety'}</span>
              </div>
            </Tip>
          );
        }) : <div className="text-sm pt-2" style={{ color: C.muted }}>Za mało danych, by celować w niego banami.</div>}
      </div>
    </div>
  );
}

function StepRivals() {
  const dp = useDP();
  const [tab, setTab] = useState<'players' | 'drafts'>('players');
  const games = useMemo(() => (dp.model && dp.them ? dp.model.games.filter(g => g.radiant === dp.them!.id || g.dire === dp.them!.id).length : 0), [dp.model, dp.them]);
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 flex items-center gap-6 pb-2 text-sm font-bold uppercase tracking-wider">
        {([['players', 'Gracze'], ['drafts', `Ich drafty w turnieju (${games})`]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className="pb-0.5 border-b-2" style={{ borderColor: tab === k ? C.dire : 'transparent', color: tab === k ? C.heading : C.muted }}>{l}</button>
        ))}
      </div>
      {tab === 'players' ? <RivalPlayers /> : <TeamDrafts />}
    </div>
  );
}

function StepBans() {
  return (
    <>
      <div className="shrink-0 pb-2" style={{ color: C.muted, fontSize: vh(11, 1.5, 15) }}>Spodziewany przebieg draftu: nasze ruchy to propozycje narzędzia, ich — najbardziej prawdopodobne. Bany celują w graczy, którzy wybierają, zanim znowu będziemy banować. Najedź na wiersz, by zobaczyć powód.</div>
      <PlanBoard />
    </>
  );
}

function StepCheatSheet() {
  const sheet = useCheatSheet();
  const dp = useDP();
  const [side, setSide] = useState<'them' | 'us'>('them');
  const [copied, setCopied] = useState(false);
  if (!sheet) return null;
  return (
    <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_minmax(0,40%)] gap-10">
      <div className="flex flex-col min-h-0">
        <div className="shrink-0 flex items-center gap-6 pb-1 text-sm font-bold uppercase tracking-wider">
          {([['them', `${dp.them?.name ?? 'Rywale'}: kolejność i bohaterowie`, C.dire], ['us', `${dp.us?.name ?? 'My'}: kolejność i bohaterowie`, C.radiant]] as const).map(([k, l, c]) => (
            <button key={k} type="button" onClick={() => setSide(k)} className="pb-0.5 border-b-2" style={{ borderColor: side === k ? c : 'transparent', color: side === k ? C.heading : C.muted }}>{l}</button>
          ))}
        </div>
        <OrderChart key={side} side={side} />
      </div>
      <div className="flex flex-col min-h-0">
        <Label>Do wklejenia na Discorda · oba warianty</Label>
        <div className="flex-1 min-h-0 overflow-y-auto py-2 border-t border-b flex flex-col gap-1" style={{ borderColor: RULE, fontSize: vh(11, 1.45, 15), color: C.text }}>
          {sheet.lines.map((l, k) => <div key={k} className={l ? '' : 'h-2'} style={l.startsWith('**') ? { color: C.heading, fontWeight: 700 } : undefined}>{l.replace(/\*\*/g, '').replace(/_\((.*)\)_/, '($1)')}</div>)}
        </div>
        <button type="button" onClick={() => { navigator.clipboard?.writeText(sheet.lines.join('\n')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}
          className="shrink-0 mt-3 py-3 font-bold uppercase tracking-[0.3em] text-white" style={{ background: C.primary, fontSize: vh(12, 1.6, 15) }}>{copied ? 'Skopiowano' : 'Kopiuj'}</button>
      </div>
    </div>
  );
}

function Briefing() {
  const font = useHeaderFont();
  const [step, setStep] = useState(0);
  const intro = useIntro();
  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      <MatchBar />
      <div className="shrink-0 flex items-center gap-3 py-3">
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            {i > 0 && <ChevronRight className="w-4 h-4 shrink-0" style={{ color: ink(30) }} />}
            <button type="button" onClick={() => setStep(i)} className="flex items-baseline gap-2 pb-1 border-b-2" style={{ borderColor: i === step ? C.secondary : 'transparent', color: i === step ? C.heading : C.muted }}>
              <span className="font-logik-extended-bold tabular-nums" style={{ fontSize: vh(14, 2, 22), ...font }}>{i + 1}</span>
              <span className="font-bold uppercase tracking-wider whitespace-nowrap" style={{ fontSize: vh(12, 1.6, 16) }}>{s}</span>
            </button>
          </React.Fragment>
        ))}
        <span className="ml-auto flex items-center gap-5" style={{ color: C.muted }}>
          <button type="button" onClick={intro.show} className={textBtn}>Jak korzystać</button>
          {step > 0 && <button type="button" onClick={() => setStep(step - 1)} className="px-3 py-2 rounded-md text-xs font-bold uppercase tracking-widest border hover:bg-white/5" style={{ borderColor: ink(20), color: C.text }}>‹ Wstecz</button>}
          {step < STEPS.length - 1 && (
            <button type="button" onClick={() => setStep(step + 1)} className="flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-widest text-white shadow-lg hover:brightness-110" style={{ background: C.primary }}>
              Dalej: {STEPS[step + 1]}<ArrowRight className="w-4 h-4" />
            </button>
          )}
        </span>
      </div>
      <LoadBanner />
      <AnimatePresence mode="wait">
        <motion.div key={step} className="flex-1 min-h-0 flex flex-col" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          {step === 0 && <StepLineups />}
          {step === 1 && <StepRivals />}
          {step === 2 && <StepBans />}
          {step === 3 && <Workbench />}
          {step === 4 && <StepCheatSheet />}
        </motion.div>
      </AnimatePresence>
      {intro.open && <Intro onClose={intro.close} />}
    </div>
  );
}

/** Below the lg breakpoint the full-screen workbench doesn't fit: phones get MobilePrep */
function usePhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const q = window.matchMedia('(max-width: 1023px)');
    const on = () => setPhone(q.matches);
    on(); q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return phone;
}

export default function P2Briefing() {
  const phone = usePhone();
  return <PrepFrame>{phone ? <MobilePrep /> : <Briefing />}</PrepFrame>;
}
