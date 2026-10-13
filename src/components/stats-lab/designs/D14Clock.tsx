'use client';

// #14 — Tournament clock. When are games played? A 24-hour radial clock (bar = games started in
// that hour, colour = the chosen measure), a weekday × hour heatmap, the latest game ever and the
// night owls who play most after 22:00. Times are Polish time.

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { GameX, Model, PlayerX } from '@/lib/stats-lab/derive';
import { fmtClock } from '@/lib/stats-lab/metrics';
import { Avatar, C, LabTitle, LabView, Seg, TeamLogo, Tip, TipBody, WithModel, ink, mix, playerTip, useHeaderFont, useSize } from '../kit';

const TZ = 'Europe/Warsaw';
const partsFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: 'numeric', minute: 'numeric', weekday: 'short', hourCycle: 'h23' });
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WD_PL = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];
function when(g: GameX) {
  const p = partsFmt.formatToParts(new Date(g.start * 1000));
  const get = (t: string) => p.find(x => x.type === t)?.value ?? '0';
  return { hour: Number(get('hour')), min: Number(get('minute')), wd: WD.indexOf(get('weekday')) };
}
const isNight = (h: number) => h >= 22 || h < 5;

type Measure = 'games' | 'blood' | 'length';
const MEASURES: Array<{ value: Measure; label: string; tip: string }> = [
  { value: 'games', label: 'Gry', tip: 'Ile gier zaczęło się o tej godzinie' },
  { value: 'blood', label: 'Krwawość', tip: 'Średnio zabójstw na minutę w grach z tej godziny' },
  { value: 'length', label: 'Długość', tip: 'Średni czas gier rozpoczętych o tej godzinie' },
];

function Clock({ model }: { model: Model }) {
  const font = useHeaderFont();
  const [measure, setMeasure] = useState<Measure>('games');
  const [hour, setHour] = useState<number | null>(null);
  const [ref, size] = useSize<HTMLDivElement>();

  const data = useMemo(() => {
    const games = model.games.map(g => ({ g, ...when(g) }));
    const hours = Array.from({ length: 24 }, (_, h) => {
      const list = games.filter(x => x.hour === h).map(x => x.g);
      return {
        h, list, n: list.length,
        blood: list.length ? list.reduce((s, g) => s + g.kills / (g.duration / 60), 0) / list.length : 0,
        length: list.length ? list.reduce((s, g) => s + g.duration, 0) / list.length : 0,
      };
    });
    const grid = Array.from({ length: 7 }, (_, wd) => Array.from({ length: 24 }, (_, h) => games.filter(x => x.wd === wd && x.hour === h).length));
    // Latest game: hours after noon, wrapping past midnight
    const lateKey = (x: (typeof games)[number]) => ((x.hour + 12) % 24) * 60 + x.min;
    const latest = [...games].sort((a, b) => lateKey(b) - lateKey(a))[0];
    const owls = new Map<string, { p: PlayerX; n: number }>();
    for (const x of games) if (isNight(x.hour)) for (const perf of x.g.perfs) if (perf.player) {
      const e = owls.get(perf.pid) ?? { p: perf.player, n: 0 }; e.n++; owls.set(perf.pid, e);
    }
    const night = games.filter(x => isNight(x.hour)).length;
    return { hours, grid, latest, owls: [...owls.values()].sort((a, b) => b.n - a.n).slice(0, 6), night, total: games.length };
  }, [model]);

  const val = (x: (typeof data.hours)[number]) => (measure === 'games' ? x.n : measure === 'blood' ? x.blood : x.length);
  const maxV = Math.max(1e-9, ...data.hours.map(val));
  const maxN = Math.max(1, ...data.hours.map(x => x.n));
  const S = Math.min(size.w, size.h); const cx = size.w / 2; const cy = size.h / 2;
  const r0 = S * 0.17; const r1 = S / 2 - 26;
  const sel = hour != null ? data.hours[hour] : null;
  const busiest = [...data.hours].sort((a, b) => b.n - a.n)[0];
  const gridMax = Math.max(1, ...data.grid.flat());
  const fmtVal = (x: (typeof data.hours)[number]) => (measure === 'games' ? `${x.n} gier` : measure === 'blood' ? `${x.blood.toFixed(2)} zab./min` : fmtClock(x.length));

  const wedge = (h: number, r: number) => {
    const a0 = (h / 24) * Math.PI * 2 - Math.PI / 2 + 0.02; const a1 = ((h + 1) / 24) * Math.PI * 2 - Math.PI / 2 - 0.02;
    const pt = (a: number, rr: number) => `${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`;
    return `M${pt(a0, r0)} L${pt(a0, r)} A${r},${r} 0 0 1 ${pt(a1, r)} L${pt(a1, r0)} A${r0},${r0} 0 0 0 ${pt(a0, r0)} Z`;
  };

  return (
    <>
      <LabTitle sub={<span>{data.total} gier · czas polski</span>} right={<Seg value={measure} onChange={setMeasure} options={MEASURES} />}>Zegar turnieju</LabTitle>
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        <div ref={ref} className="relative flex-[1.2] min-w-0 min-h-0" onMouseLeave={() => setHour(null)}>
          {size.w > 0 && (
            <svg width={size.w} height={size.h} className="absolute inset-0">
              {/* night shading 22:00–05:00 */}
              {(() => {
                const a0 = (22 / 24) * Math.PI * 2 - Math.PI / 2; const a1 = (29 / 24) * Math.PI * 2 - Math.PI / 2; const r = r1 + 3;
                return (
                  <Tip content="Noc: 22:00 – 5:00">
                    <path d={`M${cx + Math.cos(a0) * r},${cy + Math.sin(a0) * r} A${r},${r} 0 0 1 ${cx + Math.cos(a1) * r},${cy + Math.sin(a1) * r}`} fill="none" stroke="#6b7bdc" strokeOpacity={0.55} strokeWidth={4} strokeLinecap="round" className="cursor-help" />
                  </Tip>
                );
              })()}
              <circle cx={cx} cy={cy} r={r1} fill="none" stroke={ink(8)} strokeDasharray="2 5" />
              {data.hours.map(x => {
                const t = val(x) / maxV;
                const r = r0 + 4 + t * (r1 - r0 - 4);
                return (
                  <motion.path key={x.h} d={wedge(x.h, r)} initial={false} animate={{ d: wedge(x.h, r) }} transition={{ type: 'spring', stiffness: 90, damping: 16 }}
                    fill={x.n ? `color-mix(in srgb, ${C.secondary} ${Math.round((x.n / maxN) * 100)}%, ${C.primary})` : ink(5)}
                    opacity={hour == null || hour === x.h ? 1 : 0.35} onMouseEnter={() => setHour(x.h)} className="cursor-pointer" />
                );
              })}
              {Array.from({ length: 24 }, (_, h) => {
                const a = ((h + 0.5) / 24) * Math.PI * 2 - Math.PI / 2;
                return <text key={h} x={cx + Math.cos(a) * (r1 + 14)} y={cy + Math.sin(a) * (r1 + 14)} textAnchor="middle" dominantBaseline="middle" fontSize={h % 3 === 0 ? 11 : 8} fontWeight={h % 3 === 0 ? 700 : 400} fill="currentColor" opacity={h % 3 === 0 ? 0.8 : 0.35}>{h}</text>;
              })}
            </svg>
          )}
          {size.w > 0 && (
            <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none" style={{ left: cx - r0, top: cy - r0, width: r0 * 2, height: r0 * 2 }}>
              <div className="font-logik-extended-bold tabular-nums leading-none" style={{ fontSize: r0 * 0.42, color: C.heading, ...font }}>{String((sel ?? busiest).h).padStart(2, '0')}:00</div>
              <div className="text-[11px] mt-1" style={{ color: C.muted }}>{fmtVal(sel ?? busiest)}</div>
              {!sel && <div className="text-[9px] uppercase tracking-widest mt-0.5" style={{ color: C.muted }}>szczyt</div>}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-[340px] max-w-[520px] hidden md:flex flex-col gap-4 min-h-0">
          {/* Weekday × hour heatmap */}
          <div>
            <Tip content="Ile gier zaczęło się w danym dniu tygodnia i o danej godzinie"><div className="text-sm font-logik-extended-bold uppercase cursor-help self-start inline-block" style={{ color: C.heading, ...font }}>Tydzień</div></Tip>
            <div className="mt-2 grid gap-[2px]" style={{ gridTemplateColumns: `22px repeat(24, minmax(0, 1fr))` }}>
              {data.grid.map((row, wd) => (
                <React.Fragment key={wd}>
                  <span className="text-[9px] self-center" style={{ color: C.muted }}>{WD_PL[wd]}</span>
                  {row.map((n, h) => (
                    <Tip key={h} content={`${WD_PL[wd]} ${h}:00 — ${n} gier`}>
                      <div className="aspect-square rounded-[3px] transition-transform hover:scale-125" onMouseEnter={() => setHour(h)}
                        style={{ background: n ? mix(C.secondary, 15 + (n / gridMax) * 85) : ink(4), outline: hour === h ? `1px solid ${ink(40)}` : 'none' }} />
                    </Tip>
                  ))}
                </React.Fragment>
              ))}
              <span />
              {Array.from({ length: 24 }, (_, h) => <span key={h} className="text-[8px] text-center" style={{ color: C.muted }}>{h % 6 === 0 ? h : ''}</span>)}
            </div>
          </div>

          {/* Latest game */}
          {data.latest && (
            <Tip content={<TipBody title="Najpóźniej rozpoczęta gra">{fmtClock(data.latest.g.duration)} gry · {data.latest.g.kills} zabójstw</TipBody>}>
              <div className="rounded-2xl p-3 flex items-center gap-3 cursor-help" style={{ background: `linear-gradient(90deg, rgba(10,12,30,0.9), ${mix(C.primary, 15)})`, border: `1px solid ${ink(8)}` }}>
                <div className="text-3xl font-logik-extended-bold tabular-nums text-white" style={font}>{String(data.latest.hour).padStart(2, '0')}:{String(data.latest.min).padStart(2, '0')}</div>
                <div className="flex-1 min-w-0 text-white">
                  <div className="text-[9px] uppercase tracking-[0.3em] opacity-60">Ostatni gasi światło</div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs">
                    <TeamLogo team={data.latest.g.radiantTeam} size={18} /><span className="truncate">{data.latest.g.radiantTeam?.name}</span>
                    <span className="opacity-40">vs</span>
                    <TeamLogo team={data.latest.g.direTeam} size={18} /><span className="truncate">{data.latest.g.direTeam?.name}</span>
                  </div>
                </div>
              </div>
            </Tip>
          )}

          {/* Night owls */}
          <div className="flex-1 min-h-0">
            <Tip content={`Gracze z największą liczbą gier rozpoczętych między 22:00 a 5:00 (${data.night} takich gier)`}>
              <div className="text-sm font-logik-extended-bold uppercase cursor-help inline-block" style={{ color: C.heading, ...font }}>Nocne marki</div>
            </Tip>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {data.owls.map(o => (
                <Tip key={o.p.id} content={playerTip(o.p)}>
                  <div className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: ink(4) }}>
                    <Avatar player={o.p} size={24} />
                    <span className="flex-1 truncate text-xs font-semibold">{o.p.name}</span>
                    <span className="text-xs font-bold tabular-nums">{o.n}</span>
                  </div>
                </Tip>
              ))}
              {!data.owls.length && <span className="text-xs" style={{ color: C.muted }}>Wszyscy grzecznie śpią przed 22:00</span>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function D14Clock() {
  return <LabView><WithModel>{m => <Clock model={m} />}</WithModel></LabView>;
}
