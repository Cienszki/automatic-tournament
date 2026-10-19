'use client';

// #76 — Top Trumps ("Asy"). The classic card game against the computer with player cards: pick the
// stat on your top card you think beats the opponent's; the higher value takes both cards (deaths:
// fewer wins). The winner of a round chooses next. Whoever holds every card — or more cards after
// 30 rounds — wins.

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, PlayerX } from '@/lib/stats-lab/derive';
import { pctRank } from '@/lib/stats-lab/derive';
import { metric, type MetricKey } from '@/lib/stats-lab/metrics';
import { qualified, seededRandom } from '@/lib/stats-lab/season';
import { Avatar, C, HeroImg, LabTitle, LabView, TeamLogo, Tip, WithModel, ink, mix, useHeaderFont, useSize } from '../kit';

const STATS: Array<{ key: MetricKey; label: string; low?: boolean }> = [
  { key: 'score', label: 'Punkty występu' }, { key: 'kda', label: 'KDA' }, { key: 'gpm', label: 'Złoto / min' },
  { key: 'hdpm', label: 'Obrażenia / min' }, { key: 'kp', label: 'Udział w zabójstwach' }, { key: 'deaths', label: 'Śmierci (mniej = lepiej)', low: true },
];
const DECK = 24;
const MAX_ROUNDS = 30;

interface Card { p: PlayerX; v: Record<string, number>; pr: Record<string, number> }

function Face({ c, w, h, pick, chosen, result, onPick }: { c: Card; w: number; h: number; pick: boolean; chosen: string | null; result?: 'win' | 'lose' | 'tie'; onPick?: (k: string) => void }) {
  const font = useHeaderFont();
  const s = h / 480;
  return (
    <div className="relative rounded-[22px] overflow-hidden flex flex-col text-white" style={{ width: w, height: h, background: 'linear-gradient(180deg, #1c1c26, #0b0b10)', boxShadow: `0 0 0 2px ${result === 'win' ? C.win : result === 'lose' ? C.loss : 'rgba(255,255,255,0.15)'}, 0 20px 50px rgba(0,0,0,0.5)` }}>
      <div className="relative flex items-center gap-3 p-3" style={{ background: `linear-gradient(135deg, ${mix(C.primary, 60)}, transparent)` }}>
        <Avatar player={c.p} size={Math.round(96 * s)} ring="#fff" />
        <div className="min-w-0">
          <div className="font-logik-extended-bold uppercase truncate" style={{ fontSize: 20 * s, ...font }}>{c.p.name}</div>
          <div className="flex items-center gap-1.5 text-xs text-white/70"><TeamLogo team={c.p.team} size={16} />{c.p.team?.name}</div>
          {c.p.heroes[0] && <HeroImg heroId={c.p.heroes[0].heroId} className="rounded mt-1.5" style={{ width: 56 * s, height: 32 * s }} />}
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-around p-2.5 gap-1">
        {STATS.map(st => {
          const m = metric(st.key); const on = chosen === st.key;
          const v = c.v[st.key];
          return (
            <button key={st.key} type="button" disabled={!pick} onClick={() => onPick?.(st.key)} className="flex items-center gap-2 rounded-lg px-2.5 text-left transition-all disabled:cursor-default"
              style={{ height: 40 * s, background: on ? mix(C.secondary, 40) : pick ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)', boxShadow: on ? `0 0 0 2px ${C.secondary}` : undefined }}>
              <span className="flex-1 text-sm">{st.label}</span>
              <span className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${c.pr[st.key] * 100}%`, background: C.secondary }} /></span>
              <span className="w-14 text-right font-bold tabular-nums" style={{ fontSize: 17 * s }}>{st.key === 'kp' ? m.fmt(v) : v.toFixed(st.key === 'kda' || st.key === 'score' || st.key === 'deaths' ? 1 : 0)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Back({ w, h, n }: { w: number; h: number; n: number }) {
  return (
    <div className="relative rounded-[22px] flex items-center justify-center" style={{ width: w, height: h, background: `repeating-linear-gradient(45deg, ${mix(C.primary, 50)} 0 12px, ${mix(C.primary, 30)} 12px 24px), #15151c`, boxShadow: '0 0 0 2px rgba(255,255,255,0.15), 0 20px 50px rgba(0,0,0,0.5)' }}>
      <span className="text-5xl font-logik-extended-bold text-white/80">?</span>
      <span className="absolute bottom-3 text-xs uppercase tracking-widest text-white/70">{n} kart</span>
    </div>
  );
}

function TopTrumps({ model }: { model: Model }) {
  const font = useHeaderFont();
  const pool = useMemo<Card[]>(() => {
    const q = qualified(model);
    const vals = Object.fromEntries(STATS.map(s => [s.key, q.map(p => p.agg[s.key].avg ?? 0)]));
    return q.map(p => {
      const v: Record<string, number> = {}; const pr: Record<string, number> = {};
      for (const s of STATS) { v[s.key] = p.agg[s.key].avg ?? 0; const r = pctRank(vals[s.key], v[s.key]); pr[s.key] = s.low ? 1 - r : r; }
      return { p, v, pr };
    });
  }, [model]);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const init = useMemo(() => {
    const r = seededRandom(seed);
    const deck = [...pool].sort(() => r() - 0.5).slice(0, Math.min(DECK, pool.length - (pool.length % 2)));
    return { me: deck.filter((_, i) => i % 2 === 0), cpu: deck.filter((_, i) => i % 2 === 1) };
  }, [pool, seed]);
  const [me, setMe] = useState<Card[]>(init.me);
  const [cpu, setCpu] = useState<Card[]>(init.cpu);
  const [pot, setPot] = useState<Card[]>([]);
  const [turn, setTurn] = useState<'me' | 'cpu'>('me');
  const [chosen, setChosen] = useState<string | null>(null);
  const [round, setRound] = useState(1);
  useEffect(() => { setMe(init.me); setCpu(init.cpu); setPot([]); setTurn('me'); setChosen(null); setRound(1); }, [init]);

  const done = !me.length || !cpu.length || round > MAX_ROUNDS;
  const a = me[0]; const b = cpu[0];
  const st = STATS.find(x => x.key === chosen);
  const outcome: 'win' | 'lose' | 'tie' | null = chosen && a && b && st ? (a.v[chosen] === b.v[chosen] ? 'tie' : (a.v[chosen] > b.v[chosen]) !== !!st.low ? 'win' : 'lose') : null;

  // computer chooses its strongest stat
  useEffect(() => {
    if (done || turn !== 'cpu' || chosen || !b) return;
    const t = setTimeout(() => setChosen([...STATS].sort((x, y) => b.pr[y.key] - b.pr[x.key])[0].key), 900);
    return () => clearTimeout(t);
  }, [turn, chosen, b, done]);

  const next = () => {
    if (!outcome || !a || !b) return;
    if (outcome === 'tie') { setPot(p => [...p, a, b]); setMe(m => m.slice(1)); setCpu(c => c.slice(1)); }
    else if (outcome === 'win') { setMe(m => [...m.slice(1), a, b, ...pot]); setCpu(c => c.slice(1)); setPot([]); setTurn('me'); }
    else { setCpu(c => [...c.slice(1), b, a, ...pot]); setMe(m => m.slice(1)); setPot([]); setTurn('cpu'); }
    setChosen(null); setRound(r => r + 1);
  };
  const [ref, box] = useSize<HTMLDivElement>();
  const h = Math.min(box.h - 6, 500); const w = h * 0.7;

  return (
    <>
      <LabTitle sub={<span>runda {Math.min(round, MAX_ROUNDS)} z {MAX_ROUNDS} · {turn === 'me' ? 'Ty wybierasz statystykę' : 'komputer wybiera'}</span>}
        right={<button type="button" onClick={() => setSeed(s => s + 7919)} className="rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest" style={{ background: ink(8), border: `1px solid ${ink(14)}`, color: C.text }}>Nowe rozdanie</button>}>Asy</LabTitle>
      <div ref={ref} className="flex-1 min-h-0 mt-3 flex items-center justify-center gap-8">
        {box.h > 0 && (done ? (
          <motion.div className="flex flex-col items-center gap-4 text-center" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <div className="text-6xl font-logik-extended-bold uppercase" style={{ color: me.length >= cpu.length ? C.win : C.loss, ...font }}>{me.length > cpu.length ? 'Wygrana!' : me.length < cpu.length ? 'Porażka' : 'Remis'}</div>
            <div className="text-2xl font-bold" style={{ color: C.heading }}>{me.length} : {cpu.length} kart</div>
            <button type="button" onClick={() => setSeed(s => s + 7919)} className="rounded-xl px-8 py-4 text-sm font-bold uppercase tracking-widest text-white" style={{ background: C.primary, boxShadow: `0 0 20px ${mix(C.primary, 50)}` }}>Zagraj jeszcze raz</button>
          </motion.div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-2">
              <div className="text-xs uppercase tracking-[0.3em]" style={{ color: C.muted }}>Ty · {me.length} kart</div>
              <AnimatePresence mode="wait">
                <motion.div key={a?.p.id} initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }}>
                  {a && <Face c={a} w={w} h={h} pick={turn === 'me' && !chosen} chosen={chosen} result={outcome ?? undefined} onPick={setChosen} />}
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="w-[200px] flex flex-col items-center gap-3 text-center">
              <div className="text-4xl font-logik-extended-bold" style={{ color: C.heading, ...font }}>VS</div>
              {outcome ? (
                <>
                  <div className="text-2xl font-bold" style={{ color: outcome === 'win' ? C.win : outcome === 'lose' ? C.loss : C.heading }}>{outcome === 'win' ? 'Bierzesz!' : outcome === 'lose' ? 'Tracisz kartę' : 'Remis — karty do puli'}</div>
                  <div className="text-sm" style={{ color: C.muted }}>{st?.label}</div>
                  <button type="button" onClick={next} className="rounded-xl px-8 py-3 text-sm font-bold uppercase tracking-widest text-white" style={{ background: C.primary, boxShadow: `0 0 18px ${mix(C.primary, 45)}` }}>Dalej</button>
                </>
              ) : <div className="text-sm" style={{ color: C.muted }}>{turn === 'me' ? 'Kliknij statystykę na swojej karcie' : 'Komputer się zastanawia…'}</div>}
              {pot.length > 0 && <Tip content="Karty z remisów — zabierze je zwycięzca następnej rundy"><div className="text-xs cursor-help" style={{ color: C.muted }}>w puli: {pot.length}</div></Tip>}
              {/* card count bar */}
              <div className="w-full h-3 rounded-full overflow-hidden flex mt-2" style={{ background: C.loss }}><motion.div className="h-full" style={{ background: C.win }} animate={{ width: `${(me.length / Math.max(1, me.length + cpu.length)) * 100}%` }} /></div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="text-xs uppercase tracking-[0.3em]" style={{ color: C.muted }}>Komputer · {cpu.length} kart</div>
              <AnimatePresence mode="wait">
                <motion.div key={(b?.p.id ?? '') + (chosen ? 'f' : 'b')} initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                  {b && (chosen ? <Face c={b} w={w} h={h} pick={false} chosen={chosen} result={outcome === 'win' ? 'lose' : outcome === 'lose' ? 'win' : outcome ?? undefined} /> : <Back w={w} h={h} n={cpu.length} />)}
                </motion.div>
              </AnimatePresence>
            </div>
          </>
        ))}
      </div>
    </>
  );
}

export default function D76TopTrumps() {
  return <LabView><WithModel>{m => <TopTrumps model={m} />}</WithModel></LabView>;
}
