'use client';

// #12 — Constellation. Heroes sit on a ring grouped by attribute; chords join heroes that were
// played together ("Razem") or against each other ("Przeciw"). Thickness = games, colour = win
// rate. Hover or click a hero to isolate its links and list its partners / matchups.

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Model } from '@/lib/stats-lab/derive';
import { ATTR_COLOR, heroAttr, heroName, type HeroAttr } from '@/lib/stats-lab/heroes';
import { C, HeroImg, LabTitle, LabView, Seg, TeamPicker, Tip, TipBody, WithModel, ink, mix, useHeaderFont, useSize, wrColor } from '../kit';

type Mode = 'with' | 'vs';
/**
 * Everyone: a < b, wins counted for a's side ("with": the duo's wins).
 * One team: "with" = the team's own duos; "vs" is directed — a = their hero, b = the opponent's,
 * wins = the team's wins.
 */
interface Pair { a: number; b: number; n: number; wins: number }

function buildPairs(model: Model, mode: Mode, teamId: string | null): Pair[] {
  const map = new Map<string, Pair>();
  const add = (x: number, y: number, xWon: boolean, directed = false) => {
    const [a, b, aWon] = directed || x < y ? [x, y, xWon] : [y, x, mode === 'with' ? xWon : !xWon];
    const k = `${a}${directed ? '>' : '-'}${b}`;
    const p = map.get(k) ?? { a, b, n: 0, wins: 0 };
    p.n++; if (aWon) p.wins++;
    map.set(k, p);
  };
  for (const g of model.games) {
    if (teamId && g.radiant !== teamId && g.dire !== teamId) continue;
    const rad = g.perfs.filter(p => p.radiant && p.heroId).map(p => p.heroId);
    const dire = g.perfs.filter(p => !p.radiant && p.heroId).map(p => p.heroId);
    if (teamId) {
      const mineRad = g.radiant === teamId;
      const mine = mineRad ? rad : dire; const theirs = mineRad ? dire : rad;
      const won = mineRad === g.radiantWin;
      if (mode === 'with') { for (let i = 0; i < mine.length; i++) for (let j = i + 1; j < mine.length; j++) add(mine[i], mine[j], won); }
      else for (const x of mine) for (const y of theirs) add(x, y, won, true);
      continue;
    }
    if (mode === 'with') {
      for (const [side, won] of [[rad, g.radiantWin], [dire, !g.radiantWin]] as const)
        for (let i = 0; i < side.length; i++) for (let j = i + 1; j < side.length; j++) add(side[i], side[j], won);
    } else {
      for (const r of rad) for (const d of dire) add(r, d, g.radiantWin);
    }
  }
  return [...map.values()];
}

const ATTR_ORDER: HeroAttr[] = ['str', 'agi', 'int', 'all'];
const ATTR_LABEL: Record<HeroAttr, string> = { str: 'Siła', agi: 'Zręczność', int: 'Inteligencja', all: 'Uniwersalni' };

function Constellation({ model }: { model: Model }) {
  const font = useHeaderFont();
  const [mode, setMode] = useState<Mode>('with');
  const teams = useMemo(() => [...model.teams].sort((a, b) => b.games.length - a.games.length), [model]);
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const [ref, size] = useSize<HTMLDivElement>();
  const focus = hover ?? pinned;

  const [teamId, setTeamId] = useState<string | null>(null);
  const team = teamId ? model.teamById.get(teamId) : null;
  const all = useMemo(() => buildPairs(model, mode, teamId), [model, mode, teamId]);
  const edges = useMemo(() => {
    // A single team has few games: show every combination they actually played
    const sorted = all.filter(p => p.n >= (teamId ? 1 : 3)).sort((x, y) => y.n - x.n);
    return sorted.slice(0, teamId ? 70 : 90);
  }, [all, teamId]);
  // In team mode, which heroes were played by the team (the rest are opponents)
  const mine = useMemo(() => new Set(teamId ? (team?.heroPicks ?? []).map(h => h.heroId) : []), [teamId, team]);
  const nodes = useMemo(() => {
    const ids = new Set<number>();
    edges.forEach(e => { ids.add(e.a); ids.add(e.b); });
    return [...ids].sort((x, y) => ATTR_ORDER.indexOf(heroAttr(x)) - ATTR_ORDER.indexOf(heroAttr(y)) || heroName(x).localeCompare(heroName(y)));
  }, [edges]);

  const S = Math.min(size.w, size.h);
  const R = S / 2 - 30; const cx = size.w / 2; const cy = size.h / 2;
  const pos = new Map(nodes.map((id, i) => {
    const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
    return [id, { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, a }];
  }));
  const maxN = Math.max(1, ...edges.map(e => e.n));
  const icon = Math.max(18, Math.min(40, (2 * Math.PI * R) / Math.max(1, nodes.length) - 3));

  // Partner / matchup list for the focused hero (from all pairs, not just drawn edges)
  const list = useMemo(() => {
    if (focus == null) return [];
    return all.filter(p => p.a === focus || p.b === focus).map(p => {
      const other = p.a === focus ? p.b : p.a;
      const wins = mode === 'with' || p.a === focus ? p.wins : p.n - p.wins;
      return { other, n: p.n, wr: wins / p.n };
    }).filter(x => x.n >= 2).sort((x, y) => y.n - x.n || y.wr - x.wr).slice(0, 9);
  }, [all, focus, mode]);
  const bestDuos = useMemo(() => [...all].filter(p => p.n >= (teamId ? 2 : 4)).sort((x, y) => y.wins / y.n - x.wins / x.n || y.n - x.n).slice(0, 7), [all, teamId]);

  // Attribute arcs
  const arcs = ATTR_ORDER.map(attr => {
    const idx = nodes.map((id, i) => (heroAttr(id) === attr ? i : -1)).filter(i => i >= 0);
    if (!idx.length) return null;
    const a0 = ((idx[0] - 0.45) / nodes.length) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((idx[idx.length - 1] + 0.45) / nodes.length) * Math.PI * 2 - Math.PI / 2;
    const r = R + icon / 2 + 6;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return { attr, d: `M${cx + Math.cos(a0) * r},${cy + Math.sin(a0) * r} A${r},${r} 0 ${large} 1 ${cx + Math.cos(a1) * r},${cy + Math.sin(a1) * r}` };
  }).filter(Boolean) as Array<{ attr: HeroAttr; d: string }>;

  return (
    <>
      <LabTitle
        sub={<span>{team ? `${team.name} · ` : ''}{edges.length} połączeń · {nodes.length} bohaterów</span>}
        right={<Seg value={mode} onChange={v => { setMode(v); setPinned(null); }} options={[{ value: 'with', label: 'Razem', tip: 'Bohaterowie grani w tej samej drużynie' }, { value: 'vs', label: 'Przeciw', tip: 'Bohaterowie grani naprzeciw siebie' }]} />}
      >
        Konstelacja
      </LabTitle>
      <TeamPicker className="shrink-0 mt-3" teams={teams} value={teamId} onChange={id => { setTeamId(id); setPinned(null); }} allLabel="Wszyscy" size={36} />
      <div className="flex-1 min-h-0 flex gap-4 mt-2">
        <div ref={ref} className="relative flex-[1.6] min-w-0 min-h-0" onClick={() => setPinned(null)}>
          {size.w > 0 && (
            <svg width={size.w} height={size.h} className="absolute inset-0">
              {arcs.map(a => (
                <Tip key={a.attr} content={ATTR_LABEL[a.attr]}><path d={a.d} fill="none" stroke={ATTR_COLOR[a.attr]} strokeWidth={3} strokeLinecap="round" opacity={0.7} className="cursor-help" /></Tip>
              ))}
              {edges.map(e => {
                const p1 = pos.get(e.a)!; const p2 = pos.get(e.b)!;
                const on = focus == null || e.a === focus || e.b === focus;
                const wr = mode === 'with' ? e.wins / e.n : focus == null ? 0.5 : (e.a === focus ? e.wins / e.n : 1 - e.wins / e.n);
                const color = mode === 'vs' && focus == null ? C.muted : wrColor(wr);
                return (
                  <motion.path key={`${e.a}-${e.b}`} d={`M${p1.x},${p1.y} Q${cx + (p1.x + p2.x - 2 * cx) * 0.12},${cy + (p1.y + p2.y - 2 * cy) * 0.12} ${p2.x},${p2.y}`}
                    fill="none" stroke={color} strokeWidth={1 + (e.n / maxN) * 5} strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: on ? (focus == null ? 0.35 : 0.9) : 0.04 }} transition={{ duration: 0.6 }} />
                );
              })}
            </svg>
          )}
          {size.w > 0 && nodes.map(id => {
            const p = pos.get(id)!;
            const dim = focus != null && focus !== id && !edges.some(e => (e.a === focus && e.b === id) || (e.b === focus && e.a === id));
            return (
              <Tip key={id} content={heroName(id)}>
                <button type="button" className="absolute rounded-full overflow-hidden transition-all"
                  onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)} onClick={e => { e.stopPropagation(); setPinned(x => (x === id ? null : id)); }}
                  style={{ left: p.x - icon / 2, top: p.y - icon / 2, width: icon, height: icon, transform: focus === id ? 'scale(1.5)' : undefined, zIndex: focus === id ? 10 : 1, boxShadow: teamId && mine.has(id) ? `0 0 0 2.5px ${C.secondary}` : `0 0 0 1.5px ${focus === id ? C.secondary : ATTR_COLOR[heroAttr(id)]}`, opacity: dim ? 0.25 : teamId && mode === 'vs' && !mine.has(id) ? 0.7 : 1 }}>
                  <HeroImg heroId={id} variant="icon" title={false} className="w-full h-full" />
                </button>
              </Tip>
            );
          })}
          {focus != null && size.w > 0 && (
            <div className="absolute pointer-events-none text-center" style={{ left: cx - 90, top: cy - 30, width: 180 }}>
              <div className="text-lg font-logik-extended-bold uppercase leading-tight" style={{ color: C.heading, ...font }}>{heroName(focus)}</div>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>{mode === 'with' ? 'najczęstsi partnerzy' : 'najczęstsi rywale'}</div>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-[260px] max-w-[360px] hidden md:flex flex-col gap-2 min-h-0">
          <div className="text-sm font-logik-extended-bold uppercase" style={{ color: C.heading, ...font }}>
            {focus != null ? heroName(focus) : mode === 'with' ? (team ? 'Ich duety' : 'Najlepsze duety') : (team ? 'Ich pojedynki' : 'Najbardziej jednostronne')}
          </div>
          {focus != null ? list.map(x => (
            <Tip key={x.other} content={`${heroName(focus)} ${mode === 'with' ? '+' : 'vs'} ${heroName(x.other)}: ${x.n} gier, ${Math.round(x.wr * 100)}% wygranych`}>
              <div className="flex items-center gap-2 h-10">
                <HeroImg heroId={x.other} className="w-16 h-9 rounded-md" />
                <span className="flex-1 truncate text-xs">{heroName(x.other)}</span>
                <span className="text-[10px] tabular-nums" style={{ color: C.muted }}>{x.n}g</span>
                <span className="w-12 text-right text-xs font-bold tabular-nums rounded px-1" style={{ background: mix(wrColor(x.wr), 30) }}>{Math.round(x.wr * 100)}%</span>
              </div>
            </Tip>
          )) : (mode === 'with' ? bestDuos : [...all].filter(p => p.n >= (teamId ? 2 : 4)).sort((x, y) => Math.abs(y.wins / y.n - 0.5) - Math.abs(x.wins / x.n - 0.5) || y.n - x.n).slice(0, 7)).map(p => {
            const wr = p.wins / p.n;
            const [w, l] = mode === 'with' || wr >= 0.5 ? [p.a, p.b] : [p.b, p.a];
            const wwr = mode === 'with' ? wr : Math.max(wr, 1 - wr);
            return (
              <Tip key={`${p.a}-${p.b}`} content={`${heroName(w)} ${mode === 'with' ? '+' : 'pokonuje'} ${heroName(l)} · ${p.n} gier · ${Math.round(wwr * 100)}%`}>
                <div className="flex items-center gap-1.5 h-11">
                  <HeroImg heroId={w} className="w-16 h-9 rounded-md" />
                  <span className="text-xs opacity-50">{mode === 'with' ? '+' : '›'}</span>
                  <HeroImg heroId={l} className="w-16 h-9 rounded-md" style={{ filter: mode === 'vs' ? 'grayscale(0.7)' : undefined }} />
                  <span className="flex-1" />
                  <span className="text-[10px] tabular-nums" style={{ color: C.muted }}>{p.n}g</span>
                  <span className="w-12 text-right text-xs font-bold tabular-nums rounded px-1" style={{ background: mix(wrColor(wwr), 30) }}>{Math.round(wwr * 100)}%</span>
                </div>
              </Tip>
            );
          })}
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-[10px]" style={{ color: C.muted }}>
            <span className="w-14 h-1.5 rounded-full" style={{ background: `linear-gradient(90deg, ${C.loss}, ${wrColor(0.5)}, ${C.win})` }} />
            <span>% wygranych</span>
            <span className="ml-3 inline-block w-8 h-[5px] rounded-full" style={{ background: ink(40) }} />
            <span>liczba gier</span>
          </div>
        </div>
      </div>
    </>
  );
}

export default function D12Constellation() {
  return <LabView><WithModel>{m => <Constellation model={m} />}</WithModel></LabView>;
}
