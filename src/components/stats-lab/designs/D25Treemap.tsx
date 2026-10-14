'use client';

// #25 — Gold map. A treemap of where the tournament's resources went: every rectangle's area is
// a team's share (gold, kills, damage, wards or last hits). Click a team to zoom into its players,
// coloured by position.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, Perf } from '@/lib/stats-lab/derive';
import { Avatar, C, LabTitle, LabView, Seg, TeamLogo, Tip, TipBody, WithModel, ink, mix, useHeaderFont, useSize } from '../kit';

type MKey = 'gold' | 'kills' | 'dmg' | 'wards' | 'lh';
const MS: Record<MKey, { label: string; tip: string; get: (p: Perf) => number; fmt: (v: number) => string }> = {
  gold: { label: 'Złoto', tip: 'Całe zarobione złoto', get: p => p.totalGold, fmt: v => (v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : `${Math.round(v / 1000)}k`) },
  kills: { label: 'Zabójstwa', tip: 'Wszystkie zabójstwa', get: p => p.kills, fmt: v => String(Math.round(v)) },
  dmg: { label: 'Obrażenia', tip: 'Obrażenia zadane bohaterom', get: p => p.heroDamage, fmt: v => (v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : `${Math.round(v / 1000)}k`) },
  wards: { label: 'Wardy', tip: 'Postawione wardy', get: p => p.obsPlaced + p.senPlaced, fmt: v => String(Math.round(v)) },
  lh: { label: 'Last hity', tip: 'Dobite jednostki', get: p => p.lastHits, fmt: v => `${(v / 1000).toFixed(1)}k` },
};
const ROLE_COLOR: Record<string, string> = { Carry: '#e0af68', Mid: '#e5534b', Offlane: '#bb9af7', 'Soft Support': '#7aa2f7', 'Hard Support': '#73daca' };

interface Rect { x: number; y: number; w: number; h: number }
function squarify<T extends { value: number }>(items: T[], box: Rect): Array<T & Rect> {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total || box.w <= 0 || box.h <= 0) return [];
  const scale = (box.w * box.h) / total;
  let rem = items.filter(i => i.value > 0).map(i => ({ item: i, area: i.value * scale })).sort((a, b) => b.area - a.area);
  let { x, y, w, h } = box;
  const out: Array<T & Rect> = [];
  const worst = (row: typeof rem, side: number) => {
    const s = row.reduce((a, r) => a + r.area, 0); const mx = Math.max(...row.map(r => r.area)); const mn = Math.min(...row.map(r => r.area));
    return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
  };
  while (rem.length) {
    const side = Math.min(w, h);
    const row = [rem[0]];
    let i = 1;
    while (i < rem.length && worst([...row, rem[i]], side) <= worst(row, side)) { row.push(rem[i]); i++; }
    rem = rem.slice(row.length);
    const s = row.reduce((a, r) => a + r.area, 0);
    if (w >= h) {
      const cw = s / h; let cy = y;
      for (const r of row) { const rh = r.area / cw; out.push({ ...r.item, x, y: cy, w: cw, h: rh }); cy += rh; }
      x += cw; w -= cw;
    } else {
      const rh = s / w; let cx = x;
      for (const r of row) { const rw = r.area / rh; out.push({ ...r.item, x: cx, y, w: rw, h: rh }); cx += rw; }
      y += rh; h -= rh;
    }
  }
  return out;
}

function Treemap({ model }: { model: Model }) {
  const font = useHeaderFont();
  const [mk, setMk] = useState<MKey>('gold');
  const [teamId, setTeamId] = useState<string | null>(null);
  const [ref, size] = useSize<HTMLDivElement>();
  const m = MS[mk];

  const teamItems = useMemo(() => model.teams.map(t => ({ id: t.id, t, value: t.games.reduce((s, g) => s + g.perfs.reduce((a, p) => (p.tid === t.id ? a + m.get(p) : a), 0), 0) })), [model, m]);
  const total = teamItems.reduce((s, x) => s + x.value, 0);
  const team = teamId ? model.teamById.get(teamId) : null;
  const playerItems = useMemo(() => {
    if (!team) return [];
    const by = new Map<string, { id: string; value: number; perfs: number }>();
    for (const g of team.games) for (const p of g.perfs) {
      if (p.tid !== team.id) continue;
      const e = by.get(p.pid) ?? { id: p.pid, value: 0, perfs: 0 }; e.value += m.get(p); e.perfs++; by.set(p.pid, e);
    }
    return [...by.values()];
  }, [team, m]);
  const teamTotal = playerItems.reduce((s, x) => s + x.value, 0);

  const box = { x: 0, y: 0, w: size.w, h: size.h };
  const rects = team ? squarify(playerItems, box) : squarify(teamItems, box);
  const sorted = [...teamItems].sort((a, b) => b.value - a.value);

  return (
    <>
      <LabTitle
        sub={team
          ? <button type="button" onClick={() => setTeamId(null)} className="uppercase tracking-[0.25em] hover:underline">wszystkie drużyny ‹ {team.name}</button>
          : <span>{m.label}: {m.fmt(total)} · kliknij drużynę</span>}
        right={<Seg value={mk} onChange={setMk} options={(Object.keys(MS) as MKey[]).map(k => ({ value: k, label: MS[k].label, tip: MS[k].tip }))} />}
      >
        Mapa złota
      </LabTitle>
      <div ref={ref} className="relative flex-1 min-h-0 mt-3 rounded-2xl overflow-hidden">
        <AnimatePresence>
          {rects.map(r => {
            const isTeam = !team;
            const share = isTeam ? r.value / total : r.value / teamTotal;
            const rank = isTeam ? sorted.findIndex(x => x.id === r.id) : 0;
            const player = !isTeam ? model.playerById.get(r.id) : null;
            const bg = isTeam ? `color-mix(in srgb, ${C.primary} ${Math.round(70 - (rank / Math.max(1, sorted.length - 1)) * 50)}%, #111)` : mix(ROLE_COLOR[player?.role ?? ''] ?? C.muted, 55);
            const big = r.w > 110 && r.h > 70;
            const t = isTeam ? (r as unknown as { t: typeof model.teams[number] }).t : null;
            return (
              <motion.button key={`${team?.id ?? 'all'}-${r.id}`} type="button"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1, left: r.x, top: r.y, width: r.w, height: r.h }} exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 26 }}
                onClick={() => isTeam && setTeamId(r.id)}
                className="absolute p-[2px] text-left" style={{ cursor: isTeam ? 'zoom-in' : 'default' }}>
                <Tip content={<TipBody title={isTeam ? t?.name : player?.name ?? 'Gracz spoza składu'}>{m.label}: {m.fmt(r.value)} · {Math.round(share * 100)}%{!isTeam && player?.role ? ` · ${player.role}` : ''}</TipBody>}>
                  <div className="w-full h-full rounded-lg overflow-hidden relative flex flex-col justify-between p-2 text-white" style={{ background: bg }}>
                    <div className="flex items-center gap-2 min-w-0">
                      {isTeam ? <TeamLogo team={t} size={big ? 30 : 18} /> : <Avatar player={player ?? { name: '?' }} size={big ? 34 : 18} />}
                      {r.w > 80 && <span className="truncate text-xs font-bold drop-shadow">{isTeam ? t?.name : player?.name ?? '—'}</span>}
                    </div>
                    {r.h > 46 && r.w > 60 && (
                      <div>
                        <div className="font-logik-extended-bold tabular-nums leading-none drop-shadow" style={{ fontSize: Math.max(12, Math.min(34, Math.sqrt(r.w * r.h) / 7)), ...font }}>{m.fmt(r.value)}</div>
                        <div className="text-[10px] opacity-75 tabular-nums">{Math.round(share * 100)}%</div>
                      </div>
                    )}
                  </div>
                </Tip>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
      {team && (
        <div className="shrink-0 flex justify-center gap-4 mt-2 text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>
          {Object.entries(ROLE_COLOR).map(([r, c]) => <span key={r} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />{r}</span>)}
        </div>
      )}
    </>
  );
}

export default function D25Treemap() {
  return <LabView><WithModel>{m => <Treemap model={m} />}</WithModel></LabView>;
}
