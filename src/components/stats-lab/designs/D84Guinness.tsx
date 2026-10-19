'use client';

// #84 — Book of records. An open book, one record per spread: the left page is the official
// certificate (holder, value, game, date, seal), the right page the record's history — every time
// it was broken, oldest first — and the challengers closest to it. Turn the pages with the arrows,
// ← → or the index tabs.

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, Perf } from '@/lib/stats-lab/derive';
import { opponentOf, topPerfs } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { metric, type MetricKey } from '@/lib/stats-lab/metrics';
import { fmtDay } from '@/lib/stats-lab/season';
import { Avatar, C, HeroImg, HeroRender, LabTitle, LabView, TeamLogo, Tip, WithModel, ink, mix, useHeaderFont } from '../kit';

const KEYS: Array<{ key: MetricKey; title: string }> = [
  { key: 'kills', title: 'Najwięcej zabójstw w jednej grze' },
  { key: 'assists', title: 'Najwięcej asyst w jednej grze' },
  { key: 'kda', title: 'Najwyższe KDA w jednej grze' },
  { key: 'gpm', title: 'Najwięcej złota na minutę' },
  { key: 'xpm', title: 'Najwięcej doświadczenia na minutę' },
  { key: 'lastHits', title: 'Najwięcej last hitów' },
  { key: 'heroDamage', title: 'Najwięcej obrażeń bohaterom' },
  { key: 'towerDamage', title: 'Najwięcej obrażeń budynkom' },
  { key: 'heroHealing', title: 'Najwięcej wyleczonego zdrowia' },
  { key: 'wards', title: 'Najwięcej postawionych wardów' },
  { key: 'stacks', title: 'Najwięcej zestackowanych obozów' },
  { key: 'score', title: 'Najwyższa ocena występu' },
];
const PAPER = '#f3ead2'; const INK = '#2a2118'; const GOLD = '#b8892a';

/** Successive record holders, chronologically */
function progression(model: Model, key: MetricKey): Perf[] {
  const m = metric(key); const out: Perf[] = [];
  const list = model.perfs.filter(p => p.player && (!m.parsedOnly || p.parsed) && Number.isFinite(m.get(p))).sort((a, b) => a.game.start - b.game.start);
  for (const p of list) if (!out.length || m.get(p) > m.get(out[out.length - 1])) out.push(p);
  return out;
}

function Guinness({ model }: { model: Model }) {
  const font = useHeaderFont();
  const recs = useMemo(() => KEYS.map(k => ({ ...k, m: metric(k.key), top: topPerfs(model, k.key, 5), prog: progression(model, k.key) })).filter(r => r.top.length), [model]);
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const go = (d: number) => { setDir(d); setI(x => (x + d + recs.length) % recs.length); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });
  const r = recs[i];
  if (!r) return <LabTitle>Księga rekordów</LabTitle>;
  const rec = r.top[0];

  return (
    <>
      <LabTitle sub={<span>rekord {i + 1} z {recs.length} · przewracaj strony strzałkami</span>}>Księga rekordów</LabTitle>
      <div className="flex-1 min-h-0 flex items-center gap-3 mt-3">
        <button type="button" aria-label="Poprzedni rekord" onClick={() => go(-1)} className="w-12 h-12 shrink-0 rounded-full text-2xl" style={{ background: ink(8) }}>‹</button>
        <div className="relative flex-1 min-w-0 h-full" style={{ perspective: 2200 }}>
          <AnimatePresence mode="wait">
            <motion.div key={r.key} className="absolute inset-0 flex rounded-xl overflow-hidden" style={{ boxShadow: '0 30px 70px rgba(0,0,0,0.55), 0 0 0 10px #5a1f1f', transformOrigin: dir > 0 ? 'left center' : 'right center', color: INK }}
              initial={{ rotateY: dir > 0 ? 20 : -20, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} exit={{ rotateY: dir > 0 ? -20 : 20, opacity: 0 }} transition={{ duration: 0.35 }}>
              {/* certificate */}
              <div className="w-1/2 relative p-6 flex flex-col items-center text-center" style={{ background: `linear-gradient(90deg, ${PAPER} 90%, #d8cba8)` }}>
                <div className="absolute inset-4 border-[3px] border-double pointer-events-none" style={{ borderColor: GOLD }} />
                <div className="text-[10px] uppercase tracking-[0.45em]" style={{ color: GOLD }}>Oficjalny rekord ligi</div>
                <div className="text-2xl font-logik-extended-bold uppercase leading-tight mt-1 px-6" style={font}>{r.title}</div>
                <div className="relative flex-1 min-h-0 w-full flex items-center justify-center gap-5 my-2">
                  <div className="relative h-full aspect-[0.8]"><HeroRender heroId={rec.heroId} sizes="260px" /></div>
                  <div className="flex flex-col items-center gap-2">
                    <Avatar player={rec.player} size={96} ring={GOLD} />
                    <div className="text-xl font-bold">{rec.player?.name}</div>
                    <div className="flex items-center gap-1.5 text-xs opacity-75"><TeamLogo team={rec.team} size={16} />{rec.team?.name}</div>
                  </div>
                </div>
                <div className="font-logik-extended-bold tabular-nums leading-none" style={{ fontSize: 'clamp(44px, 8vh, 80px)', color: '#7a1d1d', ...font }}>{r.m.fmt(r.m.get(rec))}</div>
                <div className="text-xs mt-1 opacity-80">{heroName(rec.heroId)} · vs {opponentOf(rec)?.name} · {fmtDay(rec.game.start)} · {rec.win ? 'wygrana' : 'porażka'}</div>
                {/* seal */}
                <div className="absolute bottom-7 right-8 w-[74px] h-[74px] rounded-full flex items-center justify-center text-center -rotate-12" style={{ background: `radial-gradient(circle at 35% 30%, #f6d77c, ${GOLD} 60%, #7a5a14)`, boxShadow: '0 4px 10px rgba(0,0,0,0.35)' }}>
                  <span className="text-[9px] font-bold uppercase leading-tight tracking-wider text-[#3a2a08]">Rekord<br />potwierdzony</span>
                </div>
              </div>
              {/* history */}
              <div className="w-1/2 p-6 flex flex-col gap-3" style={{ background: `linear-gradient(90deg, #d8cba8, ${PAPER} 10%)` }}>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.35em] mb-2" style={{ color: GOLD }}>Historia rekordu</div>
                  <div className="flex flex-col gap-1">
                    {r.prog.slice(-6).map((p, k, arr) => {
                      const prev = k > 0 ? arr[k - 1] : null;
                      const last = k === arr.length - 1;
                      return (
                        <div key={p.idx} className="flex items-center gap-2.5 rounded-lg px-2 py-1" style={{ background: last ? mix(GOLD, 22) : 'transparent' }}>
                          <span className="w-14 text-[11px] opacity-70">{fmtDay(p.game.start)}</span>
                          <Avatar player={p.player} size={30} />
                          <span className="flex-1 min-w-0 truncate font-bold text-sm">{p.player?.name}</span>
                          <HeroImg heroId={p.heroId} className="rounded" style={{ width: 40, height: 23 }} />
                          <span className="w-16 text-right font-bold tabular-nums">{r.m.fmt(r.m.get(p))}</span>
                          <span className="w-12 text-right text-[11px] tabular-nums" style={{ color: '#2c7a3f' }}>{prev ? `+${r.m.fmt(r.m.get(p) - r.m.get(prev))}` : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-auto">
                  <div className="text-[10px] uppercase tracking-[0.35em] mb-2" style={{ color: GOLD }}>Najbliżej pobicia</div>
                  <div className="flex flex-col gap-1">
                    {r.top.slice(1, 5).map((p, k) => (
                      <div key={p.idx} className="flex items-center gap-2.5">
                        <span className="w-5 text-sm font-bold opacity-60">{k + 2}.</span>
                        <Avatar player={p.player} size={30} />
                        <span className="flex-1 min-w-0 truncate text-sm font-bold">{p.player?.name}</span>
                        <span className="w-28 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(42,33,24,0.12)' }}><span className="block h-full rounded-full" style={{ width: `${(r.m.get(p) / r.m.get(rec)) * 100}%`, background: GOLD }} /></span>
                        <span className="w-16 text-right font-bold tabular-nums text-sm">{r.m.fmt(r.m.get(p))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
        <button type="button" aria-label="Następny rekord" onClick={() => go(1)} className="w-12 h-12 shrink-0 rounded-full text-2xl" style={{ background: ink(8) }}>›</button>
      </div>
      {/* index tabs */}
      <div className="shrink-0 flex justify-center gap-1.5 mt-4">
        {recs.map((x, k) => (
          <Tip key={x.key} content={`${x.title} · ${x.top[0].player?.name}`}>
            <button type="button" onClick={() => { setDir(k > i ? 1 : -1); setI(k); }} className="rounded-t-lg px-2.5 pt-1.5 pb-1 flex items-center gap-1.5 transition-all"
              style={{ background: k === i ? '#5a1f1f' : ink(6), color: k === i ? '#f3ead2' : C.text, transform: k === i ? 'translateY(-3px)' : undefined }}>
              <Avatar player={x.top[0].player} size={22} /><span className="text-[11px] font-bold whitespace-nowrap">{x.m.short}</span>
            </button>
          </Tip>
        ))}
      </div>
    </>
  );
}

export default function D84Guinness() {
  return <LabView><WithModel>{m => <Guinness model={m} />}</WithModel></LabView>;
}
