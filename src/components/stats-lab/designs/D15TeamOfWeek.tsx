'use client';

// #15 — Team of the week. The best player of each position (by average performance score in that
// week) stands in their lane on a stylised minimap. Pick a week below, or the whole tournament.
// Click a player for the bench of that position.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, Perf, PlayerX, TeamX } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { Avatar, C, HeroImg, LabTitle, LabView, TeamLogo, Tip, TipBody, WithModel, ink, mix, useHeaderFont, useSize, HeroRender, useFitCount } from '../kit';
import { count } from '@/lib/plural';

// Lane spots in the playable area of the 7.41 minimap (Radiant bottom-left, Dire top-right)
const ROLES = [
  { role: 'Carry', pos: 1, x: 74, y: 76, label: 'Carry' },
  { role: 'Hard Support', pos: 5, x: 50, y: 80, label: 'Hard support' },
  { role: 'Mid', pos: 2, x: 46, y: 47, label: 'Mid' },
  { role: 'Soft Support', pos: 4, x: 37, y: 16, label: 'Soft support' },
  { role: 'Offlane', pos: 3, x: 14, y: 29, label: 'Offlane' },
] as const;

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' });
function mondayOf(unix: number): string {
  const d = new Date(dayFmt.format(new Date(unix * 1000)) + 'T00:00:00Z');
  const wd = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - wd);
  return d.toISOString().slice(0, 10);
}
const fmtShort = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });

interface Entry { p: PlayerX; perfs: Perf[]; avg: number; best: Perf }

function rank(perfs: Perf[], minGames: number) {
  const by = new Map<string, Perf[]>();
  for (const p of perfs) if (p.player?.role && Number.isFinite(p.score)) { if (!by.has(p.pid)) by.set(p.pid, []); by.get(p.pid)!.push(p); }
  const out: Entry[] = [];
  for (const list of by.values()) {
    if (list.length < minGames) continue;
    const avg = list.reduce((acc, x) => acc + x.score, 0) / list.length;
    const best = [...list].sort((a, b) => b.score - a.score)[0];
    out.push({ p: list[0].player!, perfs: list, avg, best });
  }
  return out.sort((a, b) => b.avg - a.avg);
}

function Minimap() {
  // Dota 2 7.41 minimap (game asset via Liquipedia), stored locally
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/stats-lab/minimap-741.webp" alt="" draggable={false} className="absolute max-w-none select-none" style={{ left: '-6.4%', top: '-6.4%', width: '112.8%', height: '112.8%' }} />
  );
}

function TeamOfWeek({ model }: { model: Model }) {
  const font = useHeaderFont();
  const weeks = useMemo(() => {
    const m = new Map<string, Perf[]>();
    for (const p of model.perfs) { const k = mondayOf(p.game.start); if (!m.has(k)) m.set(k, []); m.get(k)!.push(p); }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [model]);
  const [wi, setWi] = useState(weeks.length - 1); // -1 = whole tournament
  const [focusRole, setFocusRole] = useState<string>('Carry');
  const all = wi < 0;
  const perfs = all ? model.perfs : weeks[wi][1];
  const ranked = useMemo(() => rank(perfs, all ? model.minGames : 1), [perfs, all, model.minGames]);
  const byRole = (role: string) => ranked.filter(e => e.p.role === role);
  const mvp = ranked[0];
  const games = new Set(perfs.map(p => p.game.idx)).size;
  const bestTeam = useMemo(() => {
    const rec = new Map<string, { t: TeamX; w: number; l: number }>();
    for (const g of new Set(perfs.map(p => p.game))) {
      for (const [t, won] of [[g.radiantTeam, g.radiantWin], [g.direTeam, !g.radiantWin]] as const) {
        if (!t) continue;
        const r = rec.get(t.id) ?? { t, w: 0, l: 0 }; won ? r.w++ : r.l++; rec.set(t.id, r);
      }
    }
    return [...rec.values()].sort((a, b) => b.w - a.w || a.l - b.l)[0];
  }, [perfs]);
  const [benchRef, benchN] = useFitCount<HTMLDivElement>(48, 6, 2);
  const bench = byRole(focusRole).slice(1, 1 + benchN);
  const key = all ? 'all' : weeks[wi][0];
  const [mapRef, map] = useSize<HTMLDivElement>();
  const av = Math.round(Math.max(44, Math.min(84, map.w * 0.12)));

  return (
    <>
      <LabTitle sub={<span>{all ? 'cały turniej' : `${fmtShort(weeks[wi][0])} – ${fmtShort(new Date(new Date(weeks[wi][0] + 'T12:00:00Z').getTime() + 6 * 864e5).toISOString().slice(0, 10))}`} · {count(games, 'gra', 'gry', 'gier')}</span>}>
        {all ? 'Drużyna turnieju' : 'Drużyna tygodnia'}
      </LabTitle>
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        {/* Minimap */}
        <div className="relative flex-[1.3] min-w-0 min-h-0 flex items-center justify-center">
          <div ref={mapRef} className="relative h-full aspect-square max-w-full rounded-3xl overflow-hidden" style={{ background: '#0c0f0d', border: `1px solid ${ink(10)}` }}>
            <Minimap />
            <div className="absolute inset-0 bg-black/25" />
            <AnimatePresence mode="popLayout">
              {ROLES.map((r, i) => {
                const e = byRole(r.role)[0];
                return (
                  <motion.div key={`${key}-${r.role}`} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                    style={{ left: `${r.x}%`, top: `${r.y}%` }}
                    initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={{ delay: i * 0.05, type: 'spring', stiffness: 260, damping: 22 }}>
                    {e ? (
                      <Tip content={<TipBody title={`${e.p.name} · poz. ${r.pos}`}>{count(e.perfs.length, 'gra', 'gry', 'gier')} · średnio {e.avg.toFixed(1)} pkt · najlepiej {heroName(e.best.heroId)} {e.best.kills}/{e.best.deaths}/{e.best.assists}</TipBody>}>
                        <button type="button" onClick={() => setFocusRole(r.role)} className="flex flex-col items-center">
                          <div className="relative">
                            <Avatar player={e.p} size={av} ring={focusRole === r.role ? C.secondary : 'rgba(255,255,255,0.7)'} />
                            <HeroImg heroId={e.best.heroId} variant="icon" className="absolute -bottom-1 -left-2 rounded-full" style={{ width: av * 0.36, height: av * 0.36, boxShadow: '0 0 0 2px #0c0f0d' }} />
                            <span className="absolute -top-1 -right-4 px-2 py-0.5 rounded-full text-sm font-bold text-black tabular-nums" style={{ background: e === mvp ? C.secondary : '#e8e8e8' }}>{e.avg.toFixed(1)}</span>
                          </div>
                          <span className="mt-1.5 px-2.5 py-0.5 rounded-md text-sm font-bold text-white bg-black/70 max-w-[150px] truncate">{e.p.name}</span>
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/80 bg-black/50 px-1.5 rounded mt-0.5">{r.label}</span>
                        </button>
                      </Tip>
                    ) : (
                      <div className="flex flex-col items-center opacity-40"><div className="w-14 h-14 rounded-full border border-dashed border-white/40" /><span className="text-[9px] uppercase tracking-widest text-white/60 mt-1">{r.label}</span></div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Side: MVP, best team, bench */}
        <div className="flex-1 min-w-[280px] max-w-[400px] hidden md:flex flex-col gap-3 min-h-0">
          {mvp && (
            <Tip content={<TipBody title="Najwyższa średnia punktów fantasy">{count(mvp.perfs.length, 'gra', 'gry', 'gier')} · {mvp.avg.toFixed(1)} pkt · najlepsza gra {mvp.best.score.toFixed(2)}</TipBody>}>
              <div className="relative rounded-2xl overflow-hidden h-28 cursor-help">
                <HeroImg heroId={mvp.best.heroId} title={false} className="absolute inset-0 w-full h-full scale-125 blur-xl opacity-60" />
                <div className="absolute top-1 bottom-0 right-2 w-[45%]"><HeroRender heroId={mvp.best.heroId} sizes="200px" /></div>
                <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, rgba(0,0,0,0.9), rgba(0,0,0,0.3)), linear-gradient(0deg, ${mix(C.secondary, 25)}, transparent)` }} />
                <div className="relative h-full flex items-center gap-3 px-4 text-white">
                  <Avatar player={mvp.p} size={64} ring={C.secondary} />
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: C.secondary }}>MVP</div>
                    <div className="text-xl font-logik-extended-bold uppercase truncate" style={font}>{mvp.p.name}</div>
                    <div className="text-xs opacity-70">{mvp.avg.toFixed(1)} pkt / grę</div>
                  </div>
                </div>
              </div>
            </Tip>
          )}
          {bestTeam && (
            <Tip content="Drużyna z najlepszym bilansem gier w tym okresie">
              <div className="flex items-center gap-3 rounded-2xl px-3 py-2 cursor-help" style={{ background: ink(4) }}>
                <TeamLogo team={bestTeam.t} size={36} />
                <div className="flex-1 min-w-0"><div className="text-[9px] uppercase tracking-[0.3em]" style={{ color: C.muted }}>Najlepsza drużyna</div><div className="font-bold truncate">{bestTeam.t.name}</div></div>
                <span className="text-lg font-logik-extended-bold tabular-nums" style={font}><span style={{ color: C.win }}>{bestTeam.w}</span>-<span style={{ color: C.loss }}>{bestTeam.l}</span></span>
              </div>
            </Tip>
          )}
          <div className="flex-1 min-h-0">
            <Tip content="Kolejni najlepsi na tej pozycji — kliknij gracza na mapie, by zmienić pozycję">
              <div className="text-sm font-logik-extended-bold uppercase inline-block cursor-help" style={{ color: C.heading, ...font }}>Ławka · {ROLES.find(r => r.role === focusRole)?.label}</div>
            </Tip>
            <div ref={benchRef} className="mt-2 h-[calc(100%-2rem)] flex flex-col gap-1.5">
              {bench.map((e, i) => (
                <div key={e.p.id} className="flex items-center gap-3 h-12 rounded-xl px-2.5" style={{ background: ink(4) }}>
                  <span className="w-5 text-sm font-bold tabular-nums" style={{ color: C.muted }}>{i + 2}</span>
                  <Avatar player={e.p} size={38} />
                  <div className="flex-1 min-w-0"><div className="truncate text-sm font-bold">{e.p.name}</div><div className="truncate text-[11px]" style={{ color: C.muted }}>{e.p.team?.name} · {count(e.perfs.length, 'gra', 'gry', 'gier')}</div></div>
                  <HeroImg heroId={e.best.heroId} className="w-12 h-7 rounded" />
                  <span className="w-12 text-right text-lg font-bold tabular-nums">{e.avg.toFixed(1)}</span>
                </div>
              ))}
              {!bench.length && <span className="text-xs" style={{ color: C.muted }}>Brak rezerwowych w tym okresie</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Week selector */}
      <div className="shrink-0 flex items-stretch gap-2 mt-3">
        <button type="button" onClick={() => setWi(-1)} className="rounded-xl px-4 text-xs font-bold uppercase tracking-widest"
          style={all ? { background: C.primary, color: '#fff', boxShadow: `0 0 16px ${mix(C.primary, 50)}` } : { background: ink(6) }}>Cały turniej</button>
        <button type="button" aria-label="Poprzedni tydzień" disabled={wi <= 0} onClick={() => setWi(w => Math.max(0, w - 1))} className="w-11 rounded-xl text-2xl disabled:opacity-25" style={{ background: ink(6) }}>‹</button>
        <div className="flex-1 min-w-0 flex gap-1.5">
          {weeks.map(([k, list], i) => {
            const n = new Set(list.map(p => p.game.idx)).size;
            const on = i === wi;
            return (
              <Tip key={k} content={`Tydzień od ${fmtShort(k)} · ${count(n, 'gra', 'gry', 'gier')}`}>
                <button type="button" onClick={() => setWi(i)} className="flex-1 min-w-0 rounded-xl py-1.5 flex flex-col items-center justify-center transition-all"
                  style={on ? { background: C.secondary, color: '#000', boxShadow: `0 0 16px ${mix(C.secondary, 50)}` } : { background: ink(5) }}>
                  <span className="text-[11px] font-bold whitespace-nowrap">{fmtShort(k)}</span>
                  <span className="text-[10px] tabular-nums" style={{ opacity: 0.7 }}>{count(n, 'gra', 'gry', 'gier')}</span>
                </button>
              </Tip>
            );
          })}
        </div>
        <button type="button" aria-label="Następny tydzień" disabled={all || wi >= weeks.length - 1} onClick={() => setWi(w => Math.min(weeks.length - 1, w + 1))} className="w-11 rounded-xl text-2xl disabled:opacity-25" style={{ background: ink(6) }}>›</button>
      </div>
    </>
  );
}

export default function D15TeamOfWeek() {
  return <LabView><WithModel>{m => <TeamOfWeek model={m} />}</WithModel></LabView>;
}
