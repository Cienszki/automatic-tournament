'use client';

// #16 — Player dossier. Pick a team, then a player. A radar compares them with players of the
// same position (dashed shape = position median), the game log shows every game as a tile, the
// donut is their hero pool and personal bests carry their rank in the whole tournament.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { fmtClock, metric, type MetricKey } from '@/lib/stats-lab/metrics';
import { opponentOf, pctRank, type Model, type PlayerX } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { Avatar, C, HeroImg, LabView, Pager, TeamLogo, Tip, TipBody, WithModel, ink, mix, useFitCount, useHeaderFont, usePages, useSize } from '../kit';

const AXES: Array<{ key: MetricKey; label: string; invert?: boolean }> = [
  { key: 'kda', label: 'Walka' },
  { key: 'gpm', label: 'Farma' },
  { key: 'hdpm', label: 'Obrażenia' },
  { key: 'wards', label: 'Wizja' },
  { key: 'kp', label: 'Drużyna' },
  { key: 'deaths', label: 'Przeżycie', invert: true },
];
const PB: MetricKey[] = ['kills', 'assists', 'gpm', 'xpm', 'heroDamage', 'lastHits', 'wards', 'fantasy'];
const PALETTE = ['var(--tournament-primary)', 'var(--tournament-secondary)', '#7aa2f7', '#9ece6a', '#bb9af7', '#e0af68', 'rgba(150,150,150,0.5)'];

function Radar({ model, p }: { model: Model; p: PlayerX }) {
  const [ref, size] = useSize<HTMLDivElement>();
  const peers = useMemo(() => model.players.filter(x => x.games >= Math.max(2, model.minGames / 2) && (!p.role || x.role === p.role)), [model, p.role]);
  const vals = AXES.map(a => {
    const pool = peers.map(x => x.agg[a.key].avg ?? 0);
    const r = pctRank(pool, p.agg[a.key].avg ?? 0);
    return { ...a, pct: a.invert ? 1 - r : r, raw: p.agg[a.key].avg ?? 0 };
  });
  const S = Math.min(size.w, size.h); const cx = size.w / 2; const cy = size.h / 2; const R = S / 2 - 26;
  const pt = (i: number, f: number) => { const a = (i / AXES.length) * Math.PI * 2 - Math.PI / 2; return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f]; };
  const poly = (fs: number[]) => fs.map((f, i) => pt(i, Math.max(0.05, f)).join(',')).join(' ');
  return (
    <div ref={ref} className="relative w-full h-full">
      {size.w > 0 && (
        <svg width={size.w} height={size.h} className="absolute inset-0 overflow-visible">
          {[0.25, 0.5, 0.75, 1].map(f => <polygon key={f} points={poly(AXES.map(() => f))} fill="none" stroke={ink(f === 1 ? 14 : 6)} />)}
          {AXES.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={ink(6)} />; })}
          <polygon points={poly(AXES.map(() => 0.5))} fill="none" stroke={C.text} strokeOpacity={0.5} strokeDasharray="4 3" />
          <motion.polygon initial={false} animate={{ points: poly(vals.map(v => v.pct)) }} transition={{ type: 'spring', stiffness: 120, damping: 18 }}
            fill={mix(C.primary, 35)} stroke={C.primary} strokeWidth={2} />
          {vals.map((v, i) => {
            const [x, y] = pt(i, 1.17);
            const m = metric(v.key);
            return (
              <Tip key={v.key} content={<TipBody title={`${v.label}: lepiej niż ${Math.round(v.pct * 100)}% (${p.role ?? 'wszyscy'})`}>{m.label}: {v.key === 'kp' ? m.fmt(v.raw) : v.raw.toFixed(m.avgDigits)} średnio na grę</TipBody>}>
                <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight={700} fill="currentColor" className="cursor-help" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>{v.label}</text>
              </Tip>
            );
          })}
        </svg>
      )}
    </div>
  );
}

function Donut({ p }: { p: PlayerX }) {
  const top = p.heroes.slice(0, 6);
  const rest = p.games - top.reduce((s, h) => s + h.games, 0);
  const segs = [...top.map(h => ({ id: h.heroId, n: h.games, wins: h.wins })), ...(rest > 0 ? [{ id: 0, n: rest, wins: 0 }] : [])];
  const r = 34; const c = 2 * Math.PI * r; let off = 0;
  return (
    <div className="flex items-center gap-3">
      <svg width={92} height={92} viewBox="0 0 92 92" className="shrink-0 -rotate-90">
        {segs.map((s, i) => {
          const len = (s.n / p.games) * c; const el = (
            <circle key={i} cx={46} cy={46} r={r} fill="none" stroke={PALETTE[s.id ? i : 6]} strokeWidth={14} strokeDasharray={`${Math.max(0, len - 1.5)} ${c}`} strokeDashoffset={-off} />
          ); off += len; return el;
        })}
      </svg>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 min-w-0">
        {top.map((h, i) => (
          <Tip key={h.heroId} content={`${heroName(h.heroId)} · ${h.games} gier · ${h.wins}-${h.games - h.wins}`}>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PALETTE[i] }} />
              <HeroImg heroId={h.heroId} variant="icon" className="w-5 h-5 shrink-0" />
              <span className="text-[11px] tabular-nums">{h.games}</span>
            </div>
          </Tip>
        ))}
      </div>
    </div>
  );
}

function Dossier({ model }: { model: Model }) {
  const font = useHeaderFont();
  const initial = useMemo(() => [...model.players].filter(p => p.games >= model.minGames).sort((a, b) => (b.agg.fantasy.avg ?? 0) - (a.agg.fantasy.avg ?? 0))[0] ?? model.players[0], [model]);
  const [pid, setPid] = useState(initial.id);
  const [teamId, setTeamId] = useState<string | null>(initial.teamId ?? null);
  const p = model.playerById.get(pid) ?? initial;
  const roster = (teamId ? model.teamById.get(teamId)?.players : []) ?? [];
  const log = useMemo(() => [...p.perfs].reverse(), [p]);
  const [logRef, rows] = useFitCount<HTMLDivElement>(58, 6, 2);
  const per = rows * 3;
  const { page, pages, setPage, slice } = usePages(log, per);

  const bests = useMemo(() => PB.map(k => {
    const m = metric(k); const best = p.agg[k].best; if (!best) return null;
    const v = m.get(best);
    const better = model.perfs.filter(x => x.player && (!m.parsedOnly || x.parsed) && m.get(x) > v).length;
    return { k, m, v, best, rank: better + 1 };
  }).filter(Boolean) as Array<{ k: MetricKey; m: ReturnType<typeof metric>; v: number; best: PlayerX['perfs'][number]; rank: number }>, [model, p]);

  return (
    <>
      {/* Picker: teams, then the chosen team's roster */}
      <div className="shrink-0 flex items-center gap-1.5 flex-wrap">
        {model.teams.map(t => (
          <Tip key={t.id} content={t.name}>
            <button type="button" onClick={() => setTeamId(t.id)} className="rounded-lg p-1 transition-all" style={{ background: t.id === teamId ? mix(C.primary, 40) : ink(4), opacity: teamId && t.id !== teamId ? 0.45 : 1 }}>
              <TeamLogo team={t} size={22} />
            </button>
          </Tip>
        ))}
      </div>
      <div className="shrink-0 flex items-center gap-2 mt-2 h-10">
        <AnimatePresence mode="popLayout">
          {roster.map((x, i) => (
            <motion.button key={x.id} type="button" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.03 }}
              onClick={() => setPid(x.id)} className="flex items-center gap-1.5 rounded-full pl-0.5 pr-3 py-0.5 text-xs transition-all"
              style={{ background: x.id === pid ? C.primary : ink(5), color: x.id === pid ? '#fff' : C.text }}>
              <Avatar player={x} size={28} /><span className="max-w-[110px] truncate">{x.name}</span>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex-1 min-h-0 flex gap-5 mt-3">
          {/* Identity + radar */}
          <div className="w-[300px] xl:w-[340px] shrink-0 flex flex-col min-h-0">
            <div className="flex items-center gap-3">
              <Avatar player={p} size={68} ring={C.primary} />
              <div className="min-w-0">
                <div className="text-2xl font-logik-extended-bold uppercase leading-tight line-clamp-2 break-words" style={{ color: C.title, ...font }}>{p.name}</div>
                <div className="flex items-center gap-1.5 mt-1 text-xs" style={{ color: C.muted }}><TeamLogo team={p.team} size={16} /><span className="truncate">{p.team?.name}</span>{p.role && <span>· {p.role}</span>}</div>
                <div className="mt-1 text-sm font-bold tabular-nums"><span style={{ color: C.win }}>{p.wins}</span><span className="opacity-40"> – </span><span style={{ color: C.loss }}>{p.losses}</span><span className="text-xs font-normal ml-2" style={{ color: C.muted }}>{p.games} gier</span></div>
              </div>
            </div>
            <div className="flex-1 min-h-0 mt-2"><Radar model={model} p={p} /></div>
          </div>

          {/* Game log */}
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            <div ref={logRef} className="flex-1 min-h-0 grid grid-cols-3 gap-1.5 content-start">
              {slice.map(x => {
                const opp = opponentOf(x);
                return (
                  <Tip key={x.idx} content={<TipBody title={`${heroName(x.heroId)} vs ${opp?.name ?? '?'}`}>{fmtClock(x.game.duration)} · {x.gpm} GPM · {x.lastHits} LH · {(x.heroDamage / 1000).toFixed(1)}k obrażeń · {new Date(x.game.start * 1000).toLocaleDateString('pl-PL')}</TipBody>}>
                    <div className="relative h-[58px] rounded-lg overflow-hidden text-white" style={{ borderTop: `3px solid ${x.win ? C.win : C.loss}` }}>
                      <HeroImg heroId={x.heroId} className="absolute inset-0 w-full h-full opacity-70" />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />
                      <div className="relative h-full flex flex-col justify-center px-2">
                        <span className="text-sm font-bold tabular-nums leading-tight">{x.kills}/{x.deaths}/{x.assists}</span>
                        <span className="text-[10px] opacity-70 flex items-center gap-1"><TeamLogo team={opp} size={12} />{x.fantasyPoints.toFixed(1)} pkt</span>
                      </div>
                    </div>
                  </Tip>
                );
              })}
            </div>
            <Pager className="mt-2" page={page} pages={pages} onChange={setPage} />
          </div>

          {/* Pool + personal bests */}
          <div className="w-[270px] shrink-0 hidden lg:flex flex-col gap-3 min-h-0">
            <Donut p={p} />
            <div className="flex-1 min-h-0 flex flex-col gap-1">
              <Tip content="Najlepszy pojedynczy występ gracza i jego miejsce wśród wszystkich występów turnieju"><div className="text-sm font-logik-extended-bold uppercase cursor-help inline-block" style={{ color: C.heading, ...font }}>Rekordy osobiste</div></Tip>
              {bests.map(b => (
                <Tip key={b.k} content={<TipBody title={b.m.label}>{b.m.desc} · {heroName(b.best.heroId)} vs {opponentOf(b.best)?.name}</TipBody>}>
                  <div className="flex items-center gap-2 h-7">
                    <span className="flex-1 text-[11px] truncate" style={{ color: C.muted }}>{b.m.label}</span>
                    <span className="text-sm font-bold tabular-nums" style={font}>{b.m.fmt(b.v)}</span>
                    <span className="w-11 text-center text-[10px] font-bold rounded-full py-0.5" style={b.rank === 1 ? { background: C.secondary, color: '#000' } : b.rank <= 10 ? { background: mix(C.primary, 35) } : { background: ink(6), color: C.muted }}>#{b.rank}</span>
                  </div>
                </Tip>
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}

export default function D16Dossier() {
  return <LabView><WithModel>{m => <Dossier model={m} />}</WithModel></LabView>;
}
