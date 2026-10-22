'use client';

// #16 — Player dossier. Pick a team, then a player. A radar compares them with players of the
// same position (dashed shape = position median), the game log shows every game as a tile, the
// donut is their hero pool and personal bests carry their rank in the whole tournament.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { fmtClock, metric, type MetricKey } from '@/lib/stats-lab/metrics';
import { opponentOf, pctRank, type Model, type PlayerX } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { Avatar, C, HeroImg, LabView, Pager, TeamLogo, Tip, TipBody, WithModel, ink, mix, useFitCount, useHeaderFont, usePages, useSize, TeamPicker } from '../kit';
import { count } from '@/lib/plural';

const AXES: Array<{ key: MetricKey; label: string; invert?: boolean }> = [
  { key: 'kda', label: 'Walka' },
  { key: 'gpm', label: 'Farma' },
  { key: 'hdpm', label: 'Obrażenia' },
  { key: 'wards', label: 'Wizja' },
  { key: 'kp', label: 'Drużyna' },
  { key: 'deaths', label: 'Przeżycie', invert: true },
];
const PB: MetricKey[] = ['kills', 'assists', 'gpm', 'xpm', 'heroDamage', 'lastHits', 'wards', 'score'];
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
      <svg width={120} height={120} viewBox="0 0 92 92" className="shrink-0 -rotate-90">
        {segs.map((s, i) => {
          const len = (s.n / p.games) * c; const el = (
            <circle key={i} cx={46} cy={46} r={r} fill="none" stroke={PALETTE[s.id ? i : 6]} strokeWidth={14} strokeDasharray={`${Math.max(0, len - 1.5)} ${c}`} strokeDashoffset={-off} />
          ); off += len; return el;
        })}
      </svg>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 min-w-0">
        {top.map((h, i) => (
          <Tip key={h.heroId} content={`${heroName(h.heroId)} · ${count(h.games, 'gra', 'gry', 'gier')} · ${h.wins}-${h.games - h.wins}`}>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PALETTE[i] }} />
              <HeroImg heroId={h.heroId} variant="icon" className="w-7 h-7 shrink-0" />
              <span className="text-sm font-bold tabular-nums">{h.games}</span>
            </div>
          </Tip>
        ))}
      </div>
    </div>
  );
}

function Dossier({ model }: { model: Model }) {
  const font = useHeaderFont();
  const initial = useMemo(() => [...model.players].filter(p => p.games >= model.minGames).sort((a, b) => (b.agg.score.avg ?? 0) - (a.agg.score.avg ?? 0))[0] ?? model.players[0], [model]);
  const [pid, setPid] = useState(initial.id);
  const [teamId, setTeamId] = useState<string | null>(initial.teamId ?? null);
  const p = model.playerById.get(pid) ?? initial;
  const rosterOf = (tid: string) => model.players
    .filter(x => x.teamId === tid || x.perfs.some(q => q.tid === tid))
    .sort((a, b) => Number(!!a.standin) - Number(!!b.standin) || b.perfs.filter(q => q.tid === tid).length - a.perfs.filter(q => q.tid === tid).length);
  const roster = teamId ? rosterOf(teamId).slice(0, 8) : [];
  const log = useMemo(() => [...p.perfs].reverse(), [p]);
  const [logRef, rows] = useFitCount<HTMLDivElement>(96, 8, 2);
  const [logBoxRef, logBox] = useSize<HTMLDivElement>();
  const cols = logBox.w > 900 ? 3 : 2;
  const per = rows * cols;
  const { page, pages, setPage, slice } = usePages(log, per);

  const bests = useMemo(() => PB.map(k => {
    const m = metric(k); const best = p.agg[k].best; if (!best) return null;
    const v = m.get(best);
    const better = model.perfs.filter(x => x.player && (!m.parsedOnly || x.parsed) && m.get(x) > v).length;
    return { k, m, v, best, rank: better + 1 };
  }).filter(Boolean) as Array<{ k: MetricKey; m: ReturnType<typeof metric>; v: number; best: PlayerX['perfs'][number]; rank: number }>, [model, p]);

  return (
    <>
      {/* Picker: teams, then the chosen team's roster (incl. standins who played for them) */}
      <TeamPicker className="shrink-0" teams={model.teams} value={teamId} onChange={id => { setTeamId(id); const first = id ? rosterOf(id)[0] : null; if (first) setPid(first.id); }} size={40} />
      <div className="shrink-0 flex items-center justify-center gap-2 mt-2.5 h-14">
        <AnimatePresence mode="popLayout">
          {roster.map((x, i) => (
            <motion.button key={x.id} type="button" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.03 }}
              onClick={() => setPid(x.id)} className="h-full flex items-center gap-2 rounded-full pl-1 pr-4 text-sm font-semibold transition-all"
              style={{ background: x.id === pid ? C.primary : ink(6), color: x.id === pid ? '#fff' : C.text, boxShadow: x.id === pid ? `0 0 16px ${mix(C.primary, 50)}` : undefined }}>
              <Avatar player={x} size={46} /><span className="max-w-[140px] truncate">{x.name}</span>
              {x.standin && <span className="text-[9px] uppercase tracking-widest opacity-70">stand-in</span>}
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
                <div className="mt-1 text-sm font-bold tabular-nums"><span style={{ color: C.win }}>{p.wins}</span><span className="opacity-40"> – </span><span style={{ color: C.loss }}>{p.losses}</span><span className="text-xs font-normal ml-2" style={{ color: C.muted }}>{count(p.games, 'gra', 'gry', 'gier')}</span></div>
              </div>
            </div>
            <div className="flex-1 min-h-0 mt-2"><Radar model={model} p={p} /></div>
          </div>

          {/* Game log */}
          <div ref={logBoxRef} className="flex-1 min-w-0 flex flex-col min-h-0">
            <div ref={logRef} className="flex-1 min-h-0 grid gap-2 content-start" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {slice.map(x => {
                const opp = opponentOf(x);
                return (
                  <Tip key={x.idx} content={<TipBody title={`${heroName(x.heroId)} vs ${opp?.name ?? '?'}`}>{fmtClock(x.game.duration)} · {x.gpm} GPM · {x.lastHits} LH · {(x.heroDamage / 1000).toFixed(1)}k obrażeń · {new Date(x.game.start * 1000).toLocaleDateString('pl-PL')}</TipBody>}>
                    <div className="relative h-[96px] rounded-xl overflow-hidden text-white" style={{ background: '#0d0d12', boxShadow: `inset 4px 0 0 ${x.win ? C.win : C.loss}` }}>
                      <HeroImg heroId={x.heroId} className="absolute inset-y-0 right-0 h-full w-[70%] object-cover opacity-85" />
                      <div className="absolute inset-0 bg-gradient-to-r from-[#0d0d12] via-[#0d0d12]/75 to-transparent" />
                      <div className="relative h-full flex flex-col justify-center gap-1 pl-4 pr-2">
                        <span className="text-2xl font-bold tabular-nums leading-none">{x.kills}/{x.deaths}/{x.assists}</span>
                        <span className="text-xs opacity-80 flex items-center gap-1.5"><TeamLogo team={opp} size={22} /><span className="truncate">{opp?.name}</span></span>
                        <span className="text-[11px] opacity-60 tabular-nums">{Number.isFinite(x.score) ? `${x.score.toFixed(1)} pkt · ` : ''}{x.gpm} GPM · {fmtClock(x.game.duration)}</span>
                      </div>
                    </div>
                  </Tip>
                );
              })}
            </div>
            <Pager className="mt-2" page={page} pages={pages} onChange={setPage} />
          </div>

          {/* Pool + personal bests */}
          <div className="w-[300px] shrink-0 hidden lg:flex flex-col gap-4 min-h-0">
            <Donut p={p} />
            <div className="flex-1 min-h-0 flex flex-col gap-1">
              <Tip content="Najlepszy pojedynczy występ gracza i jego miejsce wśród wszystkich występów turnieju"><div className="text-sm font-logik-extended-bold uppercase cursor-help inline-block" style={{ color: C.heading, ...font }}>Rekordy osobiste</div></Tip>
              {bests.map(b => (
                <Tip key={b.k} content={<TipBody title={b.m.label}>{b.m.desc} · {heroName(b.best.heroId)} vs {opponentOf(b.best)?.name}</TipBody>}>
                  <div className="flex items-center gap-2 h-9">
                    <span className="flex-1 text-[13px] truncate" style={{ color: C.muted }}>{b.m.label}</span>
                    <span className="text-lg font-bold tabular-nums" style={font}>{b.m.fmt(b.v)}</span>
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
