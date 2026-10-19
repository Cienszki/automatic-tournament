'use client';

// #57 — Match centre. Every series as a score card (newest first); open one for the box score of
// each game like on Dotabuff: both lineups with heroes, K/D/A, farm, damage and performance
// points, the MVP marked, the draft on top and the game's key numbers.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { DsMatch } from '@/lib/stats-lab/types';
import type { GameX, Model, Perf, TeamX } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { fmtClock, fmtK } from '@/lib/stats-lab/metrics';
import { fmtDay } from '@/lib/stats-lab/season';
import { Avatar, C, HeroImg, LabTitle, LabView, TeamLogo, Tip, TipBody, WithModel, ink, mix, useFitCount, useHeaderFont, useSize } from '../kit';

interface Series { m: DsMatch; a?: TeamX; b?: TeamX; games: GameX[]; start: number }
const GOLD = '#f2c94c';

function BoxTable({ g, radiant }: { g: GameX; radiant: boolean }) {
  const team = radiant ? g.radiantTeam : g.direTeam;
  const won = radiant === g.radiantWin;
  const rows = g.perfs.filter(p => p.radiant === radiant).sort((a, b) => b.netWorth - a.netWorth);
  const head = 'grid grid-cols-[1fr_74px_70px_56px_72px_62px_56px] gap-2 items-center';
  const [ref, box] = useSize<HTMLDivElement>();
  const rowH = Math.min(52, (box.h - 4 * 4) / 5);
  const img = Math.max(18, Math.min(35, rowH - 4));
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-1.5 h-5 rounded-full" style={{ background: radiant ? C.radiant : C.dire }} />
        <TeamLogo team={team} size={26} />
        <span className="font-bold truncate" style={{ color: C.heading }}>{team?.name}</span>
        <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full font-bold" style={{ background: won ? mix(C.win, 25) : mix(C.loss, 20), color: won ? C.win : C.loss }}>{won ? 'wygrana' : 'porażka'}</span>
        <span className="ml-auto text-xs" style={{ color: C.muted }}>{radiant ? 'Radiant' : 'Dire'}</span>
      </div>
      <div className={`${head} px-2 text-[10px] uppercase tracking-widest`} style={{ color: C.muted }}>
        <span>Gracz</span><span className="text-center">K/D/A</span><span className="text-center">LH/DN</span><span className="text-right">GPM</span><span className="text-right">Obrażenia</span><span className="text-right">Netto</span>
        <Tip content="Punkty występu (jak w rankingu)"><span className="text-right cursor-help">Pkt</span></Tip>
      </div>
      <div ref={ref} className="flex-1 min-h-0 flex flex-col gap-1 mt-0.5">
        {rows.map((p: Perf) => {
          const mvp = g.mvp === p;
          return (
            <div key={p.idx} className={`${head} flex-1 min-h-0 max-h-[52px] rounded-lg px-2`} style={{ background: mvp ? mix(GOLD, 14) : ink(4), boxShadow: mvp ? `inset 0 0 0 1px ${mix(GOLD, 60)}` : undefined }}>
              <span className="flex items-center gap-2 min-w-0">
                <Tip content={heroName(p.heroId)}><span className="shrink-0"><HeroImg heroId={p.heroId} className="rounded" style={{ width: img * 1.78, height: img }} /></span></Tip>
                <Avatar player={p.player} size={Math.round(img * 0.86)} />
                <span className="truncate font-bold text-sm">{p.player?.name ?? 'anonim'}</span>
                {mvp && <span className="text-[9px] font-bold px-1.5 rounded text-black shrink-0" style={{ background: GOLD }}>MVP</span>}
              </span>
              <span className="text-center tabular-nums font-bold">{p.kills}<span style={{ color: C.muted }}>/</span>{p.deaths}<span style={{ color: C.muted }}>/</span>{p.assists}</span>
              <span className="text-center tabular-nums text-sm">{p.lastHits}<span style={{ color: C.muted }}>/{p.denies}</span></span>
              <span className="text-right tabular-nums text-sm">{p.gpm}</span>
              <span className="text-right tabular-nums text-sm">{fmtK(p.heroDamage)}</span>
              <span className="text-right tabular-nums text-sm" style={{ color: GOLD }}>{fmtK(p.netWorth)}</span>
              <span className="text-right tabular-nums font-bold">{Number.isFinite(p.score) ? p.score.toFixed(1) : '–'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MatchCenter({ model }: { model: Model }) {
  const font = useHeaderFont();
  const series = useMemo(() => {
    const by = new Map<string, GameX[]>();
    for (const g of model.games) { if (!by.has(g.matchId)) by.set(g.matchId, []); by.get(g.matchId)!.push(g); }
    return model.ds.matches.filter(m => by.has(m.id)).map(m => {
      const games = by.get(m.id)!.sort((a, b) => a.start - b.start);
      return { m, a: model.teamById.get(m.teamA), b: model.teamById.get(m.teamB), games, start: games[0].start } as Series;
    }).sort((x, y) => y.start - x.start);
  }, [model]);
  const [listRef, fit] = useFitCount<HTMLDivElement>(62, 6, 3);
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(series.length / fit));
  const pg = Math.min(page, pages - 1);
  const shown = series.slice(pg * fit, pg * fit + fit);
  const [selId, setSel] = useState<string | null>(null);
  const sel = series.find(s => s.m.id === selId) ?? series[0];
  const [gi, setGi] = useState(0);
  const g = sel?.games[Math.min(gi, (sel?.games.length ?? 1) - 1)];

  const bans = g ? g.pb.filter(x => !x[1]).sort((a, b) => a[3] - b[3]) : [];
  const picks = g ? g.pb.filter(x => x[1]).sort((a, b) => a[3] - b[3]) : [];

  return (
    <>
      <LabTitle sub={<span>{series.length} serii · {model.games.length} gier</span>}>Centrum meczowe</LabTitle>
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        {/* Series list */}
        <div className="w-[330px] shrink-0 flex flex-col min-h-0">
          <div ref={listRef} className="flex-1 min-h-0 flex flex-col gap-1.5">
            {shown.map(s => {
              const on = s.m.id === sel?.m.id;
              const aw = s.m.scoreA > s.m.scoreB; const bw = s.m.scoreB > s.m.scoreA;
              return (
                <button key={s.m.id} type="button" onClick={() => { setSel(s.m.id); setGi(0); }} className="h-[62px] shrink-0 rounded-xl px-3 flex items-center gap-2 text-left transition-all"
                  style={on ? { background: mix(C.primary, 40), boxShadow: `0 0 0 2px ${C.secondary}` } : { background: ink(5) }}>
                  <TeamLogo team={s.a} size={36} />
                  <span className="flex-1 min-w-0 text-sm font-bold truncate text-right" style={{ opacity: bw ? 0.55 : 1 }}>{s.a?.name}</span>
                  <span className="px-2 py-1 rounded-lg text-lg font-logik-extended-bold tabular-nums whitespace-nowrap" style={{ background: 'rgba(0,0,0,0.3)', color: C.heading, ...font }}>{s.m.scoreA}:{s.m.scoreB}</span>
                  <span className="flex-1 min-w-0 text-sm font-bold truncate" style={{ opacity: aw ? 0.55 : 1 }}>{s.b?.name}</span>
                  <TeamLogo team={s.b} size={36} />
                </button>
              );
            })}
          </div>
          {pages > 1 && (
            <div className="shrink-0 flex items-center justify-center gap-2 mt-2">
              <button type="button" disabled={pg === 0} onClick={() => setPage(pg - 1)} className="w-9 h-9 rounded-full text-lg disabled:opacity-25" style={{ background: ink(8) }}>‹</button>
              <span className="text-xs tabular-nums w-16 text-center" style={{ color: C.muted }}>{pg + 1} / {pages}</span>
              <button type="button" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)} className="w-9 h-9 rounded-full text-lg disabled:opacity-25" style={{ background: ink(8) }}>›</button>
            </div>
          )}
        </div>

        {/* Box score */}
        {sel && g && (
          <AnimatePresence mode="wait">
            <motion.div key={g.id} className="flex-1 min-w-0 flex flex-col gap-2.5 min-h-0" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <div className="shrink-0 flex items-center gap-4">
                <TeamLogo team={sel.a} size={58} />
                <div className="min-w-0">
                  <div className="text-2xl font-logik-extended-bold uppercase truncate" style={{ color: C.heading, ...font }}>{sel.a?.name} <span style={{ color: C.muted }}>{sel.m.scoreA}:{sel.m.scoreB}</span> {sel.b?.name}</div>
                  <div className="text-xs" style={{ color: C.muted }}>{fmtDay(sel.start)}{sel.m.isPlayoff ? ' · playoff' : sel.m.round ? ` · runda ${sel.m.round}` : ''}</div>
                </div>
                <TeamLogo team={sel.b} size={58} />
                <div className="ml-auto flex gap-1.5">
                  {sel.games.map((x, i) => {
                    const on = x === g; const winner = x.radiantWin ? x.radiantTeam : x.direTeam;
                    return (
                      <button key={x.id} type="button" onClick={() => setGi(i)} className="rounded-xl px-3 py-1.5 flex items-center gap-2 text-sm font-bold"
                        style={on ? { background: C.secondary, color: '#000', boxShadow: `0 0 14px ${mix(C.secondary, 50)}` } : { background: ink(6), color: C.text }}>
                        Gra {i + 1}<TeamLogo team={winner} size={20} />
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* key numbers + draft */}
              <div className="shrink-0 flex items-center gap-4 rounded-xl px-3 py-2" style={{ background: ink(4) }}>
                <div className="flex items-center gap-2"><span className="text-2xl font-logik-extended-bold tabular-nums" style={{ color: C.radiant, ...font }}>{g.radiantKills}</span><span className="text-xs" style={{ color: C.muted }}>:</span><span className="text-2xl font-logik-extended-bold tabular-nums" style={{ color: C.dire, ...font }}>{g.direKills}</span></div>
                <div className="text-sm" style={{ color: C.text }}><b>{fmtClock(g.duration)}</b> <span style={{ color: C.muted }}>czas</span></div>
                <Tip content="Różnica wartości netto drużyn na koniec gry"><div className="text-sm cursor-help" style={{ color: C.text }}><b>{fmtK(Math.abs(g.radiantNW - g.direNW))}</b> <span style={{ color: C.muted }}>przewagi netto</span></div></Tip>
                {g.firstBlood > 0 && <div className="text-sm" style={{ color: C.text }}><b>{fmtClock(g.firstBlood)}</b> <span style={{ color: C.muted }}>first blood</span></div>}
                {(picks.length > 0 || bans.length > 0) && (
                  <div className="ml-auto flex items-center gap-3">
                    <Tip content={<TipBody title="Bany">{bans.map(b => heroName(b[0])).join(', ')}</TipBody>}>
                      <div className="flex gap-0.5 cursor-help">{bans.slice(0, 14).map(b => <HeroImg key={`b${b[0]}`} heroId={b[0]} variant="icon" className="rounded-sm" style={{ width: 20, height: 20, filter: 'grayscale(1) brightness(0.6)', boxShadow: `0 -2px 0 ${b[2] === 0 ? C.radiant : C.dire} inset` }} />)}</div>
                    </Tip>
                  </div>
                )}
              </div>
              <BoxTable g={g} radiant />
              <BoxTable g={g} radiant={false} />
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </>
  );
}

export default function D57MatchCenter() {
  return <LabView><WithModel>{m => <MatchCenter model={m} />}</WithModel></LabView>;
}
