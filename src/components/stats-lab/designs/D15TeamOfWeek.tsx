'use client';

// #15 — Team of the week. The best player of each position (by average fantasy points in that
// week) stands in their lane on a stylised minimap. Pick a week below, or the whole tournament.
// Click a player for the bench of that position.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, Perf, PlayerX, TeamX } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { Avatar, C, HeroImg, LabTitle, LabView, TeamLogo, Tip, TipBody, WithModel, ink, mix, useHeaderFont, useSize } from '../kit';

const ROLES = [
  { role: 'Carry', pos: 1, x: 76, y: 78, label: 'Carry' },
  { role: 'Hard Support', pos: 5, x: 48, y: 74, label: 'Hard support' },
  { role: 'Mid', pos: 2, x: 56, y: 47, label: 'Mid' },
  { role: 'Soft Support', pos: 4, x: 27, y: 42, label: 'Soft support' },
  { role: 'Offlane', pos: 3, x: 22, y: 15, label: 'Offlane' },
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
  for (const p of perfs) if (p.player?.role) { if (!by.has(p.pid)) by.set(p.pid, []); by.get(p.pid)!.push(p); }
  const out: Entry[] = [];
  for (const list of by.values()) {
    if (list.length < minGames) continue;
    const avg = list.reduce((s, x) => s + x.fantasyPoints, 0) / list.length;
    const best = [...list].sort((a, b) => b.fantasyPoints - a.fantasyPoints)[0];
    out.push({ p: list[0].player!, perfs: list, avg, best });
  }
  return out.sort((a, b) => b.avg - a.avg);
}

function Lanes() {
  // Stylised minimap: base corners, three lanes, river
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
      <defs>
        <linearGradient id="tow-river" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5fb3e0" stopOpacity="0" /><stop offset="0.5" stopColor="#5fb3e0" stopOpacity="0.35" /><stop offset="1" stopColor="#5fb3e0" stopOpacity="0" /></linearGradient>
      </defs>
      <path d="M0,100 L0,0 L100,0 Z" fill="rgba(212,81,59,0.07)" />
      <path d="M0,100 L100,100 L100,0 Z" fill="rgba(92,184,92,0.07)" />
      <path d="M0,35 L65,100" stroke="url(#tow-river)" strokeWidth="9" fill="none" />
      <g stroke="rgba(255,255,255,0.13)" strokeWidth="3.2" fill="none" strokeLinecap="round">
        <path d="M8,92 L8,8 L92,8" />
        <path d="M8,92 L92,8" />
        <path d="M8,92 L92,92 L92,8" />
      </g>
      <circle cx="8" cy="92" r="5" fill="rgba(92,184,92,0.5)" />
      <circle cx="92" cy="8" r="5" fill="rgba(212,81,59,0.5)" />
    </svg>
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
  const bench = byRole(focusRole).slice(1, 6);
  const key = all ? 'all' : weeks[wi][0];
  const [mapRef, map] = useSize<HTMLDivElement>();
  const av = Math.round(Math.max(34, Math.min(64, map.w * 0.11)));

  return (
    <>
      <LabTitle sub={<span>{all ? 'cały turniej' : `${fmtShort(weeks[wi][0])} – ${fmtShort(new Date(new Date(weeks[wi][0] + 'T12:00:00Z').getTime() + 6 * 864e5).toISOString().slice(0, 10))}`} · {games} gier</span>}>
        {all ? 'Drużyna turnieju' : 'Drużyna tygodnia'}
      </LabTitle>
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        {/* Minimap */}
        <div className="relative flex-[1.3] min-w-0 min-h-0 flex items-center justify-center">
          <div ref={mapRef} className="relative h-full aspect-square max-w-full rounded-3xl overflow-hidden" style={{ background: 'radial-gradient(circle at 50% 50%, #1a2119, #0c0f0d)', border: `1px solid ${ink(10)}` }}>
            <Lanes />
            <AnimatePresence mode="popLayout">
              {ROLES.map((r, i) => {
                const e = byRole(r.role)[0];
                return (
                  <motion.div key={`${key}-${r.role}`} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                    style={{ left: `${r.x}%`, top: `${r.y}%` }}
                    initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={{ delay: i * 0.05, type: 'spring', stiffness: 260, damping: 22 }}>
                    {e ? (
                      <Tip content={<TipBody title={`${e.p.name} · poz. ${r.pos}`}>{e.perfs.length} gier · średnio {e.avg.toFixed(1)} pkt · najlepiej {heroName(e.best.heroId)} {e.best.kills}/{e.best.deaths}/{e.best.assists}</TipBody>}>
                        <button type="button" onClick={() => setFocusRole(r.role)} className="flex flex-col items-center">
                          <div className="relative">
                            <Avatar player={e.p} size={av} ring={focusRole === r.role ? C.secondary : 'rgba(255,255,255,0.7)'} />
                            <HeroImg heroId={e.best.heroId} variant="icon" className="absolute -bottom-1 -left-2 w-6 h-6 rounded-full" style={{ boxShadow: '0 0 0 2px #0c0f0d' }} />
                            <span className="absolute -top-1 -right-3 px-1.5 rounded-full text-[11px] font-bold text-black tabular-nums" style={{ background: e === mvp ? C.secondary : '#e8e8e8' }}>{e.avg.toFixed(1)}</span>
                          </div>
                          <span className="mt-1 px-2 py-0.5 rounded-md text-[11px] font-bold text-white bg-black/60 max-w-[110px] truncate">{e.p.name}</span>
                          <span className="text-[9px] uppercase tracking-widest text-white/50">{r.label}</span>
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
            <Tip content={<TipBody title="Najwyższa średnia punktów fantasy">{mvp.perfs.length} gier · {mvp.avg.toFixed(1)} pkt · najlepsza gra {mvp.best.fantasyPoints.toFixed(1)}</TipBody>}>
              <div className="relative rounded-2xl overflow-hidden h-28 cursor-help">
                <HeroImg heroId={mvp.best.heroId} className="absolute inset-0 w-full h-full" />
                <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, rgba(0,0,0,0.9), rgba(0,0,0,0.3)), linear-gradient(0deg, ${mix(C.secondary, 25)}, transparent)` }} />
                <div className="relative h-full flex items-center gap-3 px-4 text-white">
                  <Avatar player={mvp.p} size={52} ring={C.secondary} />
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
            <div className="mt-2 flex flex-col gap-1">
              {bench.map((e, i) => (
                <div key={e.p.id} className="flex items-center gap-2 h-8 rounded-lg px-2" style={{ background: ink(3) }}>
                  <span className="w-4 text-[10px] tabular-nums" style={{ color: C.muted }}>{i + 2}</span>
                  <Avatar player={e.p} size={22} />
                  <span className="flex-1 truncate text-xs font-semibold">{e.p.name}</span>
                  <HeroImg heroId={e.best.heroId} variant="icon" className="w-5 h-5" />
                  <span className="w-10 text-right text-xs font-bold tabular-nums">{e.avg.toFixed(1)}</span>
                </div>
              ))}
              {!bench.length && <span className="text-xs" style={{ color: C.muted }}>Brak rezerwowych w tym okresie</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Week selector */}
      <div className="shrink-0 flex items-center justify-center gap-1 mt-3 flex-wrap">
        <button type="button" onClick={() => setWi(-1)} className="rounded-full px-3 h-7 text-[10px] uppercase tracking-widest mr-2"
          style={all ? { background: C.primary, color: '#fff' } : { background: ink(6) }}>Cały turniej</button>
        <button type="button" aria-label="Poprzedni tydzień" disabled={wi <= 0} onClick={() => setWi(w => Math.max(0, w - 1))} className="w-7 h-7 rounded-full disabled:opacity-20" style={{ background: ink(6) }}>‹</button>
        {weeks.map(([k, list], i) => {
          const n = new Set(list.map(p => p.game.idx)).size;
          return (
            <Tip key={k} content={`Tydzień od ${fmtShort(k)} · ${n} gier`}>
              <button type="button" onClick={() => setWi(i)} className="rounded-md transition-all" style={{ width: 14, height: 8 + Math.min(20, n * 1.5), background: i === wi ? C.secondary : mix(C.primary, 45), opacity: i === wi ? 1 : 0.7 }} />
            </Tip>
          );
        })}
        <button type="button" aria-label="Następny tydzień" disabled={all || wi >= weeks.length - 1} onClick={() => setWi(w => Math.min(weeks.length - 1, w + 1))} className="w-7 h-7 rounded-full disabled:opacity-20" style={{ background: ink(6) }}>›</button>
      </div>
    </>
  );
}

export default function D15TeamOfWeek() {
  return <LabView><WithModel>{m => <TeamOfWeek model={m} />}</WithModel></LabView>;
}
