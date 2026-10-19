'use client';

// #81 — Speedrun. Leaderboards like on a speedrun site: categories along the top — the fastest win
// ("Any%"), the fastest win on each side, the fastest first blood — and "per hero", the fastest
// win played on a chosen hero. The league record gets the big card with its runners; every row
// shows the time, the date and who carried it.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { GameX, Model, Perf, TeamX } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { fmtClock } from '@/lib/stats-lab/metrics';
import { fmtDay } from '@/lib/stats-lab/season';
import { Avatar, C, HeroImg, HeroRender, LabTitle, LabView, TeamLogo, Tip, TipBody, WithModel, ink, mix, useFitCount, useHeaderFont } from '../kit';

type Cat = 'any' | 'radiant' | 'dire' | 'fb' | 'hero';
interface Run { id: string; time: number; team?: TeamX; runners: Perf[]; game: GameX; star?: Perf }
const MEDAL = ['#f2c94c', '#c9d1db', '#c98a55'];

function Speedrun({ model }: { model: Model }) {
  const font = useHeaderFont();
  const [cat, setCat] = useState<Cat>('any');
  const heroes = useMemo(() => model.heroes.filter(h => h.wins > 0).sort((a, b) => b.wins - a.wins).slice(0, 18), [model]);
  const [hero, setHero] = useState<number>(heroes[0]?.heroId ?? 0);
  const runs: Run[] = useMemo(() => {
    const win = (g: GameX, radiant: boolean): Run => {
      const runners = g.perfs.filter(p => p.radiant === radiant);
      return { id: g.id + radiant, time: g.duration, team: radiant ? g.radiantTeam : g.direTeam, runners, game: g, star: [...runners].sort((a, b) => (b.score || 0) - (a.score || 0))[0] };
    };
    if (cat === 'fb') return model.games.filter(g => g.fbPerf && g.firstBlood > 0).map(g => ({ id: g.id, time: g.firstBlood, team: g.fbPerf!.team, runners: [g.fbPerf!], game: g, star: g.fbPerf! })).sort((a, b) => a.time - b.time);
    if (cat === 'hero') return model.perfs.filter(p => p.heroId === hero && p.win).map(p => ({ ...win(p.game, p.radiant), id: `${p.idx}`, star: p })).sort((a, b) => a.time - b.time);
    return model.games.filter(g => cat === 'any' || (cat === 'radiant') === g.radiantWin).map(g => win(g, g.radiantWin)).sort((a, b) => a.time - b.time);
  }, [model, cat, hero]);
  const wr = runs[0];
  const [ref, fit] = useFitCount<HTMLDivElement>(50, 4, 3);
  const CATS: Array<{ k: Cat; label: string; tip: string }> = [
    { k: 'any', label: 'Any%', tip: 'Najszybsza wygrana gra' },
    { k: 'radiant', label: 'Radiant%', tip: 'Najszybsza wygrana po stronie Radiant' },
    { k: 'dire', label: 'Dire%', tip: 'Najszybsza wygrana po stronie Dire' },
    { k: 'fb', label: 'First blood%', tip: 'Najszybsza pierwsza krew (gry z pełną analizą powtórki)' },
    { k: 'hero', label: 'Na bohaterze', tip: 'Najszybsza wygrana z wybranym bohaterem w składzie' },
  ];

  return (
    <>
      <LabTitle sub={<span>rekordy czasowe ligi · kategoria = zasady biegu</span>}>Speedrun</LabTitle>
      <div className="shrink-0 flex gap-1.5 mt-3">
        {CATS.map(c => (
          <Tip key={c.k} content={c.tip}>
            <button type="button" onClick={() => setCat(c.k)} className="rounded-xl px-5 py-2.5 text-sm font-bold"
              style={cat === c.k ? { background: C.primary, color: '#fff', boxShadow: `0 0 16px ${mix(C.primary, 45)}` } : { background: ink(6), color: C.text }}>{c.label}</button>
          </Tip>
        ))}
        {cat === 'hero' && (
          <div className="flex gap-1 ml-3 items-center">
            {heroes.map(h => (
              <Tip key={h.heroId} content={`${heroName(h.heroId)} · ${h.wins} wygranych`}>
                <button type="button" onClick={() => setHero(h.heroId)} className="rounded-md overflow-hidden" style={{ boxShadow: hero === h.heroId ? `0 0 0 2px ${C.secondary}` : undefined, opacity: hero === h.heroId ? 1 : 0.6 }}>
                  <HeroImg heroId={h.heroId} variant="icon" style={{ width: 34, height: 34 }} className="bg-black/40" />
                </button>
              </Tip>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        {/* world record */}
        <AnimatePresence mode="wait">
          {wr && (
            <motion.div key={`${cat}${hero}`} className="w-[40%] shrink-0 relative rounded-3xl overflow-hidden text-white" style={{ background: '#0b0b10' }} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              {wr.star && <HeroImg heroId={wr.star.heroId} title={false} className="absolute inset-0 w-full h-full scale-125 blur-2xl opacity-50" />}
              {wr.star && <div className="absolute top-[6%] bottom-[38%] inset-x-0"><HeroRender heroId={wr.star.heroId} sizes="40vw" /></div>}
              <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.95), rgba(0,0,0,0.25) 60%, transparent)' }} />
              <div className="absolute top-4 left-4 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.3em] text-black" style={{ background: MEDAL[0] }}>Rekord ligi</div>
              <div className="absolute inset-x-0 bottom-0 p-5 flex flex-col gap-2">
                <div className="font-logik-extended-bold tabular-nums leading-none" style={{ fontSize: 'clamp(56px, 10vh, 96px)', ...font }}>{fmtClock(wr.time)}</div>
                <div className="flex items-center gap-2"><TeamLogo team={wr.team} size={32} /><span className="text-xl font-bold">{wr.team?.name}</span></div>
                <div className="flex -space-x-2">{wr.runners.map(p => <Tip key={p.idx} content={`${p.player?.name ?? '?'} · ${heroName(p.heroId)}`}><span><Avatar player={p.player} size={44} ring="rgba(0,0,0,0.7)" /></span></Tip>)}</div>
                <div className="text-xs text-white/70">{fmtDay(wr.game.start)} · vs {(wr.game.radiant === wr.team?.id ? wr.game.direTeam : wr.game.radiantTeam)?.name}{runs[1] ? ` · ${fmtClock(runs[1].time - wr.time)} przed drugim miejscem` : ''}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* leaderboard */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <div className="shrink-0 grid grid-cols-[46px_1fr_92px_70px_60px] gap-3 px-3 pb-1 text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>
            <span>Miejsce</span><span>{cat === 'fb' ? 'Gracz' : 'Drużyna'}</span><span className="text-right">Czas</span><span className="text-right">Data</span><span className="text-right">{cat === 'fb' ? 'Bohater' : 'MVP'}</span>
          </div>
          <div ref={ref} className="flex-1 min-h-0 flex flex-col gap-1">
            {runs.slice(0, fit).map((r, i) => (
              <motion.div key={r.id} className="h-[50px] shrink-0 grid grid-cols-[46px_1fr_92px_70px_60px] gap-3 items-center rounded-xl px-3" style={{ background: i < 3 ? mix(MEDAL[i], 12) : ink(4) }}
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}>
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: i < 3 ? MEDAL[i] : ink(10), color: i < 3 ? '#000' : C.heading }}>{i + 1}</span>
                <span className="flex items-center gap-2 min-w-0">
                  {cat === 'fb' ? <><Avatar player={r.star?.player} size={32} /><span className="truncate font-bold">{r.star?.player?.name ?? '?'}</span></> : <><TeamLogo team={r.team} size={30} /><span className="truncate font-bold">{r.team?.name}</span></>}
                </span>
                <span className="text-right text-lg font-bold tabular-nums" style={{ color: C.heading }}>{fmtClock(r.time)}</span>
                <span className="text-right text-xs" style={{ color: C.muted }}>{fmtDay(r.game.start)}</span>
                <span className="flex justify-end">{r.star && <Tip content={<TipBody title={r.star.player?.name ?? '?'}>{heroName(r.star.heroId)} · {r.star.kills}/{r.star.deaths}/{r.star.assists}</TipBody>}><span><HeroImg heroId={r.star.heroId} className="rounded" style={{ width: 54, height: 30 }} /></span></Tip>}</span>
              </motion.div>
            ))}
            {!runs.length && <div className="text-sm" style={{ color: C.muted }}>Brak przebiegów w tej kategorii.</div>}
          </div>
        </div>
      </div>
    </>
  );
}

export default function D81Speedrun() {
  return <LabView><WithModel>{m => <Speedrun model={m} />}</WithModel></LabView>;
}
