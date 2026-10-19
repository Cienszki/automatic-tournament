'use client';

// #74 — Report card. A school certificate for every player: a grade from 1 to 6 in each subject
// (fighting, farm, growth, damage, teamwork, vision, survival, sieges) from their percentile among
// players of the same position, the average, a red stripe for an average of 4.75 or more, and the
// form teacher's comment (not always kind). Pick a team and a player on the left.

import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, PlayerX } from '@/lib/stats-lab/derive';
import { metric } from '@/lib/stats-lab/metrics';
import { ROLE_LABEL, SUBJECTS, profiles } from '@/lib/stats-lab/season';
import { Avatar, LabTitle, LabView, TeamLogo, Tip, TipBody, WithModel, useHeaderFont } from '../kit';
import { PlayerPicker, usePlayerPick } from '../picker';

const PAPER = '#f6f1e3';
const INK = '#1f2a44';
const HAND: React.CSSProperties = { fontFamily: '"Segoe Script", "Bradley Hand", "Comic Sans MS", cursive', color: '#1d3fa8' };
const WORD = ['', 'niedostateczny', 'dopuszczający', 'dostateczny', 'dobry', 'bardzo dobry', 'celujący'];

const grade = (pr: number) => (pr >= 0.9 ? 6 : pr >= 0.7 ? 5 : pr >= 0.45 ? 4 : pr >= 0.2 ? 3 : pr >= 0.08 ? 2 : 1);

const PRAISE: Record<string, string> = {
  kda: 'W walce bezkonkurencyjny — wraca do bazy tylko po przedmioty.',
  gpm: 'Farmi tak, że creepy chowają się na jego widok.',
  xpm: 'Rośnie w oczach, poziomy zdobywa szybciej niż koledzy z ławki.',
  hdpm: 'Zadaje obrażenia jak na ostatniej lekcji przed wakacjami.',
  kp: 'Zawsze tam, gdzie drużyna. Wzór koleżeństwa.',
  wards: 'Widzi wszystko. Nauczyciel podejrzewa ściąganie.',
  deaths: 'Prawie nie umiera. Rodzice mogą być spokojni.',
  towerDamage: 'Wieże wroga drżą przed jego wizytą.',
};
const SCOLD: Record<string, string> = {
  kda: 'Częściej leży niż walczy. Prosimy o więcej uwagi.',
  gpm: 'Farma na poziomie wycieczki szkolnej. Do poprawy.',
  xpm: 'Poziomy zdobywa jakby odrabiał zadanie domowe w przerwie.',
  hdpm: 'Obrażenia zadaje głównie sobie.',
  kp: 'Na walkach drużyny bywa rzadziej niż na WF-ie.',
  wards: 'Wardy nosi w plecaku do końca gry.',
  deaths: 'Ginie częściej niż oddaje prace domowe.',
  towerDamage: 'Wież nie dotyka — może myśli, że są pod ochroną.',
};

function Certificate({ p, grades }: { p: PlayerX; grades: Record<string, number> }) {
  const font = useHeaderFont();
  const list = SUBJECTS.map(s => ({ s, g: grades[s.key] ?? 3 }));
  const avg = list.reduce((a, x) => a + x.g, 0) / list.length;
  const stripe = avg >= 4.75;
  const best = [...list].sort((a, b) => b.g - a.g)[0];
  const worst = [...list].sort((a, b) => a.g - b.g)[0];
  const promoted = list.filter(x => x.g === 1).length < 2;
  return (
    <div className="relative h-full w-full rounded-lg overflow-hidden flex flex-col px-8 py-5" style={{ background: `repeating-linear-gradient(0deg, transparent 0 27px, rgba(31,42,68,0.05) 27px 28px), ${PAPER}`, color: INK, boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}>
      {stripe && <div className="absolute -left-16 top-24 w-[160%] h-6 -rotate-[24deg] origin-left" style={{ background: '#c8102e', opacity: 0.88 }} />}
      <div className="absolute inset-3 border-2 pointer-events-none" style={{ borderColor: 'rgba(31,42,68,0.25)' }} />
      <div className="relative text-center">
        <div className="text-[10px] uppercase tracking-[0.4em] opacity-70">Liga · sezon</div>
        <div className="text-3xl font-logik-extended-bold uppercase tracking-wider" style={font}>Świadectwo</div>
        <div className="text-xs opacity-75">ukończenia sezonu</div>
      </div>
      <div className="relative flex items-center gap-4 mt-3">
        <div className="p-1 bg-white shadow-md rotate-[-2deg]"><Avatar player={p} size={78} className="!rounded-none" /></div>
        <div className="flex-1 min-w-0 text-sm leading-relaxed">
          <div>Uczeń <span className="text-2xl font-bold" style={HAND}>{p.name}</span></div>
          <div className="flex items-center gap-1.5">klasa <TeamLogo team={p.team} size={18} /><span style={HAND} className="text-lg">{p.team?.name ?? '—'}</span></div>
          <div>profil <span style={HAND} className="text-lg">{p.role ? ROLE_LABEL[p.role] : 'bez profilu'}</span> · <span className="opacity-70">{p.games} obecności</span></div>
        </div>
      </div>
      <div className="relative mt-3 flex-1 min-h-0 grid grid-cols-2 gap-x-8 content-start">
        {list.map(({ s, g }) => {
          const m = metric(s.key);
          return (
            <Tip key={s.key} content={<TipBody title={s.name}>{m.label}: średnio {s.key === 'kp' ? m.fmt(p.agg[s.key].avg ?? 0) : (p.agg[s.key].avg ?? 0).toFixed(m.avgDigits)} na grę — ocena względem graczy na tej samej pozycji</TipBody>}>
              <div className="flex items-baseline justify-between border-b border-dotted py-1.5 cursor-help" style={{ borderColor: 'rgba(31,42,68,0.35)' }}>
                <span className="text-sm font-bold">{s.name}</span>
                <span className="text-xl" style={{ ...HAND, color: g === 1 ? '#c8102e' : HAND.color }}>{WORD[g]} ({g})</span>
              </div>
            </Tip>
          );
        })}
      </div>
      <div className="relative flex items-end justify-between gap-6 mt-2">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.3em] opacity-70">Uwagi wychowawcy</div>
          <div className="text-[15px] leading-snug" style={HAND}>{best.g >= 5 ? PRAISE[best.s.key] : ''} {worst.g <= 2 ? SCOLD[worst.s.key] : best.g < 5 ? 'Uczeń przeciętny, ale z potencjałem.' : ''}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs">średnia ocen</div>
          <div className="text-4xl font-bold tabular-nums" style={HAND}>{avg.toFixed(2)}</div>
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: promoted ? INK : '#c8102e' }}>{promoted ? (stripe ? 'promocja z wyróżnieniem' : 'otrzymuje promocję') : 'nie otrzymuje promocji'}</div>
        </div>
      </div>
    </div>
  );
}

function ReportCard({ model }: { model: Model }) {
  const pick = usePlayerPick(model);
  const prof = useMemo(() => profiles(model, true), [model]);
  const p = pick.player;
  const pr = p ? prof.get(p.id) : undefined;
  const grades = pr ? Object.fromEntries(Object.entries(pr).map(([k, v]) => [k, grade(v)])) : null;
  const classRank = useMemo(() => {
    const out = [...prof.entries()].map(([id, r]) => ({ id, avg: SUBJECTS.reduce((a, s) => a + grade(r[s.key]), 0) / SUBJECTS.length })).sort((a, b) => b.avg - a.avg);
    return out;
  }, [prof]);
  const stripes = classRank.filter(x => x.avg >= 4.75).length;

  return (
    <>
      <LabTitle sub={<Tip content="Ocena z percentyla wśród graczy tej samej pozycji z min. liczbą gier: 6 = najlepsze 10%, 5 = 70–90%, 4 = 45–70%, 3 = 20–45%, 2 = 8–20%, 1 = najsłabsze 8%"><span className="cursor-help">{stripes} świadectw z czerwonym paskiem</span></Tip>}>Świadectwo</LabTitle>
      <div className="flex-1 min-h-0 flex gap-6 mt-3">
        <PlayerPicker pick={pick} className="w-[34%] shrink-0" size={80} />
        <div className="flex-1 min-w-0 flex justify-center min-h-0">
          <AnimatePresence mode="wait">
            <motion.div key={p?.id ?? 'none'} className="h-full aspect-[0.86] max-w-full" initial={{ opacity: 0, y: 20, rotate: 1.5 }} animate={{ opacity: 1, y: 0, rotate: 0 }} exit={{ opacity: 0, y: -10 }}>
              {p && grades ? <Certificate p={p} grades={grades} /> : (
                <div className="h-full rounded-lg flex items-center justify-center text-center p-8" style={{ background: PAPER, color: INK }}>
                  <span style={HAND} className="text-2xl">{p?.name ?? 'Ten uczeń'} — za mało obecności, by wystawić oceny.</span>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

export default function D74ReportCard() {
  return <LabView><WithModel>{m => <ReportCard model={m} />}</WithModel></LabView>;
}
