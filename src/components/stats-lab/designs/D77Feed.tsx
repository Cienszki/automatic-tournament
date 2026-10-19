'use client';

// #77 — Training log. Like Strava: a player's games as activities, newest first, each with its
// numbers and badges for personal bests ("PR") and season records. Next to the feed: their personal
// records per stat and a weekly bar chart of games and points. Pick a player on the left.

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, Perf } from '@/lib/stats-lab/derive';
import { opponentOf, topPerfs } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { fmtClock, metric, type MetricKey } from '@/lib/stats-lab/metrics';
import { fmtDay, fmtShort, mondayOf } from '@/lib/stats-lab/season';
import { Avatar, C, HeroImg, HeroRender, LabTitle, LabView, Tip, TipBody, WithModel, ink, mix, useFitCount, useHeaderFont } from '../kit';
import { PlayerPicker, usePlayerPick } from '../picker';

const PR_KEYS: MetricKey[] = ['kills', 'assists', 'kda', 'gpm', 'xpm', 'lastHits', 'heroDamage', 'wards', 'score'];
const ORANGE = '#fc5200';

function Feed({ model }: { model: Model }) {
  const font = useHeaderFont();
  const pick = usePlayerPick(model);
  const p = pick.player;
  const records = useMemo(() => new Set(PR_KEYS.map(k => topPerfs(model, k, 1)[0]).filter(Boolean).map(x => `${x.idx}`)), [model]);
  const recordKey = useMemo(() => { const m = new Map<number, MetricKey[]>(); for (const k of PR_KEYS) { const r = topPerfs(model, k, 1)[0]; if (r) m.set(r.idx, [...(m.get(r.idx) ?? []), k]); } return m; }, [model]);
  // personal bests and the games where a new PR was set (chronologically)
  const { prs, prGames } = useMemo(() => {
    const prs = new Map<MetricKey, Perf>(); const prGames = new Map<number, MetricKey[]>();
    for (const x of p?.perfs ?? []) for (const k of PR_KEYS) {
      const m = metric(k); if (m.parsedOnly && !x.parsed) continue; const v = m.get(x); if (!Number.isFinite(v)) continue;
      const cur = prs.get(k);
      if (!cur || v > m.get(cur)) { prs.set(k, x); if (cur) prGames.set(x.idx, [...(prGames.get(x.idx) ?? []), k]); }
    }
    return { prs, prGames };
  }, [p]);
  const feed = useMemo(() => [...(p?.perfs ?? [])].reverse(), [p]);
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [p?.id]);
  const [feedRef, fit] = useFitCount<HTMLDivElement>(132, 10, 1);
  const pages = Math.max(1, Math.ceil(feed.length / fit));
  const pg = Math.min(page, pages - 1);
  const weeks = useMemo(() => {
    const m = new Map<string, { n: number; pts: number }>();
    for (const x of p?.perfs ?? []) { const k = mondayOf(x.game.start); const r = m.get(k) ?? { n: 0, pts: 0 }; r.n++; if (Number.isFinite(x.score)) r.pts += x.score; m.set(k, r); }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-10);
  }, [p]);
  const maxPts = Math.max(1, ...weeks.map(w => w[1].pts));

  return (
    <>
      <LabTitle sub={<span>gry jako aktywności · PR = rekord osobisty</span>}>Dziennik</LabTitle>
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        <PlayerPicker pick={pick} className="w-[26%] shrink-0" size={50} cols={4} teamSize={30} teamRows={4} />
        {/* feed */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <div ref={feedRef} className="flex-1 min-h-0 flex flex-col gap-2.5">
            <AnimatePresence mode="popLayout" initial={false}>
              {p && feed.slice(pg * fit, pg * fit + fit).map(x => {
                const prsHere = prGames.get(x.idx) ?? []; const rec = recordKey.get(x.idx) ?? [];
                return (
                  <motion.div key={x.idx} layout className="h-[132px] shrink-0 rounded-2xl p-3 flex gap-3" style={{ background: ink(4), border: `1px solid ${ink(8)}` }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <div className="relative w-[150px] shrink-0 rounded-xl overflow-hidden" style={{ background: '#0b0b10' }}>
                      <HeroImg heroId={x.heroId} title={false} className="absolute inset-0 w-full h-full scale-125 blur-lg opacity-50" />
                      <HeroRender heroId={x.heroId} sizes="150px" />
                      <span className="absolute top-1.5 left-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: x.win ? C.win : C.loss }}>{x.win ? 'W' : 'P'}</span>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <div className="flex items-center gap-2 text-xs" style={{ color: C.muted }}><Avatar player={p} size={20} />{p.name} · {fmtDay(x.game.start)}</div>
                      <div className="text-lg font-bold truncate" style={{ color: C.heading }}>{x.win ? 'Wygrana' : 'Porażka'} na {heroName(x.heroId)} vs {opponentOf(x)?.name ?? '?'}</div>
                      <div className="flex gap-6 mt-1">
                        {[['Czas', fmtClock(x.game.duration)], ['K/D/A', `${x.kills}/${x.deaths}/${x.assists}`], ['GPM', x.gpm], ['Punkty', Number.isFinite(x.score) ? x.score.toFixed(1) : '–']].map(([l, v]) => (
                          <div key={l as string}><div className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>{l}</div><div className="text-xl font-bold tabular-nums" style={{ color: C.heading }}>{v}</div></div>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-auto">
                        {rec.map(k => <Tip key={`r${k}`} content="Rekord całego sezonu"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-black cursor-help" style={{ background: '#f2c94c' }}>Rekord sezonu · {metric(k).label}</span></Tip>)}
                        {prsHere.map(k => <Tip key={k} content="Nowy rekord osobisty w chwili tej gry"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white cursor-help" style={{ background: ORANGE }}>PR · {metric(k).label}</span></Tip>)}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
          {pages > 1 && (
            <div className="shrink-0 flex items-center justify-center gap-2 mt-2">
              <button type="button" disabled={pg === 0} onClick={() => setPage(pg - 1)} className="w-9 h-9 rounded-full text-lg disabled:opacity-25" style={{ background: ink(8) }}>‹</button>
              <span className="text-xs tabular-nums w-24 text-center" style={{ color: C.muted }}>{pg === 0 ? 'najnowsze' : `${pg * fit + 1}–${Math.min(feed.length, (pg + 1) * fit)} z ${feed.length}`}</span>
              <button type="button" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)} className="w-9 h-9 rounded-full text-lg disabled:opacity-25" style={{ background: ink(8) }}>›</button>
            </div>
          )}
        </div>
        {/* PRs + weekly */}
        <div className="w-[270px] shrink-0 flex flex-col gap-3 min-h-0">
          <div className="rounded-2xl p-3" style={{ background: ink(4) }}>
            <div className="text-[10px] uppercase tracking-[0.3em] mb-1.5" style={{ color: ORANGE }}>Rekordy osobiste</div>
            <div className="flex flex-col gap-1">
              {PR_KEYS.map(k => { const x = prs.get(k); if (!x) return null; const m = metric(k); const season = records.has(`${x.idx}`) && recordKey.get(x.idx)?.includes(k);
                return (
                  <Tip key={k} content={<TipBody title={m.label}>{heroName(x.heroId)} · {fmtDay(x.game.start)}</TipBody>}>
                    <div className="flex items-center justify-between text-sm cursor-help"><span style={{ color: C.text }}>{m.label}</span><span className="font-bold tabular-nums" style={{ color: season ? '#f2c94c' : C.heading }}>{m.fmt(m.get(x))}</span></div>
                  </Tip>
                ); })}
            </div>
          </div>
          <div className="flex-1 min-h-0 rounded-2xl p-3 flex flex-col" style={{ background: ink(4) }}>
            <div className="text-[10px] uppercase tracking-[0.3em] mb-1.5" style={{ color: C.muted }}>Tygodnie · punkty</div>
            <div className="flex-1 min-h-0 flex items-end gap-1">
              {weeks.map(([k, w]) => (
                <Tip key={k} content={`${fmtShort(k)} · ${w.n} gier · ${w.pts.toFixed(0)} pkt`}>
                  <div className="flex-1 flex flex-col items-center gap-1 h-full justify-end cursor-help">
                    <span className="text-[10px] font-bold tabular-nums" style={{ color: C.heading }}>{w.n}</span>
                    <motion.span className="w-full rounded-t" style={{ background: mix(ORANGE, 85) }} initial={{ height: 0 }} animate={{ height: `${(w.pts / maxPts) * 80}%` }} />
                    <span className="text-[9px]" style={{ color: C.muted }}>{fmtShort(k).split(' ')[0]}</span>
                  </div>
                </Tip>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function D77Feed() {
  return <LabView><WithModel>{m => <Feed model={m} />}</WithModel></LabView>;
}
