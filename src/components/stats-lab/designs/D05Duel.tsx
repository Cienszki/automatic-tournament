'use client';

// #5 — Duel. Drag a player (or team) from the pool into a corner — or click to fill the
// highlighted corner. Butterfly bars compare per-game averages; the scoreboard counts metrics
// won; the bottom shows shared heroes and every time they met.

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { metric, fmtClock, fmtPct, type MetricKey } from '@/lib/stats-lab/metrics';
import type { GameX, Model, PlayerX, TeamX } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { Avatar, C, HeroImg, LabTitle, LabView, Pager, Seg, TeamLogo, Tip, TipBody, WithModel, ink, mix, playerTip, useHeaderFont, usePages, useSize } from '../kit';

type Mode = 'players' | 'teams';
interface Row { key: string; label: string; desc: string; a: number; b: number; fmt: (v: number) => string; better: 'high' | 'low' }

const P_KEYS: MetricKey[] = ['fantasy', 'kills', 'deaths', 'assists', 'kda', 'kp', 'gpm', 'xpm', 'lastHits', 'hdpm', 'towerDamage', 'heroHealing', 'wards', 'dewards', 'stacks'];
const SIDE = [C.primary, C.secondary];

function playerRows(a: PlayerX, b: PlayerX): Row[] {
  const rows: Row[] = [{ key: 'wr', label: 'Wygrane', desc: 'Procent wygranych gier', a: a.wr, b: b.wr, fmt: fmtPct, better: 'high' }];
  for (const k of P_KEYS) {
    const m = metric(k);
    const f = k === 'kp' ? m.fmt : (v: number) => v.toLocaleString('pl-PL', { maximumFractionDigits: m.avgDigits });
    rows.push({ key: k, label: m.label, desc: `${m.desc} — średnio na grę`, a: a.agg[k].avg ?? 0, b: b.agg[k].avg ?? 0, fmt: f, better: m.better });
  }
  return rows;
}

function teamRows(a: TeamX, b: TeamX): Row[] {
  const n = (v: number | null) => v ?? 0;
  const i0 = (v: number) => Math.round(v).toLocaleString('pl-PL');
  const d1 = (v: number) => v.toFixed(1);
  const k = (v: number) => `${(v / 1000).toFixed(1)}k`;
  return [
    { key: 'wr', label: 'Wygrane gry', desc: 'Procent wygranych gier', a: a.wr, b: b.wr, fmt: fmtPct, better: 'high' },
    { key: 'kills', label: 'Zabójstwa', desc: 'Średnio zabójstw drużyny na grę', a: a.avg.kills, b: b.avg.kills, fmt: d1, better: 'high' },
    { key: 'deaths', label: 'Śmierci', desc: 'Średnio śmierci drużyny na grę — mniej lepiej', a: a.avg.deaths, b: b.avg.deaths, fmt: d1, better: 'low' },
    { key: 'gpm', label: 'Złoto / min', desc: 'Łączne GPM pięciu graczy', a: a.avg.gpm, b: b.avg.gpm, fmt: i0, better: 'high' },
    { key: 'dmg', label: 'Obrażenia', desc: 'Obrażenia bohaterom na grę', a: a.avg.heroDamage, b: b.avg.heroDamage, fmt: k, better: 'high' },
    { key: 'bld', label: 'Budynki', desc: 'Obrażenia budynkom na grę', a: a.avg.towerDamage, b: b.avg.towerDamage, fmt: k, better: 'high' },
    { key: 'wards', label: 'Wardy', desc: 'Postawione wardy na grę', a: a.avg.wards, b: b.avg.wards, fmt: d1, better: 'high' },
    { key: 'dew', label: 'Dewardy', desc: 'Zniszczone wrogie wardy na grę', a: a.avg.dewards, b: b.avg.dewards, fmt: d1, better: 'high' },
    { key: 'stk', label: 'Stacki', desc: 'Zestackowane obozy na grę', a: a.avg.stacks, b: b.avg.stacks, fmt: d1, better: 'high' },
    { key: 'rosh', label: 'Roshany', desc: 'Roshany na grę', a: a.avg.roshans, b: b.avg.roshans, fmt: (v: number) => v.toFixed(2), better: 'high' },
    { key: 'fb', label: 'Pierwsza krew', desc: 'W ilu grach drużyna zdobyła pierwszą krew', a: n(a.avg.fbRate), b: n(b.avg.fbRate), fmt: fmtPct, better: 'high' },
    { key: 'dur', label: 'Czas wygranej', desc: 'Średni czas wygranych gier — krócej znaczy pewniej', a: n(a.avg.winDuration), b: n(b.avg.winDuration), fmt: fmtClock, better: 'low' },
  ];
}

function Corner({ side, entity, mode, active, onDrop, onActivate }: {
  side: 0 | 1; entity: PlayerX | TeamX | null; mode: Mode; active: boolean; onDrop: (id: string) => void; onActivate: () => void;
}) {
  const font = useHeaderFont();
  const [over, setOver] = useState(false);
  const color = SIDE[side];
  const p = mode === 'players' ? (entity as PlayerX | null) : null;
  const t = mode === 'teams' ? (entity as TeamX | null) : (p?.team ?? null);
  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); const id = e.dataTransfer.getData('text/plain'); if (id) onDrop(id); }}
      onClick={onActivate}
      className="relative w-[200px] xl:w-[230px] shrink-0 rounded-2xl flex flex-col items-center justify-center gap-2 p-3 cursor-pointer transition-all"
      style={{ background: `radial-gradient(circle at 50% 35%, ${mix(color, over ? 40 : 18)}, transparent 70%)`, border: `1.5px ${active ? 'solid' : 'dashed'} ${mix(color, active || over ? 80 : 30)}` }}
    >
      {mode === 'players'
        ? <Avatar player={p} size={110} ring={color} />
        : <TeamLogo team={t} size={110} />}
      <div className="text-center min-w-0 w-full">
        <div className="text-lg font-logik-extended-bold uppercase leading-tight line-clamp-2 break-words" style={{ color, ...font }}>{entity?.name ?? '?'}</div>
        {mode === 'players' && p && <div className="flex items-center justify-center gap-1 text-[11px] mt-0.5" style={{ color: C.muted }}><TeamLogo team={t} size={14} /><span className="truncate">{t?.name}</span></div>}
        {entity && <div className="text-[10px] uppercase tracking-widest mt-1" style={{ color: C.muted }}>{mode === 'players' ? (entity as PlayerX).games : (entity as TeamX).games.length} gier</div>}
      </div>
    </div>
  );
}

function Duel({ model }: { model: Model }) {
  const font = useHeaderFont();
  const [mode, setMode] = useState<Mode>('players');
  const pool = useMemo(() => mode === 'players'
    ? model.players.filter(p => p.games >= model.minGames).sort((a, b) => (b.agg.fantasy.avg ?? 0) - (a.agg.fantasy.avg ?? 0))
    : [...model.teams].sort((a, b) => b.wr - a.wr || b.games.length - a.games.length), [model, mode]);
  const [pick, setPick] = useState<Record<Mode, [string | null, string | null]>>(() => ({
    players: [pool[0]?.id ?? null, pool[1]?.id ?? null],
    teams: (() => { const t = [...model.teams].sort((a, b) => b.wr - a.wr); return [t[0]?.id ?? null, t[1]?.id ?? null] as [string | null, string | null]; })(),
  }));
  const [activeSide, setActiveSide] = useState<0 | 1>(1);
  const [poolRef, poolSize] = useSize<HTMLDivElement>();
  const per = Math.max(4, Math.floor((poolSize.w || 600) / 44));
  const { page, pages, setPage, slice } = usePages(pool as Array<PlayerX | TeamX>, per);

  const get = (id: string | null) => (id ? (mode === 'players' ? model.playerById.get(id) : model.teamById.get(id)) ?? null : null);
  const [aId, bId] = pick[mode];
  const A = get(aId); const B = get(bId);
  const set = (side: 0 | 1, id: string) => { setPick(prev => { const next = [...prev[mode]] as [string | null, string | null]; next[side] = id; return { ...prev, [mode]: next }; }); setActiveSide(side === 0 ? 1 : 0); };

  const rows = A && B ? (mode === 'players' ? playerRows(A as PlayerX, B as PlayerX) : teamRows(A as TeamX, B as TeamX)) : [];
  const score = rows.reduce((s, r) => {
    if (r.a === r.b) return s;
    const aWins = r.better === 'high' ? r.a > r.b : r.a < r.b;
    return aWins ? [s[0] + 1, s[1]] : [s[0], s[1] + 1];
  }, [0, 0]);

  // Shared heroes + direct meetings
  const extra = useMemo(() => {
    if (!A || !B) return { shared: [] as number[], meetings: [] as Array<{ g: GameX; aWon: boolean }> };
    const teamIdOf = (x: PlayerX | TeamX) => (mode === 'players' ? null : x.id);
    const gamesOf = (x: PlayerX | TeamX) => (mode === 'players' ? (x as PlayerX).perfs.map(p => p.game) : (x as TeamX).games);
    const bGames = new Set(gamesOf(B).map(g => g.idx));
    const meetings: Array<{ g: GameX; aWon: boolean }> = [];
    for (const g of gamesOf(A)) {
      if (!bGames.has(g.idx)) continue;
      const aSide = mode === 'players' ? (A as PlayerX).perfs.find(p => p.game === g)!.tid : teamIdOf(A)!;
      const bSide = mode === 'players' ? (B as PlayerX).perfs.find(p => p.game === g)!.tid : teamIdOf(B)!;
      if (aSide === bSide) continue; // teammates in that game
      meetings.push({ g, aWon: g.winnerId === aSide });
    }
    const heroesOf = (x: PlayerX | TeamX) => new Set((mode === 'players' ? (x as PlayerX).heroes : (x as TeamX).heroPicks).map(h => h.heroId));
    const hb = heroesOf(B);
    const shared = [...heroesOf(A)].filter(h => hb.has(h));
    return { shared, meetings };
  }, [A, B, mode]);

  const tipFor = (x: PlayerX | TeamX) => (mode === 'players' ? playerTip(x as PlayerX) : <TipBody title={x.name}>{(x as TeamX).wins}-{(x as TeamX).losses} w grach</TipBody>);

  return (
    <>
      <LabTitle right={<Seg value={mode} onChange={setMode} options={[{ value: 'players', label: 'Gracze' }, { value: 'teams', label: 'Drużyny' }]} />}>Pojedynek</LabTitle>
      <div className="flex-1 min-h-0 flex gap-4 mt-3">
        <Corner side={0} entity={A} mode={mode} active={activeSide === 0} onDrop={id => set(0, id)} onActivate={() => setActiveSide(0)} />

        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          {/* Scoreboard */}
          <Tip content="Ile porównań wygrywa każda strona">
            <div className="self-center flex items-center gap-4 text-5xl font-logik-extended-bold tabular-nums leading-none cursor-help shrink-0" style={font}>
              <span style={{ color: SIDE[0] }}>{score[0]}</span><span className="text-2xl opacity-30">:</span><span style={{ color: SIDE[1] }}>{score[1]}</span>
            </div>
          </Tip>
          {/* Butterfly bars */}
          <div className="flex-1 min-h-0 flex flex-col justify-around mt-2">
            {rows.map(r => {
              const max = Math.max(r.a, r.b, 1e-9);
              const aWin = r.a !== r.b && (r.better === 'high' ? r.a > r.b : r.a < r.b);
              const bWin = r.a !== r.b && !aWin;
              return (
                <div key={r.key} className="flex items-center gap-2 text-xs">
                  <span className="w-14 text-right tabular-nums font-bold" style={{ opacity: aWin ? 1 : 0.5 }}>{r.fmt(r.a)}</span>
                  <div className="flex-1 h-2.5 flex justify-end rounded-l-full overflow-hidden" style={{ background: ink(4) }}>
                    <motion.div className="h-full rounded-l-full" initial={{ width: 0 }} animate={{ width: `${(r.a / max) * 100}%` }} style={{ background: SIDE[0], opacity: aWin ? 1 : 0.35 }} />
                  </div>
                  <Tip content={<TipBody title={r.label}>{r.desc}</TipBody>}>
                    <span className="w-40 text-center text-[10px] uppercase tracking-wide truncate cursor-help" style={{ color: C.muted }}>{r.label}</span>
                  </Tip>
                  <div className="flex-1 h-2.5 rounded-r-full overflow-hidden" style={{ background: ink(4) }}>
                    <motion.div className="h-full rounded-r-full" initial={{ width: 0 }} animate={{ width: `${(r.b / max) * 100}%` }} style={{ background: SIDE[1], opacity: bWin ? 1 : 0.35 }} />
                  </div>
                  <span className="w-14 tabular-nums font-bold" style={{ opacity: bWin ? 1 : 0.5 }}>{r.fmt(r.b)}</span>
                </div>
              );
            })}
          </div>
          {/* Shared heroes + meetings */}
          <div className="shrink-0 flex items-center justify-between gap-4 mt-2 min-h-[36px]">
            <div className="flex items-center gap-1 min-w-0 overflow-hidden">
              {extra.shared.length > 0 && <Tip content="Bohaterowie, których grali obaj"><span className="text-[9px] uppercase tracking-widest mr-1 cursor-help" style={{ color: C.muted }}>Wspólni</span></Tip>}
              {extra.shared.slice(0, 8).map(h => <Tip key={h} content={heroName(h)}><span><HeroImg heroId={h} className="w-12 h-7 rounded" /></span></Tip>)}
            </div>
            <div className="flex items-center gap-1">
              {extra.meetings.length > 0 && <Tip content="Gry przeciwko sobie (kolor = kto wygrał)"><span className="text-[9px] uppercase tracking-widest mr-1 cursor-help" style={{ color: C.muted }}>Starcia</span></Tip>}
              {extra.meetings.slice(-10).map(({ g, aWon }) => {
                const ap = mode === 'players' ? (A as PlayerX).perfs.find(p => p.game === g) : null;
                const bp = mode === 'players' ? (B as PlayerX).perfs.find(p => p.game === g) : null;
                return (
                  <Tip key={g.idx} content={<TipBody title={aWon ? `Wygrywa ${A!.name}` : `Wygrywa ${B!.name}`}>{ap && bp ? `${heroName(ap.heroId)} ${ap.kills}/${ap.deaths}/${ap.assists} vs ${heroName(bp.heroId)} ${bp.kills}/${bp.deaths}/${bp.assists} · ` : ''}{fmtClock(g.duration)}</TipBody>}>
                    <span className="w-3 h-6 rounded-sm" style={{ background: aWon ? SIDE[0] : SIDE[1] }} />
                  </Tip>
                );
              })}
            </div>
          </div>
        </div>

        <Corner side={1} entity={B} mode={mode} active={activeSide === 1} onDrop={id => set(1, id)} onActivate={() => setActiveSide(1)} />
      </div>

      {/* Pool: drag into a corner, or click to fill the highlighted one */}
      <div className="shrink-0 mt-3 flex items-center gap-2">
        <div ref={poolRef} className="flex-1 min-w-0 flex gap-1.5 justify-center">
          {slice.map(x => {
            const chosen = x.id === aId ? 0 : x.id === bId ? 1 : -1;
            return (
              <Tip key={x.id} content={tipFor(x)}>
                <button type="button" draggable onDragStart={e => e.dataTransfer.setData('text/plain', x.id)} onClick={() => set(activeSide, x.id)}
                  className="rounded-full transition-transform hover:scale-110 cursor-grab active:cursor-grabbing shrink-0"
                  style={{ opacity: chosen >= 0 ? 0.35 : 1 }}>
                  {mode === 'players' ? <Avatar player={x as PlayerX} size={38} ring={chosen >= 0 ? SIDE[chosen] : undefined} /> : <TeamLogo team={x as TeamX} size={38} />}
                </button>
              </Tip>
            );
          })}
        </div>
      </div>
      <Pager className="mt-1.5" page={page} pages={pages} onChange={setPage} />
    </>
  );
}

export default function D05Duel() {
  return <LabView><WithModel>{m => <Duel model={m} />}</WithModel></LabView>;
}
