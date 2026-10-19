'use client';

// #80 — Odds. A bookmaker's board built from Elo: for every played series the odds the ratings
// gave before it started (1 / X / 2 for two-game series) and what actually happened — the biggest
// upsets light up. The calculator on the right prices any pairing with today's ratings, plus the
// head-to-head record and form.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, TeamX } from '@/lib/stats-lab/derive';
import type { DsMatch } from '@/lib/stats-lab/types';
import { eloTimeline, fmtDay, gamesOf, winProb } from '@/lib/stats-lab/season';
import { C, LabTitle, LabView, Seg, TeamLogo, Tip, TipBody, WithModel, ink, mix, useFitCount, useHeaderFont } from '../kit';

const MARGIN = 0.94;
type Fmt = 'bo1' | 'bo2' | 'bo3';
const odd = (p: number) => Math.max(1.01, MARGIN / Math.max(0.01, p));
const fmtOdd = (o: number) => o.toFixed(2);

/** Probabilities of [A wins, draw, B wins] for a series given a single-game win chance p */
function seriesProbs(p: number, f: Fmt): [number, number, number] {
  if (f === 'bo1') return [p, 0, 1 - p];
  if (f === 'bo2') return [p * p, 2 * p * (1 - p), (1 - p) * (1 - p)];
  const a = p * p * (3 - 2 * p); return [a, 0, 1 - a];
}
/** Series format from the number of games; a 2–0 counts as Bo2 when the league has draws (1–1) at all */
const formatOf = (n: number, leagueHasDraws: boolean): Fmt => (n === 1 ? 'bo1' : n === 2 && leagueHasDraws ? 'bo2' : 'bo3');

interface Line { m: DsMatch; a?: TeamX; b?: TeamX; f: Fmt; probs: [number, number, number]; result: 0 | 1 | 2; paid: number; start: number }

function Odds({ model }: { model: Model }) {
  const font = useHeaderFont();
  const elo = useMemo(() => eloTimeline(model), [model]);
  const lines = useMemo(() => {
    const out: Line[] = [];
    const draws = model.ds.matches.some(m => m.scoreA === m.scoreB && m.scoreA > 0);
    for (const m of model.ds.matches) {
      const gs = gamesOf(model, m.id); if (!gs.length) continue;
      const g0 = gs[0]; const r = elo.before.get(g0.id); if (!r) continue;
      const ra = g0.radiant === m.teamA ? r.a : r.b; const rb = g0.radiant === m.teamA ? r.b : r.a;
      const f = formatOf(gs.length, draws); const probs = seriesProbs(winProb(ra, rb), f);
      const result = m.scoreA > m.scoreB ? 0 : m.scoreA === m.scoreB ? 1 : 2;
      out.push({ m, a: model.teamById.get(m.teamA), b: model.teamById.get(m.teamB), f, probs, result, paid: odd(probs[result]), start: g0.start });
    }
    return out;
  }, [model, elo]);
  const [mode, setMode] = useState<'recent' | 'upsets'>('recent');
  const shown = useMemo(() => [...lines].sort((x, y) => (mode === 'recent' ? y.start - x.start : y.paid - x.paid)), [lines, mode]);
  const [listRef, fit] = useFitCount<HTMLDivElement>(56, 5, 3);
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(shown.length / fit)); const pg = Math.min(page, pages - 1);
  const favWon = lines.filter(l => l.result !== 1 && l.probs[l.result] >= Math.max(l.probs[0], l.probs[2])).length;
  const decided = lines.filter(l => l.result !== 1).length;

  // calculator
  const teams = useMemo(() => [...model.teams].sort((a, b) => (elo.now.get(b.id) ?? 0) - (elo.now.get(a.id) ?? 0)), [model, elo]);
  const [ta, setA] = useState(teams[0]?.id ?? ''); const [tb, setB] = useState(teams[1]?.id ?? '');
  const [fmt, setFmt] = useState<Fmt>('bo2');
  const A = model.teamById.get(ta); const B = model.teamById.get(tb);
  const pa = winProb(elo.now.get(ta) ?? 1500, elo.now.get(tb) ?? 1500);
  const cp = seriesProbs(pa, fmt);
  const h2h = useMemo(() => lines.filter(l => (l.m.teamA === ta && l.m.teamB === tb) || (l.m.teamA === tb && l.m.teamB === ta)), [lines, ta, tb]);
  const [side, setSide] = useState<'a' | 'b'>('a');

  const cell = (o: number, hit: boolean, label: string) => (
    <span className="w-[70px] rounded-lg py-1 text-center leading-tight" style={{ background: hit ? mix(C.win, 30) : ink(6), boxShadow: hit ? `inset 0 0 0 1px ${C.win}` : undefined }}>
      <span className="block text-[9px] uppercase tracking-widest" style={{ color: C.muted }}>{label}</span>
      <span className="block text-base font-bold tabular-nums" style={{ color: hit ? C.win : C.heading }}>{fmtOdd(o)}</span>
    </span>
  );

  return (
    <>
      <LabTitle sub={<Tip content="Kursy z rankingu Elo w chwili rozpoczęcia meczu (marża 6%). Remis możliwy tylko w meczach do dwóch gier."><span className="cursor-help">faworyt wygrał {decided ? Math.round((favWon / decided) * 100) : 0}% rozstrzygniętych meczów</span></Tip>}
        right={<Seg value={mode} onChange={v => { setMode(v); setPage(0); }} options={[{ value: 'recent', label: 'Ostatnie' }, { value: 'upsets', label: 'Niespodzianki' }]} />}>Kursy</LabTitle>
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        {/* board */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <div ref={listRef} className="flex-1 min-h-0 flex flex-col gap-[5px]">
            {shown.slice(pg * fit, pg * fit + fit).map(l => {
              const upset = l.paid >= 2.6;
              return (
                <div key={l.m.id} className="h-[56px] shrink-0 flex items-center gap-2.5 rounded-xl px-3" style={{ background: upset ? mix('#f2c94c', 12) : ink(4), boxShadow: upset ? `inset 0 0 0 1px ${mix('#f2c94c', 50)}` : undefined }}>
                  <span className="w-12 text-[11px] tabular-nums" style={{ color: C.muted }}>{fmtDay(l.start)}</span>
                  <TeamLogo team={l.a} size={30} />
                  <span className="flex-1 min-w-0 truncate text-sm font-bold">{l.a?.name} <span style={{ color: C.muted }}>–</span> {l.b?.name}</span>
                  <TeamLogo team={l.b} size={30} />
                  <span className="w-12 text-center font-bold tabular-nums" style={{ color: C.heading }}>{l.m.scoreA}:{l.m.scoreB}</span>
                  <span className="flex gap-1">
                    {cell(odd(l.probs[0]), l.result === 0, '1')}
                    {l.f === 'bo2' ? cell(odd(l.probs[1]), l.result === 1, 'X') : <span className="w-[70px]" />}
                    {cell(odd(l.probs[2]), l.result === 2, '2')}
                  </span>
                  <Tip content={upset ? 'Niespodzianka — wygrał kurs powyżej 2,60' : 'Kurs, który wszedł'}><span className="w-14 text-right text-sm font-bold tabular-nums cursor-help" style={{ color: upset ? '#f2c94c' : C.muted }}>×{fmtOdd(l.paid)}</span></Tip>
                </div>
              );
            })}
          </div>
          {pages > 1 && (
            <div className="shrink-0 flex items-center justify-center gap-2 mt-2">
              <button type="button" disabled={pg === 0} onClick={() => setPage(pg - 1)} className="w-9 h-9 rounded-full text-lg disabled:opacity-25" style={{ background: ink(8) }}>‹</button>
              <span className="text-xs tabular-nums w-14 text-center" style={{ color: C.muted }}>{pg + 1} / {pages}</span>
              <button type="button" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)} className="w-9 h-9 rounded-full text-lg disabled:opacity-25" style={{ background: ink(8) }}>›</button>
            </div>
          )}
        </div>
        {/* calculator */}
        <div className="w-[360px] shrink-0 rounded-3xl p-4 flex flex-col gap-3 min-h-0" style={{ background: `linear-gradient(170deg, ${mix(C.primary, 30)}, ${ink(3)} 55%)`, border: `1px solid ${ink(10)}` }}>
          <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: C.muted }}>Kalkulator · dzisiejsze Elo</div>
          <div className="flex items-center justify-between">
            {[{ t: A, k: 'a' as const }, { t: B, k: 'b' as const }].map(({ t, k }, i) => (
              <React.Fragment key={k}>
                {i === 1 && <span className="text-2xl font-logik-extended-bold" style={{ color: C.muted, ...font }}>vs</span>}
                <button type="button" onClick={() => setSide(k)} className="flex flex-col items-center gap-1.5 rounded-2xl p-2 w-[130px]" style={{ background: side === k ? mix(C.primary, 40) : 'transparent', boxShadow: side === k ? `0 0 0 2px ${C.secondary}` : undefined }}>
                  <TeamLogo team={t} size={72} />
                  <span className="text-sm font-bold truncate max-w-full" style={{ color: C.heading }}>{t?.name}</span>
                  <span className="text-[11px] tabular-nums" style={{ color: C.muted }}>Elo {Math.round(elo.now.get(t?.id ?? '') ?? 1500)}</span>
                </button>
              </React.Fragment>
            ))}
          </div>
          <Seg size="sm" className="self-center" value={fmt} onChange={setFmt} options={[{ value: 'bo1', label: 'Bo1' }, { value: 'bo2', label: 'Bo2' }, { value: 'bo3', label: 'Bo3' }]} />
          <AnimatePresence mode="wait">
            <motion.div key={`${ta}${tb}${fmt}`} className="flex gap-2" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              {[['1', cp[0]], ...(fmt === 'bo2' ? [['X', cp[1]]] : []), ['2', cp[2]]].map(([l, p]) => (
                <Tip key={l as string} content={`${Math.round((p as number) * 100)}% szans`}>
                  <div className="flex-1 rounded-2xl py-3 text-center cursor-help" style={{ background: ink(8) }}>
                    <div className="text-xs uppercase tracking-widest" style={{ color: C.muted }}>{l}</div>
                    <div className="text-3xl font-logik-extended-bold tabular-nums" style={{ color: C.heading, ...font }}>{fmtOdd(odd(p as number))}</div>
                  </div>
                </Tip>
              ))}
            </motion.div>
          </AnimatePresence>
          <div className="text-[10px] uppercase tracking-[0.3em] mt-1" style={{ color: C.muted }}>Wybierz drużynę · {side === 'a' ? 'lewa' : 'prawa'} strona</div>
          <div className="flex-1 min-h-0 flex flex-wrap gap-1.5 content-start">
            {teams.map(t => {
              const on = t.id === (side === 'a' ? ta : tb); const other = t.id === (side === 'a' ? tb : ta);
              return (
                <Tip key={t.id} content={t.name}>
                  <button type="button" disabled={other} onClick={() => (side === 'a' ? setA(t.id) : setB(t.id))} className="rounded-lg p-1 disabled:opacity-25"
                    style={{ background: on ? mix(C.primary, 45) : ink(5), boxShadow: on ? `0 0 0 2px ${C.secondary}` : undefined }}>
                    <TeamLogo team={t} size={30} />
                  </button>
                </Tip>
              );
            })}
          </div>
          {h2h.length > 0 && (
            <Tip content={<TipBody title="Bezpośrednie mecze">{h2h.map(l => `${l.a?.name} ${l.m.scoreA}:${l.m.scoreB} ${l.b?.name}`).join(' · ')}</TipBody>}>
              <div className="text-xs cursor-help" style={{ color: C.muted }}>Grali ze sobą {h2h.length}× · ostatnio {h2h[h2h.length - 1].a?.name} {h2h[h2h.length - 1].m.scoreA}:{h2h[h2h.length - 1].m.scoreB} {h2h[h2h.length - 1].b?.name}</div>
            </Tip>
          )}
        </div>
      </div>
    </>
  );
}

export default function D80Odds() {
  return <LabView><WithModel>{m => <Odds model={m} />}</WithModel></LabView>;
}
