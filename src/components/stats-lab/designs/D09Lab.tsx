'use client';

// #9 — Lab. Scatter any two metrics for players, teams or heroes (points are avatars, logos,
// hero icons), with median quadrants and drag-to-zoom. "Tabela" turns the same data into a
// sortable heatmap where every cell is coloured by its percentile.

import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { InfoPopover } from '@/components/ui/info-popover';
import { METRICS, fmtClock, fmtPct, type MetricKey } from '@/lib/stats-lab/metrics';
import { pctRank, type HeroX, type Model, type PlayerX, type TeamX } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { Avatar, C, HeroImg, LabTitle, LabView, Pager, Seg, TeamLogo, Tip, TipBody, WithModel, ink, mix, useFitCount, useHeaderFont, usePages, useSize } from '../kit';

type Kind = 'players' | 'teams' | 'heroes';
type Entity = PlayerX | TeamX | HeroX;
interface Axis { key: string; label: string; short: string; desc: string; get: (e: any) => number; fmt: (v: number) => string; low?: boolean }

const dec = (d: number) => (v: number) => v.toLocaleString('pl-PL', { maximumFractionDigits: d });
const pAxis = (k: MetricKey): Axis => {
  const m = METRICS[k];
  return { key: k, label: m.label, short: m.short, desc: `${m.desc} — średnio na grę`, get: (p: PlayerX) => p.agg[k].avg ?? 0, fmt: k === 'kp' ? fmtPct : dec(m.avgDigits), low: m.better === 'low' };
};
const AXES: Record<Kind, Axis[]> = {
  players: [
    ...(['fantasy', 'kills', 'deaths', 'assists', 'kda', 'kp', 'gpm', 'xpm', 'lastHits', 'lhpm', 'hdpm', 'towerDamage', 'heroHealing', 'wards', 'dewards', 'stacks', 'runes'] as MetricKey[]).map(pAxis),
    { key: 'wr', label: 'Wygrane', short: 'W%', desc: 'Procent wygranych gier', get: (p: PlayerX) => p.wr, fmt: fmtPct },
    { key: 'games', label: 'Gry', short: 'G', desc: 'Rozegrane gry', get: (p: PlayerX) => p.games, fmt: dec(0) },
    { key: 'pool', label: 'Pula bohaterów', short: 'POOL', desc: 'Liczba różnych bohaterów', get: (p: PlayerX) => p.heroes.length, fmt: dec(0) },
  ],
  teams: [
    { key: 'wr', label: 'Wygrane', short: 'W%', desc: 'Procent wygranych gier', get: (t: TeamX) => t.wr, fmt: fmtPct },
    { key: 'kills', label: 'Zabójstwa', short: 'K', desc: 'Zabójstwa drużyny na grę', get: (t: TeamX) => t.avg.kills, fmt: dec(1) },
    { key: 'deaths', label: 'Śmierci', short: 'D', desc: 'Śmierci drużyny na grę', get: (t: TeamX) => t.avg.deaths, fmt: dec(1), low: true },
    { key: 'gpm', label: 'Złoto / min', short: 'GPM', desc: 'Łączne GPM drużyny', get: (t: TeamX) => t.avg.gpm, fmt: dec(0) },
    { key: 'dmg', label: 'Obrażenia', short: 'DMG', desc: 'Obrażenia bohaterom na grę', get: (t: TeamX) => t.avg.heroDamage, fmt: v => `${(v / 1000).toFixed(1)}k` },
    { key: 'bld', label: 'Budynki', short: 'BLD', desc: 'Obrażenia budynkom na grę', get: (t: TeamX) => t.avg.towerDamage, fmt: v => `${(v / 1000).toFixed(1)}k` },
    { key: 'wards', label: 'Wardy', short: 'WRD', desc: 'Postawione wardy na grę', get: (t: TeamX) => t.avg.wards, fmt: dec(1) },
    { key: 'dew', label: 'Dewardy', short: 'DEW', desc: 'Zniszczone wardy na grę', get: (t: TeamX) => t.avg.dewards, fmt: dec(1) },
    { key: 'stk', label: 'Stacki', short: 'STK', desc: 'Stacki na grę', get: (t: TeamX) => t.avg.stacks, fmt: dec(1) },
    { key: 'rosh', label: 'Roshany', short: 'RSH', desc: 'Roshany na grę', get: (t: TeamX) => t.avg.roshans, fmt: dec(2) },
    { key: 'dur', label: 'Czas gry', short: 'CZAS', desc: 'Średni czas gry', get: (t: TeamX) => t.avg.duration, fmt: fmtClock },
    { key: 'pool', label: 'Pula bohaterów', short: 'POOL', desc: 'Różni bohaterowie wybrani przez drużynę', get: (t: TeamX) => t.heroPicks.length, fmt: dec(0) },
  ],
  heroes: [
    { key: 'picks', label: 'Picki', short: 'P', desc: 'Ile razy wybrany', get: (h: HeroX) => h.picks, fmt: dec(0) },
    { key: 'bans', label: 'Bany', short: 'B', desc: 'Ile razy zbanowany', get: (h: HeroX) => h.bans, fmt: dec(0) },
    { key: 'wr', label: 'Wygrane', short: 'W%', desc: 'Procent wygranych', get: (h: HeroX) => h.wr, fmt: fmtPct },
    { key: 'k', label: 'Zabójstwa', short: 'K', desc: 'Średnie zabójstwa', get: (h: HeroX) => h.avgK, fmt: dec(1) },
    { key: 'd', label: 'Śmierci', short: 'D', desc: 'Średnie śmierci', get: (h: HeroX) => h.avgD, fmt: dec(1), low: true },
    { key: 'a', label: 'Asysty', short: 'A', desc: 'Średnie asysty', get: (h: HeroX) => h.avgA, fmt: dec(1) },
    { key: 'gpm', label: 'Złoto / min', short: 'GPM', desc: 'Średnie GPM', get: (h: HeroX) => h.avgGpm, fmt: dec(0) },
    { key: 'players', label: 'Gracze', short: 'GR', desc: 'Ilu różnych graczy nim grało', get: (h: HeroX) => h.players.length, fmt: dec(0) },
  ],
};
const PRESETS: Record<Kind, Array<{ label: string; x: string; y: string; tip: string }>> = {
  players: [
    { label: 'Farma × obrażenia', x: 'gpm', y: 'hdpm', tip: 'Czy złoto zamienia się w obrażenia?' },
    { label: 'Zabójstwa × śmierci', x: 'deaths', y: 'kills', tip: 'Agresja i jej cena' },
    { label: 'Wizja × dewardy', x: 'wards', y: 'dewards', tip: 'Kto kontroluje mapę' },
    { label: 'Udział × wygrane', x: 'kp', y: 'wr', tip: 'Czy bycie wszędzie wygrywa gry?' },
  ],
  teams: [
    { label: 'Zabójstwa × wygrane', x: 'kills', y: 'wr', tip: 'Czy krwawe drużyny wygrywają?' },
    { label: 'Wizja × śmierci', x: 'wards', y: 'deaths', tip: 'Czy wardy ratują życie?' },
    { label: 'Pula × wygrane', x: 'pool', y: 'wr', tip: 'Szeroka pula bohaterów a wyniki' },
  ],
  heroes: [
    { label: 'Picki × wygrane', x: 'picks', y: 'wr', tip: 'Popularni kontra skuteczni' },
    { label: 'Bany × picki', x: 'bans', y: 'picks', tip: 'Banować czy brać?' },
  ],
};

function AxisPicker({ axes, value, onChange, label }: { axes: Axis[]; value: string; onChange: (k: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const cur = axes.find(a => a.key === value)!;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="rounded-full px-3 py-1 text-[11px] flex items-center gap-1.5" style={{ background: ink(6), border: `1px solid ${ink(12)}` }}>
          <span style={{ color: C.muted }}>{label}</span><b>{cur.label}</b><span className="opacity-50">▾</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-2 grid grid-cols-2 gap-1 border-white/10 bg-[#111] text-white">
        {axes.map(a => (
          <Tip key={a.key} side="left" content={a.desc}>
            <button type="button" onClick={() => { onChange(a.key); setOpen(false); }} className="text-left text-xs px-2 py-1 rounded-md hover:bg-white/10" style={a.key === value ? { background: C.primary } : undefined}>{a.label}</button>
          </Tip>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function nameOf(e: Entity, kind: Kind) { return kind === 'heroes' ? heroName((e as HeroX).heroId) : (e as PlayerX | TeamX).name; }
function idOf(e: Entity, kind: Kind) { return kind === 'heroes' ? String((e as HeroX).heroId) : (e as PlayerX | TeamX).id; }
function Mark({ e, kind, size, ring }: { e: Entity; kind: Kind; size: number; ring?: string }) {
  if (kind === 'players') return <Avatar player={e as PlayerX} size={size} ring={ring} />;
  if (kind === 'teams') return <TeamLogo team={e as TeamX} size={size} />;
  return <HeroImg heroId={(e as HeroX).heroId} variant="icon" className="rounded" style={{ width: size, height: size, boxShadow: ring ? `0 0 0 2px ${ring}` : undefined }} />;
}

function Scatter({ ents, kind, ax, ay }: { ents: Entity[]; kind: Kind; ax: Axis; ay: Axis }) {
  const [ref, size] = useSize<HTMLDivElement>();
  const [zoom, setZoom] = useState<null | { x0: number; x1: number; y0: number; y1: number }>(null);
  const [brush, setBrush] = useState<null | { sx: number; sy: number; ex: number; ey: number }>(null);
  const [hot, setHot] = useState<string | null>(null);
  const down = useRef(false);
  const pts = ents.map(e => ({ e, x: ax.get(e), y: ay.get(e) }));
  const xs = pts.map(p => p.x); const ys = pts.map(p => p.y);
  const pad = (lo: number, hi: number) => { const d = (hi - lo) * 0.06 || 1; return [lo - d, hi + d]; };
  const [dx0, dx1] = zoom ? [zoom.x0, zoom.x1] : pad(Math.min(...xs), Math.max(...xs));
  const [dy0, dy1] = zoom ? [zoom.y0, zoom.y1] : pad(Math.min(...ys), Math.max(...ys));
  const M = { l: 44, r: 12, t: 10, b: 28 };
  const W = size.w - M.l - M.r; const H = size.h - M.t - M.b;
  const sx = (v: number) => M.l + ((v - dx0) / (dx1 - dx0)) * W;
  const sy = (v: number) => M.t + H - ((v - dy0) / (dy1 - dy0)) * H;
  const med = (a: number[]) => [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)] ?? 0;
  const mx = med(xs); const my = med(ys);
  const ticks = (lo: number, hi: number) => Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
  const mark = Math.max(16, Math.min(26, 360 / Math.sqrt(Math.max(1, ents.length))));
  const local = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  return (
    <div ref={ref} className="relative w-full h-full select-none touch-none"
      onPointerDown={e => { if ((e.target as HTMLElement).closest('[data-pt]')) return; down.current = true; const p = local(e); setBrush({ sx: p.x, sy: p.y, ex: p.x, ey: p.y }); }}
      onPointerMove={e => { if (!down.current || !brush) return; const p = local(e); setBrush(b => b && { ...b, ex: p.x, ey: p.y }); }}
      onPointerUp={() => {
        down.current = false;
        if (brush && Math.abs(brush.ex - brush.sx) > 20 && Math.abs(brush.ey - brush.sy) > 20) {
          const inv = (px: number, py: number) => ({ x: dx0 + ((px - M.l) / W) * (dx1 - dx0), y: dy0 + ((M.t + H - py) / H) * (dy1 - dy0) });
          const a = inv(Math.min(brush.sx, brush.ex), Math.max(brush.sy, brush.ey)); const b = inv(Math.max(brush.sx, brush.ex), Math.min(brush.sy, brush.ey));
          setZoom({ x0: a.x, x1: b.x, y0: a.y, y1: b.y });
        }
        setBrush(null);
      }}
      onDoubleClick={() => setZoom(null)}
      style={{ cursor: 'crosshair' }}
    >
      {size.w > 0 && (
        <svg width={size.w} height={size.h} className="absolute inset-0">
          <rect x={M.l} y={M.t} width={W} height={H} fill={ink(2)} rx={8} />
          {ticks(dx0, dx1).map((v, i) => <g key={`x${i}`}><line x1={sx(v)} x2={sx(v)} y1={M.t} y2={M.t + H} stroke={ink(5)} /><text x={sx(v)} y={M.t + H + 14} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.45}>{ax.fmt(v)}</text></g>)}
          {ticks(dy0, dy1).map((v, i) => <g key={`y${i}`}><line x1={M.l} x2={M.l + W} y1={sy(v)} y2={sy(v)} stroke={ink(5)} /><text x={M.l - 6} y={sy(v) + 3} textAnchor="end" fontSize={10} fill="currentColor" opacity={0.45}>{ay.fmt(v)}</text></g>)}
          {mx >= dx0 && mx <= dx1 && <line x1={sx(mx)} x2={sx(mx)} y1={M.t} y2={M.t + H} stroke={C.primary} strokeOpacity={0.6} strokeDasharray="4 4" />}
          {my >= dy0 && my <= dy1 && <line x1={M.l} x2={M.l + W} y1={sy(my)} y2={sy(my)} stroke={C.primary} strokeOpacity={0.6} strokeDasharray="4 4" />}
          <text x={M.l + W} y={size.h - 2} textAnchor="end" fontSize={10} fontWeight={700} fill="currentColor" opacity={0.7}>{ax.label} →</text>
          <text x={M.l + 6} y={M.t + 12} fontSize={10} fontWeight={700} fill="currentColor" opacity={0.7}>↑ {ay.label}</text>
          {brush && <rect x={Math.min(brush.sx, brush.ex)} y={Math.min(brush.sy, brush.ey)} width={Math.abs(brush.ex - brush.sx)} height={Math.abs(brush.ey - brush.sy)} fill={mix(C.primary, 15)} stroke={C.primary} strokeDasharray="3 3" />}
        </svg>
      )}
      {size.w > 0 && pts.filter(p => p.x >= dx0 && p.x <= dx1 && p.y >= dy0 && p.y <= dy1).map(p => {
        const id = idOf(p.e, kind);
        return (
          <Tip key={id} content={<TipBody title={nameOf(p.e, kind)}>{ax.label}: {ax.fmt(p.x)} · {ay.label}: {ay.fmt(p.y)}{kind === 'players' ? ` · ${(p.e as PlayerX).games} gier` : ''}</TipBody>}>
            <motion.div data-pt className="absolute" initial={false} animate={{ left: sx(p.x) - mark / 2, top: sy(p.y) - mark / 2 }} transition={{ type: 'spring', stiffness: 160, damping: 22 }}
              onMouseEnter={() => setHot(id)} onMouseLeave={() => setHot(null)} style={{ zIndex: hot === id ? 20 : 1 }}>
              <div className="transition-transform hover:scale-150"><Mark e={p.e} kind={kind} size={mark} ring={hot === id ? C.secondary : 'rgba(0,0,0,0.5)'} /></div>
            </motion.div>
          </Tip>
        );
      })}
      {zoom && <button type="button" onClick={() => setZoom(null)} className="absolute right-3 top-3 rounded-full px-3 py-1 text-[10px] uppercase tracking-widest" style={{ background: C.primary, color: '#fff' }}>Reset</button>}
    </div>
  );
}

function Heatmap({ ents, kind, axes }: { ents: Entity[]; kind: Kind; axes: Axis[] }) {
  const font = useHeaderFont();
  const cols = useMemo(() => axes.slice(0, 12), [axes]);
  const [sortKey, setSortKey] = useState(cols[0].key);
  const [asc, setAsc] = useState(false);
  const pools = useMemo(() => Object.fromEntries(cols.map(a => [a.key, ents.map(e => a.get(e))])), [cols, ents]);
  const rows = useMemo(() => {
    const a = cols.find(c => c.key === sortKey)!;
    return [...ents].sort((p, q) => (asc ? 1 : -1) * (a.get(p) - a.get(q)));
  }, [ents, cols, sortKey, asc]);
  const [ref, per] = useFitCount<HTMLDivElement>(28, 2, 4);
  const { page, pages, setPage, slice, offset } = usePages(rows, per);
  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-end gap-1 pb-1 shrink-0" style={{ borderBottom: `1px solid ${ink(10)}` }}>
        <div className="w-[190px] shrink-0" />
        {cols.map(c => (
          <Tip key={c.key} content={<TipBody title={c.label}>{c.desc}{c.low ? ' (mniej = lepiej)' : ''}</TipBody>}>
            <button type="button" onClick={() => (sortKey === c.key ? setAsc(x => !x) : (setSortKey(c.key), setAsc(false)))} className="flex-1 min-w-0 text-[10px] uppercase tracking-wider text-center truncate"
              style={{ color: sortKey === c.key ? C.text : C.muted, fontWeight: sortKey === c.key ? 700 : 400 }}>{c.short}{sortKey === c.key ? (asc ? ' ↑' : ' ↓') : ''}</button>
          </Tip>
        ))}
      </div>
      <div ref={ref} className="flex-1 min-h-0 flex flex-col gap-[2px] pt-1">
        {slice.map((e, i) => (
          <div key={idOf(e, kind)} className="h-[28px] shrink-0 flex items-center gap-1">
            <div className="w-[190px] shrink-0 flex items-center gap-1.5 min-w-0">
              <span className="w-6 text-right text-[10px] tabular-nums" style={{ color: C.muted }}>{offset + i + 1}</span>
              <Mark e={e} kind={kind} size={20} />
              <span className="truncate text-xs font-semibold">{nameOf(e, kind)}</span>
            </div>
            {cols.map(c => {
              const v = c.get(e);
              const pr = pctRank(pools[c.key], v);
              const good = c.low ? 1 - pr : pr;
              return (
                <Tip key={c.key} content={`${nameOf(e, kind)} · ${c.label}: ${c.fmt(v)} · lepiej niż ${Math.round(good * 100)}%`}>
                  <div className="flex-1 min-w-0 h-full rounded flex items-center justify-center text-[11px] tabular-nums font-semibold"
                    style={{ background: `color-mix(in srgb, ${good >= 0.5 ? C.win : C.loss} ${Math.round(Math.abs(good - 0.5) * 2 * 55)}%, transparent)`, ...(c.key === sortKey ? font : {}) }}>
                    {c.fmt(v)}
                  </div>
                </Tip>
              );
            })}
          </div>
        ))}
      </div>
      <Pager className="mt-1" page={page} pages={pages} onChange={setPage} />
    </div>
  );
}

function Lab({ model }: { model: Model }) {
  const [kind, setKind] = useState<Kind>('players');
  const [view, setView] = useState<'plot' | 'table'>('plot');
  const [xy, setXy] = useState<Record<Kind, { x: string; y: string }>>({ players: { x: 'gpm', y: 'hdpm' }, teams: { x: 'kills', y: 'wr' }, heroes: { x: 'picks', y: 'wr' } });
  const ents: Entity[] = useMemo(() => kind === 'players' ? model.players.filter(p => p.games >= model.minGames)
    : kind === 'teams' ? model.teams.filter(t => t.games.length >= 2)
    : model.heroes.filter(h => h.picks >= 2), [model, kind]);
  const axes = AXES[kind];
  const ax = axes.find(a => a.key === xy[kind].x)!; const ay = axes.find(a => a.key === xy[kind].y)!;
  const setAxis = (which: 'x' | 'y', k: string) => setXy(v => ({ ...v, [kind]: { ...v[kind], [which]: k } }));

  return (
    <>
      <LabTitle
        sub={<Tip content={kind === 'players' ? `Gracze z co najmniej ${model.minGames} grami` : kind === 'heroes' ? 'Bohaterowie z co najmniej 2 pickami' : 'Drużyny z co najmniej 2 grami'}><span className="cursor-help">{ents.length} punktów</span></Tip>}
        right={<div className="flex gap-2"><Seg size="sm" value={kind} onChange={setKind} options={[{ value: 'players', label: 'Gracze' }, { value: 'teams', label: 'Drużyny' }, { value: 'heroes', label: 'Bohaterowie' }]} /><Seg size="sm" value={view} onChange={setView} options={[{ value: 'plot', label: 'Wykres' }, { value: 'table', label: 'Tabela' }]} /></div>}
      >
        Laboratorium
      </LabTitle>
      {view === 'plot' && (
        <div className="shrink-0 flex flex-wrap items-center gap-2 mt-3">
          <AxisPicker axes={axes} value={ax.key} onChange={k => setAxis('x', k)} label="X" />
          <AxisPicker axes={axes} value={ay.key} onChange={k => setAxis('y', k)} label="Y" />
          <span className="w-px h-5 mx-1" style={{ background: ink(15) }} />
          {PRESETS[kind].map(p => (
            <Tip key={p.label} content={p.tip}>
              <button type="button" onClick={() => setXy(v => ({ ...v, [kind]: { x: p.x, y: p.y } }))} className="rounded-full px-3 py-1 text-[11px] transition"
                style={xy[kind].x === p.x && xy[kind].y === p.y ? { background: mix(C.primary, 40), border: `1px solid ${C.primary}` } : { background: ink(4), border: `1px solid ${ink(8)}` }}>{p.label}</button>
            </Tip>
          ))}
          <span className="ml-auto"><InfoPopover label="Jak używać wykresu">Przeciągnij po wykresie, by przybliżyć fragment. Podwójne kliknięcie wraca do całości. Przerywane linie to mediany — dzielą graczy na cztery ćwiartki.</InfoPopover></span>
        </div>
      )}
      <div className="flex-1 min-h-0 mt-2">
        {view === 'plot' ? <Scatter key={kind} ents={ents} kind={kind} ax={ax} ay={ay} /> : <Heatmap key={kind} ents={ents} kind={kind} axes={axes} />}
      </div>
    </>
  );
}

export default function D09Lab() {
  return <LabView><WithModel>{m => <Lab model={m} />}</WithModel></LabView>;
}
