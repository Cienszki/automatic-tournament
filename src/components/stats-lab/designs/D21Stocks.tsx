'use client';

// #21 — Player stock market. Every player is a stock whose price is their form: a moving average
// of performance points that updates after every game. Each game is a candlestick (kills = volume).
// The ticker runs across the top; gainers, losers and blue chips sit on the right.

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Model, Perf, PlayerX } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { opponentOf } from '@/lib/stats-lab/derive';
import { Avatar, C, LabTitle, LabView, TeamLogo, Tip, TipBody, WithModel, ink, mix, useHeaderFont, useSize } from '../kit';

const ALPHA = 0.35;
interface Candle { perf: Perf; open: number; close: number; high: number; low: number }
interface Stock { p: PlayerX; candles: Candle[]; price: number; ch1: number; ch3: number; hi: number; lo: number }

function buildStocks(model: Model): Stock[] {
  return model.players.filter(p => p.perfs.filter(x => Number.isFinite(x.score)).length >= 3).map(p => {
    const scored = p.perfs.filter(x => Number.isFinite(x.score));
    let price = scored[0].score;
    const candles: Candle[] = scored.map((perf, i) => {
      const open = price;
      const close = i === 0 ? perf.score : price + ALPHA * (perf.score - price);
      price = close;
      return { perf, open, close, high: Math.max(open, close, perf.score), low: Math.min(open, close, perf.score) };
    });
    const at = (k: number) => candles[Math.max(0, candles.length - 1 - k)].close;
    return {
      p, candles, price,
      ch1: (price - at(1)) / Math.max(0.01, Math.abs(at(1))),
      ch3: (price - at(3)) / Math.max(0.01, Math.abs(at(3))),
      hi: Math.max(...candles.map(c => c.close)), lo: Math.min(...candles.map(c => c.close)),
    };
  });
}

const pct = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)}%`;
const upDown = (v: number) => (v >= 0 ? C.win : C.loss);

function Ticker({ stocks, onPick }: { stocks: Stock[]; onPick: (s: Stock) => void }) {
  const items = [...stocks].sort((a, b) => b.price - a.price).slice(0, 40);
  const row = (k: string) => (
    <div key={k} className="flex shrink-0">
      {items.map(s => (
        <button key={s.p.id} type="button" onClick={() => onPick(s)} className="flex items-center gap-1.5 px-4 text-xs whitespace-nowrap hover:bg-white/5">
          <span className="font-bold uppercase tracking-wide">{s.p.name}</span>
          <span className="tabular-nums">{s.price.toFixed(2)}</span>
          <span className="tabular-nums font-bold" style={{ color: upDown(s.ch1) }}>{pct(s.ch1)}</span>
        </button>
      ))}
    </div>
  );
  return (
    <div className="group relative shrink-0 h-8 mt-3 overflow-hidden rounded-lg flex items-center" style={{ background: ink(5), border: `1px solid ${ink(8)}` }}>
      <div className="flex animate-[statslab-ticker_80s_linear_infinite] group-hover:[animation-play-state:paused]">{row('a')}{row('b')}</div>
      <style>{'@keyframes statslab-ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }'}</style>
    </div>
  );
}

function Chart({ s }: { s: Stock }) {
  const [ref, size] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = s.candles.length;
  const M = { l: 8, r: 46, t: 10, b: 8 };
  const volH = Math.max(30, size.h * 0.18);
  const W = size.w - M.l - M.r; const H = size.h - M.t - M.b - volH - 8;
  const lo = Math.min(...s.candles.map(c => c.low)); const hi = Math.max(...s.candles.map(c => c.high));
  const y = (v: number) => M.t + H - ((v - lo) / (hi - lo || 1)) * H;
  const cw = W / n;
  const maxK = Math.max(1, ...s.candles.map(c => c.perf.kills));
  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
  const h = hover != null ? s.candles[hover] : null;
  return (
    <div ref={ref} className="relative w-full h-full" onMouseLeave={() => setHover(null)}>
      {size.w > 0 && (
        <svg width={size.w} height={size.h} className="absolute inset-0">
          {ticks.map((v, i) => (
            <g key={i}>
              <line x1={M.l} x2={M.l + W} y1={y(v)} y2={y(v)} stroke={ink(6)} />
              <text x={M.l + W + 6} y={y(v) + 3} fontSize={10} fill="currentColor" opacity={0.45}>{v.toFixed(1)}</text>
            </g>
          ))}
          {s.candles.map((c, i) => {
            const x = M.l + i * cw + cw / 2;
            const up = c.close >= c.open;
            const col = up ? C.win : C.loss;
            const bw = Math.max(3, Math.min(18, cw * 0.6));
            return (
              <g key={c.perf.idx} onMouseEnter={() => setHover(i)} style={{ cursor: 'crosshair' }}>
                <rect x={M.l + i * cw} y={M.t} width={cw} height={H + volH + 8} fill="transparent" />
                <line x1={x} x2={x} y1={y(c.high)} y2={y(c.low)} stroke={col} strokeWidth={1.5} />
                <motion.rect initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: i * 0.01 }} style={{ transformOrigin: `${x}px ${y((c.open + c.close) / 2)}px` }}
                  x={x - bw / 2} y={Math.min(y(c.open), y(c.close))} width={bw} height={Math.max(2, Math.abs(y(c.open) - y(c.close)))} fill={col} rx={1.5} opacity={hover == null || hover === i ? 1 : 0.4} />
                <circle cx={x} cy={y(c.perf.score)} r={2} fill={C.text} opacity={0.5} />
                <rect x={x - bw / 2} y={M.t + H + 8 + volH - (c.perf.kills / maxK) * volH} width={bw} height={(c.perf.kills / maxK) * volH} fill={mix(col, 45)} rx={1} />
              </g>
            );
          })}
          <line x1={M.l} x2={M.l + W} y1={y(s.price)} y2={y(s.price)} stroke={C.secondary} strokeDasharray="3 3" />
          <rect x={M.l + W + 2} y={y(s.price) - 8} width={42} height={16} rx={3} fill={C.secondary} />
          <text x={M.l + W + 23} y={y(s.price) + 4} textAnchor="middle" fontSize={10} fontWeight={700} fill="#000">{s.price.toFixed(2)}</text>
        </svg>
      )}
      {h && (
        <div className="absolute top-2 left-3 rounded-lg px-3 py-2 text-[11px] pointer-events-none" style={{ background: 'rgba(0,0,0,0.8)', color: '#fff' }}>
          <div className="font-bold">{heroName(h.perf.heroId)} vs {opponentOf(h.perf)?.name ?? '?'} · {h.perf.win ? 'wygrana' : 'przegrana'}</div>
          <div className="opacity-75 tabular-nums">otwarcie {h.open.toFixed(2)} · zamknięcie {h.close.toFixed(2)} · występ {h.perf.score.toFixed(2)} · {h.perf.kills}/{h.perf.deaths}/{h.perf.assists}</div>
        </div>
      )}
    </div>
  );
}

function Spark({ s }: { s: Stock }) {
  const v = s.candles.slice(-8).map(c => c.close);
  const lo = Math.min(...v); const hi = Math.max(...v);
  const pts = v.map((x, i) => `${(i / Math.max(1, v.length - 1)) * 50},${16 - ((x - lo) / (hi - lo || 1)) * 16}`).join(' ');
  return <svg width={50} height={16} className="shrink-0"><polyline points={pts} fill="none" stroke={upDown(s.ch3)} strokeWidth={1.5} /></svg>;
}

function List({ title, tip, rows, val, onPick, sel }: { title: string; tip: string; rows: Stock[]; val: (s: Stock) => React.ReactNode; onPick: (s: Stock) => void; sel: string }) {
  const font = useHeaderFont();
  return (
    <div className="min-h-0">
      <Tip content={tip}><div className="text-xs font-logik-extended-bold uppercase tracking-wide cursor-help inline-block" style={{ color: C.heading, ...font }}>{title}</div></Tip>
      <div className="mt-1 flex flex-col gap-0.5">
        {rows.map(s => (
          <button key={s.p.id} type="button" onClick={() => onPick(s)} className="flex items-center gap-2.5 h-[34px] rounded-lg px-1.5 text-left transition"
            style={{ background: s.p.id === sel ? mix(C.primary, 30) : 'transparent' }}>
            <Avatar player={s.p} size={30} />
            <span className="flex-1 truncate text-sm font-semibold">{s.p.name}</span>
            <Spark s={s} />
            <span className="w-14 text-right text-xs font-bold tabular-nums">{val(s)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Market({ model }: { model: Model }) {
  const font = useHeaderFont();
  const stocks = useMemo(() => buildStocks(model), [model]);
  const [sel, setSel] = useState(() => [...stocks].sort((a, b) => b.price - a.price)[0]?.p.id);
  const s = stocks.find(x => x.p.id === sel) ?? stocks[0];
  const [sideRef, side] = useSize<HTMLDivElement>();

  // Market index: mean price of everyone who has played so far, game by game
  const index = useMemo(() => {
    const last = new Map<string, number>();
    const byGame = new Map<number, Array<{ pid: string; close: number }>>();
    for (const st of stocks) for (const c of st.candles) {
      const g = c.perf.game.idx; if (!byGame.has(g)) byGame.set(g, []); byGame.get(g)!.push({ pid: st.p.id, close: c.close });
    }
    return model.games.map(g => { for (const x of byGame.get(g.idx) ?? []) last.set(x.pid, x.close); const v = [...last.values()]; return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; });
  }, [stocks, model]);
  const idxCh = index.length > 10 ? (index[index.length - 1] - index[index.length - 11]) / index[index.length - 11] : 0;

  if (!s) return null;
  // Rows per list so three lists fit the panel height (28px rows + 24px headings)
  const per = Math.max(2, Math.min(5, Math.floor((side.h - 3 * 26 - 24) / 3 / 36)));
  const gainers = [...stocks].sort((a, b) => b.ch3 - a.ch3).slice(0, per);
  const losers = [...stocks].sort((a, b) => a.ch3 - b.ch3).slice(0, per);
  const blue = [...stocks].sort((a, b) => b.price - a.price).slice(0, per);
  const ipts = index.map((v, i) => `${(i / (index.length - 1)) * 160},${30 - ((v - Math.min(...index)) / (Math.max(...index) - Math.min(...index) || 1)) * 30}`).join(' ');

  return (
    <>
      <LabTitle
        right={
          <Tip content={<TipBody title="Indeks DOTA">Średni kurs wszystkich graczy po każdej grze · {pct(idxCh)} w ostatnich 10 grach</TipBody>}>
            <div className="hidden md:flex items-center gap-3 cursor-help">
              <svg width={160} height={30}><polyline points={ipts} fill="none" stroke={upDown(idxCh)} strokeWidth={1.5} /></svg>
              <div className="text-right"><div className="text-[9px] uppercase tracking-[0.3em]" style={{ color: C.muted }}>Indeks</div><div className="font-logik-extended-bold tabular-nums" style={font}>{index[index.length - 1]?.toFixed(2)} <span className="text-xs" style={{ color: upDown(idxCh) }}>{pct(idxCh)}</span></div></div>
            </div>
          </Tip>
        }
      >
        Giełda graczy
      </LabTitle>
      <Ticker stocks={stocks} onPick={x => setSel(x.p.id)} />
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        <div className="flex-1 min-w-0 flex flex-col min-h-0 rounded-2xl p-3" style={{ background: ink(3), border: `1px solid ${ink(8)}` }}>
          <div className="flex items-center gap-3 shrink-0">
            <Avatar player={s.p} size={88} ring={upDown(s.ch1)} />
            <div className="min-w-0">
              <div className="text-3xl font-logik-extended-bold uppercase truncate leading-tight" style={{ color: C.heading, ...font }}>{s.p.name}</div>
              <div className="flex items-center gap-2 text-sm mt-0.5" style={{ color: C.muted }}><TeamLogo team={s.p.team} size={26} /><span className="truncate">{s.p.team?.name}</span>{s.p.role && <span>· {s.p.role}</span>}<span>· {s.p.games} gier</span></div>
              <Tip content="Kurs = forma gracza: średnia krocząca punktów występu, aktualizowana po każdej grze">
                <div className="flex items-baseline gap-2 cursor-help">
                  <span className="text-4xl font-logik-extended-bold tabular-nums" style={font}>{s.price.toFixed(2)}</span>
                  <span className="text-lg font-bold tabular-nums" style={{ color: upDown(s.ch1) }}>{pct(s.ch1)}</span>
                  <span className="text-[11px]" style={{ color: C.muted }}>ostatnia gra</span>
                </div>
              </Tip>
            </div>
            <div className="flex-1" />
            {[['Max', s.hi, 'Najwyższy kurs w turnieju'], ['Min', s.lo, 'Najniższy kurs w turnieju'], ['3 gry', null, 'Zmiana kursu w ostatnich trzech grach']].map(([l, v, t]) => (
              <Tip key={l as string} content={t as string}>
                <div className="text-right cursor-help ml-4"><div className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>{l as string}</div>
                  <div className="text-2xl font-bold tabular-nums" style={v == null ? { color: upDown(s.ch3), ...font } : font}>{v == null ? pct(s.ch3) : (v as number).toFixed(2)}</div></div>
              </Tip>
            ))}
          </div>
          <div className="flex-1 min-h-0 mt-2"><Chart key={s.p.id} s={s} /></div>
        </div>
        <div ref={sideRef} className="w-[300px] shrink-0 hidden md:flex flex-col gap-3 min-h-0">
          <List title="Wzrosty" tip="Największy wzrost kursu w ostatnich 3 grach" rows={gainers} val={x => <span style={{ color: upDown(x.ch3) }}>{pct(x.ch3)}</span>} onPick={x => setSel(x.p.id)} sel={s.p.id} />
          <List title="Spadki" tip="Największy spadek kursu w ostatnich 3 grach" rows={losers} val={x => <span style={{ color: upDown(x.ch3) }}>{pct(x.ch3)}</span>} onPick={x => setSel(x.p.id)} sel={s.p.id} />
          <List title="Blue chipy" tip="Najwyższy kurs teraz" rows={blue} val={x => x.price.toFixed(2)} onPick={x => setSel(x.p.id)} sel={s.p.id} />
        </div>
      </div>
    </>
  );
}

export default function D21Stocks() {
  return <LabView><WithModel>{m => <Market model={m} />}</WithModel></LabView>;
}
