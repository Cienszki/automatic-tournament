'use client';

// #8 — Achievements. Every achievement is a medallion with three arcs (bronze / silver / gold)
// that light up once somebody reaches that tier — an unlit gold arc is an open invitation.
// Click a medallion for its holders and who is closest to the next tier.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { collectorRanking, computeAchievements, descOf, fmtThreshold, TIER_GEN, TIER_NAME, TIER_POINTS, type AchievementState, type Tier } from '@/lib/stats-lab/achievements';
import { opponentOf, type Model } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { Avatar, C, HeroImg, LabTitle, LabView, Pager, Tip, TipBody, WithModel, ink, mix, playerTip, useFitCount, useHeaderFont, useMetals, usePages, useSize } from '../kit';

const fmtV = (v: number) => (v >= 10000 ? `${(v / 1000).toFixed(v >= 100000 ? 0 : 1)}k` : v.toLocaleString('pl-PL'));

function Medal({ s, size, selected, onClick }: { s: AchievementState; size: number; selected: boolean; onClick: () => void }) {
  const TIER_COLOR = useMetals();
  const font = useHeaderFont();
  const top = (s.byTier[2] ? 2 : s.byTier[1] ? 1 : s.byTier[0] ? 0 : -1) as Tier | -1;
  const topColor = top >= 0 ? TIER_COLOR[top as Tier] : null;
  const r = size / 2 - 6; const c = size / 2;
  const arc = (i: number) => {
    const a0 = (i * 120 - 90 + 6) * (Math.PI / 180); const a1 = ((i + 1) * 120 - 90 - 6) * (Math.PI / 180);
    return `M${c + Math.cos(a0) * r},${c + Math.sin(a0) * r} A${r},${r} 0 0 1 ${c + Math.cos(a1) * r},${c + Math.sin(a1) * r}`;
  };
  const tierLine = ([0, 1, 2] as Tier[]).map(t => `${TIER_NAME[t]} ≥ ${fmtThreshold(s.a, t)}${s.a.unit ? ` ${s.a.unit}` : ''}: ${s.byTier[t] || 'nikt'}`).join(' · ');
  const value = s.a.id === 'multi' ? (['–', 'Triple', 'Ultra', 'Rampage'][s.best] ?? '–') : fmtV(s.best);
  return (
    <Tip content={<TipBody title={s.a.name}>{descOf(s.a)}. {tierLine}</TipBody>}>
      <motion.button type="button" onClick={onClick} whileHover={{ scale: 1.06 }} className="flex flex-col items-center gap-1 min-w-0" style={{ opacity: top < 0 ? 0.45 : 1 }}>
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="absolute inset-0">
            {selected && <circle cx={c} cy={c} r={r + 4} fill="none" stroke={C.text} strokeOpacity={0.5} strokeWidth={1} />}
            <circle cx={c} cy={c} r={r - 7} fill={topColor ? mix(topColor, 12) : ink(4)} />
            {([0, 1, 2] as Tier[]).map(t => (
              <path key={t} d={arc(t)} fill="none" strokeWidth={6} strokeLinecap="round"
                stroke={s.byTier[t] ? TIER_COLOR[t] : ink(10)} style={{ filter: s.byTier[t] ? `drop-shadow(0 0 4px ${TIER_COLOR[t]})` : undefined }} />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-logik-extended-bold tabular-nums leading-none" style={{ fontSize: size * (value.length > 5 ? 0.13 : value.length > 3 ? 0.17 : 0.24), color: topColor ?? C.muted, ...font }}>{value}</span>
            <span className="text-[10px] tabular-nums mt-0.5" style={{ color: C.muted }}>{s.unlocks.length ? `${s.unlocks.length} os.` : ''}</span>
          </div>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-center leading-tight whitespace-nowrap" style={{ color: selected ? C.text : C.muted }}>{s.a.name}</span>
      </motion.button>
    </Tip>
  );
}

function Detail({ model, s, onBack }: { model: Model; s: AchievementState; onBack: () => void }) {
  const TIER_COLOR = useMetals();
  const font = useHeaderFont();
  // Closest to the next tier among players who have not reached gold yet
  const chasers = useMemo(() => {
    const out: Array<{ name: string; player: (typeof model.players)[number]; value: number; next: Tier; gap: number }> = [];
    for (const player of model.players) {
      const v = s.a.scope === 'career' ? s.a.value({ player }) : Math.max(0, ...player.perfs.filter(p => !s.a.parsedOnly || p.parsed).map(perf => s.a.value({ perf })));
      const next = ([0, 1, 2] as Tier[]).find(t => v < s.a.thresholds[t]);
      if (next == null) continue;
      out.push({ name: player.name, player, value: v, next, gap: s.a.thresholds[next] - v });
    }
    return out.sort((a, b) => b.next - a.next || a.gap / s.a.thresholds[a.next] - b.gap / s.a.thresholds[b.next]).slice(0, 3);
  }, [model, s]);

  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="h-full flex flex-col gap-2 min-h-0">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-2xl font-logik-extended-bold uppercase leading-none" style={{ color: C.heading, ...font }}>{s.a.name}</div>
          <div className="text-[11px] mt-1" style={{ color: C.muted }}>{descOf(s.a)}{s.a.scope === 'career' ? ' (cały turniej)' : ''}</div>
        </div>
        <button type="button" onClick={onBack} aria-label="Wróć do kolekcjonerów" className="w-7 h-7 shrink-0 rounded-full" style={{ background: ink(8) }}>×</button>
      </div>
      {([2, 1, 0] as Tier[]).map(t => {
        const list = s.unlocks.filter(u => u.tier === t);
        return (
          <div key={t} className="rounded-xl p-2" style={{ background: mix(TIER_COLOR[t], list.length ? 10 : 3), border: `1px solid ${mix(TIER_COLOR[t], list.length ? 40 : 12)}` }}>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest mb-1">
              <span style={{ color: TIER_COLOR[t] }}>{TIER_NAME[t]} · ≥ {fmtThreshold(s.a, t)}</span>
              <span style={{ color: C.muted }}>+{TIER_POINTS[t]} pkt</span>
            </div>
            {list.length ? (
              <div className="flex flex-wrap gap-1.5">
                {list.slice(0, 12).map(u => (
                  <Tip key={u.player.id} content={<TipBody title={u.player.name}>{fmtV(u.value)}{u.perf ? ` · ${heroName(u.perf.heroId)} vs ${opponentOf(u.perf)?.name ?? '?'}` : ''}{u.times > 1 ? ` · ${u.times}× w turnieju` : ''}</TipBody>}>
                    <span className="relative">
                      <Avatar player={u.player} size={26} ring={TIER_COLOR[t]} />
                      {u.perf && <HeroImg heroId={u.perf.heroId} variant="icon" className="absolute -bottom-1 -right-1 w-3.5 h-3.5" />}
                    </span>
                  </Tip>
                ))}
                {list.length > 12 && <span className="text-[11px] self-center" style={{ color: C.muted }}>+{list.length - 12}</span>}
              </div>
            ) : <div className="text-[11px] italic" style={{ color: C.muted }}>Nikt jeszcze — możesz być pierwszy</div>}
          </div>
        );
      })}
      {chasers.length > 0 && (
        <div className="mt-1">
          <Tip content="Najbliżej następnego progu"><div className="text-[9px] uppercase tracking-[0.25em] mb-1 cursor-help" style={{ color: C.muted }}>W pościgu</div></Tip>
          {chasers.map(ch => (
            <div key={ch.player.id} className="flex items-center gap-2 text-xs py-0.5">
              <Avatar player={ch.player} size={20} />
              <span className="flex-1 truncate">{ch.name}</span>
              <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: ink(10) }}>
                <div className="h-full" style={{ width: `${(ch.value / s.a.thresholds[ch.next]) * 100}%`, background: TIER_COLOR[ch.next] }} />
              </div>
              <span className="w-24 text-right text-[10px] tabular-nums" style={{ color: C.muted }}>{fmtV(ch.gap)} do {TIER_GEN[ch.next]}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function Collectors({ ranking }: { ranking: ReturnType<typeof collectorRanking> }) {
  const TIER_COLOR = useMetals();
  const font = useHeaderFont();
  const [ref, per] = useFitCount<HTMLDivElement>(58, 6, 3);
  const { page, pages, setPage, slice, offset } = usePages(ranking, per);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col min-h-0">
      <Tip content={`Punkty: brąz ${TIER_POINTS[0]}, srebro ${TIER_POINTS[1]}, złoto ${TIER_POINTS[2]}`}>
        <div className="text-2xl font-logik-extended-bold uppercase leading-none cursor-help self-start" style={{ color: C.heading, ...font }}>Kolekcjonerzy</div>
      </Tip>
      <div ref={ref} className="flex-1 min-h-0 flex flex-col gap-1.5 mt-3">
        {slice.map((e, i) => {
          const podium = offset + i < 3 ? TIER_COLOR[2 - (offset + i)] : null;
          return (
            <div key={e.player.id} className="h-[58px] shrink-0 flex items-center gap-3 px-1" style={{ borderBottom: `1px solid ${ink(7)}` }}>
              <span className="w-7 text-right text-lg font-logik-extended-bold tabular-nums" style={{ color: podium ?? C.muted, ...font }}>{offset + i + 1}</span>
              <Tip content={playerTip(e.player)}><span><Avatar player={e.player} size={46} ring={podium ?? undefined} /></span></Tip>
              <div className="flex-1 min-w-0">
                <div className="truncate text-base font-bold">{e.player.name}</div>
                <div className="flex gap-[3px] mt-1">
                  {([2, 1, 0] as Tier[]).map(t => Array.from({ length: e.tiers[t] }, (_, k) => <span key={`${t}-${k}`} className="w-2 h-3.5 rounded-sm" style={{ background: TIER_COLOR[t] }} />))}
                </div>
              </div>
              <span className="w-12 text-right text-2xl font-bold tabular-nums" style={font}>{e.points}</span>
            </div>
          );
        })}
      </div>
      <Pager className="mt-2" page={page} pages={pages} onChange={setPage} />
    </motion.div>
  );
}

/**
 * Organic "trophy constellation": circles packed along a spiral (stretched to the box's aspect),
 * then scaled to fit. Deterministic, so medals don't jump between renders.
 */
function packCircles(radii: number[], w: number, h: number, gap: number) {
  const aspect = Math.max(0.6, Math.min(2.4, w / Math.max(1, h)));
  const placed: Array<{ x: number; y: number; r: number }> = [];
  radii.forEach((r, i) => {
    if (i === 0) { placed.push({ x: 0, y: 0, r }); return; }
    for (let t = 0; t < 40000; t++) {
      const ang = t * 0.09; const dist = t * 0.012;
      const x = Math.cos(ang) * dist * Math.sqrt(aspect); const y = Math.sin(ang) * dist / Math.sqrt(aspect);
      if (placed.every(p => Math.hypot(p.x - x, p.y - y) >= p.r + r + gap)) { placed.push({ x, y, r }); return; }
    }
    placed.push({ x: 0, y: 0, r });
  });
  const minX = Math.min(...placed.map(p => p.x - p.r)); const maxX = Math.max(...placed.map(p => p.x + p.r));
  const minY = Math.min(...placed.map(p => p.y - p.r)); const maxY = Math.max(...placed.map(p => p.y + p.r));
  const k = Math.min(w / (maxX - minX), h / (maxY - minY));
  return placed.map(p => ({ x: (p.x - (minX + maxX) / 2) * k + w / 2, y: (p.y - (minY + maxY) / 2) * k + h / 2, r: p.r * k }));
}

function Board({ model }: { model: Model }) {
  const states = useMemo(() => computeAchievements(model), [model]);
  const ranking = useMemo(() => collectorRanking(states), [states]);
  const [sel, setSel] = useState<string | null>(null);
  const [ref, size] = useSize<HTMLDivElement>();
  const lit = states.reduce((n, s) => n + s.byTier.filter(Boolean).length, 0);
  const selected = states.find(s => s.a.id === sel);

  // Rarer achievements are drawn bigger: they are the ones worth chasing
  const order = useMemo(() => {
    const n = Math.max(1, model.players.length);
    return states.map(s => ({ s, r: 1 + 0.75 * (1 - Math.min(1, s.unlocks.length / (n * 0.35))) })).sort((a, b) => b.r - a.r);
  }, [states, model.players.length]);
  const spots = useMemo(() => (size.w > 0 ? packCircles(order.map(o => o.r), size.w, size.h, 0.16) : []), [order, size.w, size.h]);

  return (
    <>
      <LabTitle sub={<Tip content="Ile progów (brąz / srebro / złoto) ktokolwiek już zdobył"><span className="cursor-help">{lit} / {states.length * 3} progów zdobytych</span></Tip>}>Osiągnięcia</LabTitle>
      <div className="flex-1 min-h-0 flex gap-6 mt-3">
        <div ref={ref} className="relative flex-[1.7] min-w-0 min-h-0">
          {spots.map((p, i) => {
            const { s } = order[i];
            const label = 20; // room for the name under the medal
            const medal = Math.max(44, p.r * 2 - label);
            return (
              <motion.div key={s.a.id} className="absolute" style={{ left: p.x - medal / 2, top: p.y - (medal + label) / 2, width: medal }}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1, y: [0, -5, 0, 4, 0], rotate: [0, (i % 2 ? 1.5 : -1.5), 0] }}
                transition={{ opacity: { delay: i * 0.03 }, scale: { delay: i * 0.03, type: 'spring', stiffness: 160, damping: 14 }, y: { duration: 5 + (i % 5), repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }, rotate: { duration: 7 + (i % 3), repeat: Infinity, ease: 'easeInOut' } }}>
                <Medal s={s} size={medal} selected={s.a.id === sel} onClick={() => setSel(x => (x === s.a.id ? null : s.a.id))} />
              </motion.div>
            );
          })}
        </div>
        <div className="flex-1 min-w-[320px] max-w-[440px] min-h-0 hidden md:block">
          <AnimatePresence mode="wait">
            {selected ? <Detail key={selected.a.id} model={model} s={selected} onBack={() => setSel(null)} /> : <Collectors key="col" ranking={ranking} />}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

export default function D08Achievements() {
  return <LabView><WithModel>{m => <Board model={m} />}</WithModel></LabView>;
}
