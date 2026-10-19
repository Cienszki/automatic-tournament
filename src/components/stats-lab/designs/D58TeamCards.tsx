'use client';

// #58 — Team cards. FUT-style cards for teams: the rating is the team's Elo percentile, the six
// attributes are percentiles against the other teams (fighting, farm, vision, objectives,
// survival, tempo). Swipe or use ← →, click the front card to flip it to the roster — every
// player with their own rating.

import React, { useEffect, useMemo, useState } from 'react';
import { motion, type PanInfo } from 'framer-motion';
import type { Model, TeamX } from '@/lib/stats-lab/derive';
import { pctRank } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { fmtClock } from '@/lib/stats-lab/metrics';
import { eloTable } from '@/lib/stats-lab/teasers';
import { ROLE_LABEL } from '@/lib/stats-lab/season';
import { Avatar, C, HeroImg, LabTitle, LabView, Seg, TeamLogo, Tip, TipBody, WithModel, ink, mix, useHeaderFont, useSize } from '../kit';

const ATTRS: Array<{ abbr: string; name: string; desc: string; get: (t: TeamX) => number | null; low?: boolean; fmt: (v: number) => string }> = [
  { abbr: 'WAL', name: 'Walka', desc: 'Zabójstwa na grę', get: t => t.avg.kills, fmt: v => v.toFixed(1) },
  { abbr: 'FAR', name: 'Farma', desc: 'Suma GPM drużyny', get: t => t.avg.gpm, fmt: v => Math.round(v).toString() },
  { abbr: 'WIZ', name: 'Wizja', desc: 'Postawione wardy na grę', get: t => t.avg.wards || null, fmt: v => v.toFixed(1) },
  { abbr: 'CEL', name: 'Cele', desc: 'Obrażenia budynkom na grę', get: t => t.avg.towerDamage, fmt: v => `${(v / 1000).toFixed(1)}k` },
  { abbr: 'PRZ', name: 'Przetrwanie', desc: 'Śmierci na grę — mniej znaczy lepiej', get: t => t.avg.deaths, low: true, fmt: v => v.toFixed(1) },
  { abbr: 'TEM', name: 'Tempo', desc: 'Średni czas wygranej — szybciej znaczy lepiej', get: t => t.avg.winDuration, low: true, fmt: v => fmtClock(v) },
];
const TIERS = [
  { min: 80, name: 'Złota karta', color: '#f2c94c' },
  { min: 65, name: 'Srebrna karta', color: '#c9d1db' },
  { min: 0, name: 'Brązowa karta', color: '#c98a55' },
];

interface Card { t: TeamX; ovr: number; elo: number; attrs: Array<{ abbr: string; name: string; desc: string; score: number; raw: number | null; fmt: (v: number) => string }>; tier: typeof TIERS[number]; players: Array<{ p: TeamX['players'][number]; ovr: number }>; group?: string }

function build(model: Model): Card[] {
  const elo = eloTable(model);
  const eloOf = new Map(elo.map(e => [e.t.id, e.v]));
  const teams = model.teams.filter(t => t.games.length >= 2);
  const scorePool = model.players.filter(p => p.games >= model.minGames && p.agg.score.avg != null).map(p => p.agg.score.avg!);
  const groupOf = new Map<string, string>();
  for (const m of model.ds.matches) if (m.groupId) { groupOf.set(m.teamA, m.groupId); groupOf.set(m.teamB, m.groupId); }
  return teams.map(t => {
    const attrs = ATTRS.map(a => {
      const pool = teams.map(a.get).filter((v): v is number => v != null);
      const raw = a.get(t);
      const pr = raw == null ? 0 : pctRank(pool, raw);
      return { ...a, raw, score: raw == null ? 30 : Math.round(30 + 69 * (a.low ? 1 - pr : pr)) };
    });
    const e = eloOf.get(t.id) ?? 1500;
    const ovr = Math.round(45 + 54 * pctRank([...eloOf.values()], e));
    const players = t.players.filter(p => !p.standin).map(p => ({ p, ovr: p.agg.score.avg != null ? Math.round(45 + 54 * pctRank(scorePool, p.agg.score.avg)) : 0 })).sort((a, b) => b.ovr - a.ovr);
    return { t, ovr, elo: e, attrs, tier: TIERS.find(x => ovr >= x.min)!, players, group: groupOf.get(t.id) };
  }).sort((a, b) => b.ovr - a.ovr);
}

function CardFace({ c, w, h, flipped }: { c: Card; w: number; h: number; flipped: boolean }) {
  const font = useHeaderFont();
  const { t, tier } = c;
  const s = h / 470;
  const face: React.CSSProperties = {
    position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', borderRadius: 22, overflow: 'hidden',
    background: `linear-gradient(160deg, ${mix(tier.color, 26)} 0%, transparent 42%), linear-gradient(180deg, #15151c, #0b0b10)`,
    border: `1.5px solid ${mix(tier.color, 70)}`, boxShadow: `0 20px 50px rgba(0,0,0,0.5), inset 0 0 40px ${mix(tier.color, 10)}`,
  };
  return (
    <motion.div className="relative text-white" style={{ width: w, height: h, transformStyle: 'preserve-3d' }} animate={{ rotateY: flipped ? 180 : 0 }} transition={{ duration: 0.55 }}>
      <div style={face} className="flex flex-col">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full blur-3xl" style={{ background: mix(tier.color, 25) }} />
        <div className="relative flex px-4 pt-4" style={{ height: h * 0.44 }}>
          <div className="flex flex-col items-center pt-1 w-16 shrink-0">
            <Tip content={<TipBody title={`Ocena ${c.ovr}`}>{tier.name} · percentyl rankingu Elo ({Math.round(c.elo)})</TipBody>}>
              <span className="font-logik-extended-bold leading-none cursor-help" style={{ fontSize: 38 * s, color: tier.color, ...font }}>{c.ovr}</span>
            </Tip>
            <span className="mt-1 text-xs font-bold tracking-widest opacity-80">{t.tag ?? ''}</span>
            <div className="mt-2 flex flex-col gap-0.5">{t.form.slice(-5).map((w, i) => <span key={i} className="w-6 h-1.5 rounded-full" style={{ background: w ? C.win : C.loss }} />)}</div>
          </div>
          <div className="flex-1 flex items-center justify-center"><TeamLogo team={t} size={Math.round(160 * s)} /></div>
        </div>
        <div className="relative text-center px-3">
          <div className="font-logik-extended-bold uppercase truncate" style={{ fontSize: 22 * s, ...font }}>{t.name}</div>
          <div className="h-px mx-6 mt-1.5" style={{ background: `linear-gradient(90deg, transparent, ${tier.color}, transparent)` }} />
        </div>
        <div className="relative grid grid-cols-2 gap-x-6 gap-y-1.5 px-7 mt-3">
          {c.attrs.map(a => (
            <Tip key={a.abbr} content={<TipBody title={a.name}>{a.desc}: {a.raw == null ? '–' : a.fmt(a.raw)} — lepiej niż {Math.round(((a.score - 30) / 69) * 100)}% drużyn.</TipBody>}>
              <div className="flex items-center gap-2 cursor-help">
                <span className="font-logik-extended-bold tabular-nums w-8 text-right" style={{ fontSize: 20 * s, color: a.score >= 80 ? tier.color : undefined, ...font }}>{a.score}</span>
                <span className="text-xs tracking-widest opacity-70">{a.abbr}</span>
              </div>
            </Tip>
          ))}
        </div>
        <div className="flex-1" />
        <div className="relative flex justify-center gap-1.5 mb-2">
          {t.heroPicks.slice(0, 4).map(hu => (
            <Tip key={hu.heroId} content={`${heroName(hu.heroId)} · ${hu.games} gier · ${hu.wins} wygranych`}>
              <span><HeroImg heroId={hu.heroId} className="rounded-md" style={{ width: 44 * s, height: 25 * s }} /></span>
            </Tip>
          ))}
        </div>
        <div className="relative flex justify-center gap-3 pb-3 text-[10px] uppercase tracking-widest opacity-60">
          <span>{t.wins}–{t.losses} w grach</span><span>{t.series.w}–{t.series.d}–{t.series.l} mecze</span>
        </div>
      </div>
      {/* Back: roster */}
      <div style={{ ...face, transform: 'rotateY(180deg)' }} className="flex flex-col p-4 gap-2">
        <div className="flex items-center gap-3">
          <TeamLogo team={t} size={Math.round(48 * s)} />
          <div className="font-logik-extended-bold uppercase truncate" style={{ fontSize: 18 * s, ...font }}>{t.name}</div>
        </div>
        <div className="text-[10px] uppercase tracking-[0.25em] opacity-50">Skład</div>
        <div className="flex-1 flex flex-col justify-around">
          {c.players.slice(0, 6).map(({ p, ovr }) => (
            <div key={p.id} className="flex items-center gap-3">
              <span className="w-9 text-center font-logik-extended-bold tabular-nums" style={{ fontSize: 20 * s, color: ovr >= 80 ? '#f2c94c' : ovr >= 65 ? '#c9d1db' : '#c98a55', ...font }}>{ovr || '–'}</span>
              <Avatar player={p} size={Math.round(44 * s)} />
              <div className="flex-1 min-w-0"><div className="font-bold truncate" style={{ fontSize: 15 * s }}>{p.name}</div><div className="text-[11px] opacity-60 truncate">{p.role ? ROLE_LABEL[p.role] : '—'} · {p.games} gier</div></div>
              {p.heroes[0] && <HeroImg heroId={p.heroes[0].heroId} className="rounded" style={{ width: 40 * s, height: 23 * s }} />}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function Deck({ model }: { model: Model }) {
  const all = useMemo(() => build(model), [model]);
  const groups = useMemo(() => (model.ds.groups ?? []).filter(g => all.some(c => c.group === g.id)), [model, all]);
  const [grp, setGrp] = useState('all');
  const cards = useMemo(() => all.filter(c => grp === 'all' || c.group === grp), [all, grp]);
  const [i, setI] = useState(2);
  const [flipped, setFlipped] = useState(false);
  const [ref, size] = useSize<HTMLDivElement>();
  useEffect(() => { setI(Math.min(2, Math.max(0, cards.length - 1))); setFlipped(false); }, [grp, cards.length]);
  const go = (d: number) => { setFlipped(false); setI(x => Math.max(0, Math.min(cards.length - 1, x + d))); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const h = Math.min(size.h - 8, 480);
  const w = h * 0.68;

  return (
    <>
      <LabTitle sub={<span>{cards.length ? `${i + 1} / ${cards.length}` : 0} kart · kliknij kartę, by zobaczyć skład</span>}
        right={groups.length > 1 && <Seg size="sm" value={grp} onChange={setGrp} options={[{ value: 'all', label: 'Wszystkie' }, ...groups.map(g => ({ value: g.id, label: g.name }))]} />}>
        Karty drużyn
      </LabTitle>
      <div ref={ref} className="relative flex-1 min-h-0 mt-2" style={{ perspective: 1400 }}>
        {size.h > 0 && cards.map((c, idx) => {
          const d = idx - i; const ad = Math.abs(d);
          if (ad > 3) return null;
          return (
            <motion.div key={c.t.id} className="absolute left-1/2 top-1/2"
              style={{ width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2, zIndex: 10 - ad, cursor: d === 0 ? 'grab' : 'pointer' }}
              initial={false}
              animate={{ x: d * w * 0.62 + Math.sign(d) * (ad > 1 ? w * 0.12 * (ad - 1) : 0), scale: 1 - ad * 0.13, rotateY: d * -18, opacity: ad === 3 ? 0 : 1 - ad * 0.22, filter: ad ? 'brightness(0.55)' : 'brightness(1)' }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              drag={d === 0 ? 'x' : false} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.6}
              onDragEnd={(_e: unknown, info: PanInfo) => { if (info.offset.x < -60) go(1); else if (info.offset.x > 60) go(-1); }}
              onTap={() => (d === 0 ? setFlipped(f => !f) : go(d))}>
              <CardFace c={c} w={w} h={h} flipped={d === 0 && flipped} />
            </motion.div>
          );
        })}
        {cards.length > 1 && (
          <>
            <button type="button" aria-label="Poprzednia karta" onClick={() => go(-1)} disabled={i === 0} className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full text-xl disabled:opacity-20" style={{ background: ink(8) }}>‹</button>
            <button type="button" aria-label="Następna karta" onClick={() => go(1)} disabled={i >= cards.length - 1} className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full text-xl disabled:opacity-20" style={{ background: ink(8) }}>›</button>
          </>
        )}
      </div>
      {/* quick jump: logos in rating order */}
      <div className="shrink-0 flex justify-center gap-1.5 mt-3 flex-wrap">
        {cards.map((c, idx) => (
          <Tip key={c.t.id} content={`${c.t.name} · ${c.ovr}`}>
            <button type="button" onClick={() => { setFlipped(false); setI(idx); }} className="rounded-xl p-1 transition-all"
              style={{ background: idx === i ? mix(C.primary, 40) : ink(5), boxShadow: idx === i ? `0 0 0 2px ${C.secondary}` : undefined }}>
              <TeamLogo team={c.t} size={34} />
            </button>
          </Tip>
        ))}
      </div>
    </>
  );
}

export default function D58TeamCards() {
  return <LabView><WithModel>{m => <Deck model={m} />}</WithModel></LabView>;
}
