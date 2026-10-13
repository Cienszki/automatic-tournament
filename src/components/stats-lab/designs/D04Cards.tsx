'use client';

// #4 — Player cards. A fanned deck of FUT-style cards: overall rating + six attributes, all
// percentiles among qualified players. Drag / swipe or use ← → to browse, click to flip the
// card for signature heroes, best game and recent form.

import React, { useEffect, useMemo, useState } from 'react';
import { motion, type PanInfo } from 'framer-motion';
import { metric, type MetricKey } from '@/lib/stats-lab/metrics';
import { opponentOf, pctRank, topPerfs, type Model, type PlayerX } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { Avatar, C, HeroImg, LabTitle, LabView, Seg, TeamLogo, Tip, TipBody, WithModel, ink, mix, useHeaderFont, useSize } from '../kit';

const ATTRS: Array<{ key: MetricKey; abbr: string; name: string }> = [
  { key: 'kda', abbr: 'WAL', name: 'Walka' },
  { key: 'gpm', abbr: 'FAR', name: 'Farma' },
  { key: 'xpm', abbr: 'ROZ', name: 'Rozwój' },
  { key: 'hdpm', abbr: 'OBR', name: 'Obrażenia' },
  { key: 'wards', abbr: 'WIZ', name: 'Wizja' },
  { key: 'kp', abbr: 'DRU', name: 'Drużynowość' },
];
const POS: Record<string, string> = { Carry: '1', Mid: '2', Offlane: '3', 'Soft Support': '4', 'Hard Support': '5' };
const TIERS = [
  { min: 80, name: 'Złota karta', color: '#f2c94c' },
  { min: 65, name: 'Srebrna karta', color: '#c9d1db' },
  { min: 0, name: 'Brązowa karta', color: '#c98a55' },
];

interface CardData {
  p: PlayerX;
  ovr: number;
  attrs: Array<{ abbr: string; name: string; key: MetricKey; score: number; raw: number }>;
  tier: typeof TIERS[number];
  records: MetricKey[];
}

function buildCards(model: Model): CardData[] {
  const q = model.players.filter(p => p.games >= model.minGames);
  const fant = q.map(p => p.agg.fantasy.avg ?? 0);
  const pools = Object.fromEntries(ATTRS.map(a => [a.key, q.map(p => p.agg[a.key].avg ?? 0)]));
  const recordKeys: MetricKey[] = ['kills', 'assists', 'kda', 'gpm', 'xpm', 'lastHits', 'heroDamage', 'towerDamage', 'wards', 'dewards', 'stacks', 'heroHealing', 'netWorth', 'fantasy'];
  const holders = new Map<string, MetricKey[]>();
  for (const k of recordKeys) {
    const rec = topPerfs(model, k, 1)[0];
    if (rec?.player) holders.set(rec.pid, [...(holders.get(rec.pid) ?? []), k]);
  }
  return q.map(p => {
    const ovr = Math.round(45 + 54 * pctRank(fant, p.agg.fantasy.avg ?? 0));
    return {
      p, ovr,
      tier: TIERS.find(t => ovr >= t.min)!,
      attrs: ATTRS.map(a => ({ ...a, raw: p.agg[a.key].avg ?? 0, score: Math.round(30 + 69 * pctRank(pools[a.key], p.agg[a.key].avg ?? 0)) })),
      records: holders.get(p.id) ?? [],
    };
  }).sort((a, b) => b.ovr - a.ovr || b.p.games - a.p.games);
}

function CardFace({ c, w, h, flipped }: { c: CardData; w: number; h: number; flipped: boolean }) {
  const font = useHeaderFont();
  const { p, tier } = c;
  const best = p.agg.fantasy.best;
  const face: React.CSSProperties = {
    position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', borderRadius: 22, overflow: 'hidden',
    background: `linear-gradient(160deg, ${mix(tier.color, 26)} 0%, transparent 42%), linear-gradient(180deg, #15151c, #0b0b10)`,
    border: `1.5px solid ${mix(tier.color, 70)}`, boxShadow: `0 20px 50px rgba(0,0,0,0.5), inset 0 0 40px ${mix(tier.color, 10)}`,
  };
  const s = h / 460; // scale fonts with card size
  return (
    <motion.div className="relative text-white" style={{ width: w, height: h, transformStyle: 'preserve-3d' }} animate={{ rotateY: flipped ? 180 : 0 }} transition={{ duration: 0.55 }}>
      {/* Front */}
      <div style={face} className="flex flex-col">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full blur-3xl" style={{ background: mix(tier.color, 25) }} />
        <div className="relative flex px-4 pt-4" style={{ height: h * 0.46 }}>
          <div className="flex flex-col items-center pt-1 w-16 shrink-0">
            <Tip content={<TipBody title={`Ocena ogólna ${c.ovr}`}>{tier.name} · percentyl średnich punktów fantasy ({(p.agg.fantasy.avg ?? 0).toFixed(1)} na grę)</TipBody>}>
              <span className="font-logik-extended-bold leading-none cursor-help" style={{ fontSize: 38 * s, color: tier.color, ...font }}>{c.ovr}</span>
            </Tip>
            {p.role && <Tip content={p.role}><span className="mt-1 text-xs font-bold tracking-widest opacity-80 cursor-help">POZ {POS[p.role] ?? '–'}</span></Tip>}
            <div className="mt-2"><TeamLogo team={p.team} size={28 * s} /></div>
          </div>
          <div className="flex-1 flex items-end justify-center">
            <Avatar player={p} size={Math.round(150 * s)} ring={mix(tier.color, 80)} />
          </div>
        </div>
        <div className="relative text-center mt-2 px-3">
          <div className="font-logik-extended-bold uppercase truncate" style={{ fontSize: 22 * s, ...font }}>{p.name}</div>
          <div className="h-px mx-6 mt-1.5" style={{ background: `linear-gradient(90deg, transparent, ${tier.color}, transparent)` }} />
        </div>
        <div className="relative grid grid-cols-2 gap-x-6 gap-y-1.5 px-7 mt-3">
          {c.attrs.map(a => {
            const m = metric(a.key);
            return (
              <Tip key={a.abbr} content={<TipBody title={`${a.name} · ${m.label}`}>{m.desc}. Średnio {a.key === 'kp' ? m.fmt(a.raw) : a.raw.toFixed(m.avgDigits)} — lepiej niż {Math.round(((a.score - 30) / 69) * 100)}% graczy.</TipBody>}>
                <div className="flex items-center gap-2 cursor-help">
                  <span className="font-logik-extended-bold tabular-nums w-8 text-right" style={{ fontSize: 20 * s, color: a.score >= 80 ? tier.color : undefined, ...font }}>{a.score}</span>
                  <span className="text-xs tracking-widest opacity-70">{a.abbr}</span>
                </div>
              </Tip>
            );
          })}
        </div>
        <div className="flex-1" />
        <div className="relative flex justify-center gap-1.5 mb-2">
          {p.heroes.slice(0, 4).map(hu => (
            <Tip key={hu.heroId} content={`${heroName(hu.heroId)} · ${hu.games} gier · ${hu.wins} wygranych`}>
              <span><HeroImg heroId={hu.heroId} className="rounded-md" style={{ width: 44 * s, height: 25 * s }} /></span>
            </Tip>
          ))}
        </div>
        <div className="relative flex justify-center gap-3 pb-3 text-[10px] uppercase tracking-widest opacity-60">
          <span>{p.games} gier</span><span>{Math.round(p.wr * 100)}% W</span>
        </div>
      </div>

      {/* Back */}
      <div style={{ ...face, transform: 'rotateY(180deg)' }} className="flex flex-col p-4 gap-3">
        <div className="flex items-center gap-2">
          <Avatar player={p} size={34} ring={tier.color} />
          <div className="min-w-0"><div className="font-bold truncate">{p.name}</div><div className="text-[10px] opacity-60 truncate">{p.team?.name}</div></div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-[0.25em] opacity-50 mb-1">Bohaterowie</div>
          <div className="grid grid-cols-3 gap-1.5">
            {p.heroes.slice(0, 3).map(hu => (
              <Tip key={hu.heroId} content={`${heroName(hu.heroId)} · ${hu.wins}-${hu.games - hu.wins}`}>
                <div className="relative rounded-lg overflow-hidden">
                  <HeroImg heroId={hu.heroId} className="w-full aspect-video" />
                  <span className="absolute bottom-0 inset-x-0 text-center text-[10px] font-bold bg-black/60">{hu.wins}-{hu.games - hu.wins}</span>
                </div>
              </Tip>
            ))}
          </div>
        </div>
        {best && (
          <div>
            <div className="text-[9px] uppercase tracking-[0.25em] opacity-50 mb-1">Najlepsza gra</div>
            <div className="relative rounded-lg overflow-hidden h-16">
              <HeroImg heroId={best.heroId} className="absolute inset-0 w-full h-full opacity-60" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-transparent" />
              <div className="relative h-full flex flex-col justify-center px-3">
                <span className="font-bold tabular-nums" style={{ fontSize: 18 * s }}>{best.kills}/{best.deaths}/{best.assists}</span>
                <span className="text-[10px] opacity-70">{best.gpm} GPM · vs {opponentOf(best)?.name}</span>
              </div>
            </div>
          </div>
        )}
        <div>
          <div className="text-[9px] uppercase tracking-[0.25em] opacity-50 mb-1">Forma</div>
          <Tip content="Ostatnie gry, od najstarszej do najnowszej">
            <div className="flex gap-1 cursor-help">{p.perfs.slice(-12).map(x => <span key={x.idx} className="flex-1 h-4 rounded-sm" style={{ background: x.win ? C.win : C.loss }} />)}</div>
          </Tip>
        </div>
        {c.records.length > 0 && (
          <Tip content={<TipBody title="Rekordy turnieju">{c.records.map(k => metric(k).label).join(', ')}</TipBody>}>
            <div className="rounded-lg px-3 py-2 text-center cursor-help" style={{ background: mix(tier.color, 18), color: tier.color }}>
              <span className="font-logik-extended-bold text-lg" style={font}>{c.records.length}</span> <span className="text-xs uppercase tracking-widest">rekord{c.records.length === 1 ? '' : c.records.length < 5 ? 'y' : 'ów'}</span>
            </div>
          </Tip>
        )}
      </div>
    </motion.div>
  );
}

function Deck({ model }: { model: Model }) {
  const all = useMemo(() => buildCards(model), [model]);
  const [pos, setPos] = useState('all');
  const [team, setTeam] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ref, size] = useSize<HTMLDivElement>();

  const cards = useMemo(() => all.filter(c => (pos === 'all' || POS[c.p.role ?? ''] === pos) && (!team || c.p.teamId === team)), [all, pos, team]);
  useEffect(() => { setI(0); setFlipped(false); }, [pos, team]);
  const go = (d: number) => { setFlipped(false); setI(x => Math.max(0, Math.min(cards.length - 1, x + d))); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const h = Math.min(size.h - 8, 470);
  const w = h * 0.68;
  const teams = useMemo(() => model.teams.filter(t => all.some(c => c.p.teamId === t.id)), [model, all]);

  return (
    <>
      <LabTitle
        sub={<Tip content={`Karty mają gracze z co najmniej ${model.minGames} grami. Oceny to percentyle wśród nich.`}><span className="cursor-help">{cards.length ? `${i + 1} / ${cards.length}` : '0'} kart</span></Tip>}
        right={<Seg size="sm" value={pos} onChange={setPos} options={[{ value: 'all', label: 'Wszyscy' }, ...Object.entries(POS).map(([role, n]) => ({ value: n, label: n, tip: role }))]} />}
      >
        Karty
      </LabTitle>
      <div ref={ref} className="relative flex-1 min-h-0 mt-2" style={{ perspective: 1400 }}>
        {size.h > 0 && cards.map((c, idx) => {
          const d = idx - i;
          if (Math.abs(d) > 3) return null;
          const ad = Math.abs(d);
          return (
            <motion.div
              key={c.p.id}
              className="absolute left-1/2 top-1/2"
              style={{ width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2, zIndex: 10 - ad, cursor: d === 0 ? 'grab' : 'pointer' }}
              initial={false}
              animate={{ x: d * w * 0.62 + Math.sign(d) * (ad > 1 ? w * 0.12 * (ad - 1) : 0), scale: 1 - ad * 0.13, rotateY: d * -18, opacity: ad === 3 ? 0 : 1 - ad * 0.22, filter: ad ? 'brightness(0.55)' : 'brightness(1)' }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              drag={d === 0 ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.6}
              onDragEnd={(_e: unknown, info: PanInfo) => { if (info.offset.x < -60) go(1); else if (info.offset.x > 60) go(-1); }}
              onTap={() => (d === 0 ? setFlipped(f => !f) : go(d))}
            >
              <CardFace c={c} w={w} h={h} flipped={d === 0 && flipped} />
            </motion.div>
          );
        })}
        {cards.length > 1 && (
          <>
            <button type="button" aria-label="Poprzednia karta" onClick={() => go(-1)} disabled={i === 0} className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full text-xl disabled:opacity-20" style={{ background: ink(8) }}>‹</button>
            <button type="button" aria-label="Następna karta" onClick={() => go(1)} disabled={i >= cards.length - 1} className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full text-xl disabled:opacity-20" style={{ background: ink(8) }}>›</button>
          </>
        )}
      </div>
      {/* Team filter */}
      <div className="shrink-0 flex justify-center flex-wrap gap-1.5 mt-2">
        {teams.map(t => (
          <Tip key={t.id} content={t.name}>
            <button type="button" onClick={() => setTeam(x => (x === t.id ? null : t.id))} className="rounded-lg p-1 transition-all"
              style={{ background: team === t.id ? mix(C.primary, 40) : ink(4), opacity: team && team !== t.id ? 0.35 : 1 }}>
              <TeamLogo team={t} size={22} />
            </button>
          </Tip>
        ))}
      </div>
    </>
  );
}

export default function D04Cards() {
  return <LabView><WithModel>{m => <Deck model={m} />}</WithModel></LabView>;
}
