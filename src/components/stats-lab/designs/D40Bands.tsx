'use client';

// #40 — Bands. The hub as stacked horizontal bands. Closed bands are slim strips with their key
// number; the open band fills the space with a small interactive section (switch the leaders'
// metric, flip through records, compare heroes…). Click a strip to open it; until you do, the
// bands take turns every 8 s.

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model } from '@/lib/stats-lab/derive';
import { rankPlayers } from '@/lib/stats-lab/derive';
import { metric, type MetricKey } from '@/lib/stats-lab/metrics';
import { heroName } from '@/lib/stats-lab/heroes';
import { eloTable, type Fact } from '@/lib/stats-lab/teasers';
import { REDESIGN_NAMES } from '../preview';
import { Avatar, C, HeroImg, LabTitle, Seg, TeamLogo, Tip, ink, mix, useHeaderFont, wrColor } from '../kit';
import { FactCard, HubShell, useFacts } from '../hub';

const TURN_MS = 8000;
const ROAST = '#ff8a3d';
const LEAD_KEYS: MetricKey[] = ['score', 'kills', 'gpm', 'wards', 'heroDamage'];

function Leaders({ model }: { model: Model }) {
  const font = useHeaderFont();
  const [k, setK] = useState<MetricKey>('score');
  const rows = useMemo(() => rankPlayers(model, k, 'avg').slice(0, 5), [model, k]);
  const m = metric(k);
  return (
    <div className="h-full flex flex-col gap-3">
      <Seg value={k} onChange={setK} options={LEAD_KEYS.map(x => ({ value: x, label: metric(x).label, tip: metric(x).desc }))} className="self-start" />
      <div className="flex-1 min-h-0 flex items-end gap-4">
        {rows.map((r, i) => (
          <motion.div key={`${k}-${r.player.id}`} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="flex-1 min-w-0 flex flex-col items-center">
            <Avatar player={r.player} size={i === 0 ? 96 : 72} ring={i === 0 ? C.secondary : undefined} />
            <div className="mt-2 text-base font-bold truncate max-w-full">{r.player.name}</div>
            <div className="text-3xl font-logik-extended-bold tabular-nums" style={{ color: i === 0 ? C.secondary : undefined, ...font }}>{r.value.toLocaleString('pl-PL', { maximumFractionDigits: m.avgDigits })}</div>
            <div className="w-full mt-2 rounded-t-xl" style={{ height: `${30 + (r.value / rows[0].value) * 70}px`, background: `linear-gradient(180deg, ${mix(i === 0 ? C.secondary : C.primary, 45)}, transparent)` }} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Records({ facts }: { facts: Fact[] }) {
  const recs = facts.filter(f => f.id.startsWith('rec-')).slice(0, 8);
  const [page, setPage] = useState(0);
  const per = 4; const pages = Math.ceil(recs.length / per);
  return (
    <div className="h-full flex gap-3 items-stretch">
      <AnimatePresence mode="popLayout">
        {recs.slice(page * per, page * per + per).map((f, i) => (
          <motion.div key={f.id} className="flex-1 min-w-0 rounded-2xl overflow-hidden" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ delay: i * 0.05 }}>
            <FactCard f={f} size="md" className="w-full h-full" />
          </motion.div>
        ))}
      </AnimatePresence>
      {pages > 1 && <button type="button" onClick={e => { e.stopPropagation(); setPage(p => (p + 1) % pages); }} className="shrink-0 w-14 rounded-2xl text-3xl" style={{ background: ink(8) }} aria-label="Więcej rekordów">›</button>}
    </div>
  );
}

function Heroes({ model }: { model: Model }) {
  const font = useHeaderFont();
  const hs = model.heroes.slice(0, 7);
  const max = Math.max(1, ...hs.map(h => h.contest));
  return (
    <div className="h-full flex gap-3">
      {hs.map((h, i) => (
        <Tip key={h.heroId} content={`${heroName(h.heroId)} · ${h.picks} pick · ${h.bans} ban · ${Math.round(h.wr * 100)}% wygranych`}>
          <motion.div className="flex-1 min-w-0 flex flex-col gap-2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <div className="relative flex-1 min-h-0 rounded-xl overflow-hidden">
              <HeroImg heroId={h.heroId} className="absolute inset-0 w-full h-full" />
              <span className="absolute top-1.5 left-1.5 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: C.secondary, color: '#000' }}>{i + 1}</span>
            </div>
            <div className="text-sm font-bold truncate">{heroName(h.heroId)}</div>
            <div className="flex h-2.5 rounded-full overflow-hidden" style={{ background: ink(8) }}>
              <div style={{ width: `${(h.picks / max) * 100}%`, background: C.primary }} />
              <div style={{ width: `${(h.bans / max) * 100}%`, background: C.muted }} />
            </div>
            <div className="flex justify-between text-xs"><span className="tabular-nums">{h.contest}× w drafcie</span><b className="tabular-nums" style={{ color: wrColor(h.wr), ...font }}>{Math.round(h.wr * 100)}%</b></div>
          </motion.div>
        </Tip>
      ))}
    </div>
  );
}

function Teams({ model }: { model: Model }) {
  const font = useHeaderFont();
  const rows = eloTable(model).slice(0, 6);
  const lo = Math.min(...rows.map(r => r.v)) - 30; const hi = rows[0]?.v ?? 1600;
  return (
    <div className="h-full grid grid-cols-2 gap-x-8 gap-y-2 content-center">
      {rows.map((r, i) => (
        <motion.div key={r.t.id} className="flex items-center gap-3" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
          <span className="w-6 text-lg font-bold tabular-nums" style={{ color: C.muted }}>{i + 1}</span>
          <TeamLogo team={r.t} size={52} />
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold truncate">{r.t.name}</div>
            <div className="h-2.5 rounded-full overflow-hidden mt-1" style={{ background: ink(8) }}><motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${((r.v - lo) / (hi - lo)) * 100}%` }} style={{ background: i === 0 ? C.secondary : C.primary }} /></div>
          </div>
          <span className="text-2xl font-logik-extended-bold tabular-nums" style={font}>{Math.round(r.v)}</span>
        </motion.div>
      ))}
    </div>
  );
}

function Roasts({ facts }: { facts: Fact[] }) {
  const rs = facts.filter(f => f.tone === 'roast').slice(0, 4);
  return (
    <div className="h-full grid grid-cols-2 gap-3">
      {rs.map((f, i) => (
        <motion.div key={f.id} className="rounded-2xl p-4 flex items-center gap-4" initial={{ opacity: 0, rotate: i % 2 ? 2 : -2, y: 10 }} animate={{ opacity: 1, rotate: 0, y: 0 }} transition={{ delay: i * 0.06 }}
          style={{ background: 'rgba(255,138,61,0.12)', border: '1px dashed rgba(255,138,61,0.55)' }}>
          {f.player ? <Avatar player={f.player} size={64} ring={ROAST} /> : f.team ? <TeamLogo team={f.team} size={64} /> : null}
          <div className="min-w-0"><div className="text-xs font-bold uppercase tracking-wider" style={{ color: ROAST }}>{f.kicker.replace('Wpadka · ', '')} · {f.big}</div><div className="text-base italic leading-snug">„{f.sub}”</div></div>
        </motion.div>
      ))}
    </div>
  );
}

const BANDS = [
  { id: 'leaders', label: 'Liderzy', page: 2 },
  { id: 'records', label: 'Rekordy', page: 1 },
  { id: 'heroes', label: 'Bohaterowie', page: 3 },
  { id: 'teams', label: 'Ranking drużyn', page: 23 },
  { id: 'roasts', label: 'Wpadki', page: 27 },
] as const;

function Bands({ model, open, isOpen }: { model: Model; open: (n: number) => void; isOpen: boolean }) {
  const font = useHeaderFont();
  const facts = useFacts(model);
  const [active, setActive] = useState(0);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (touched || isOpen) return;
    const t = setTimeout(() => setActive(a => (a + 1) % BANDS.length), TURN_MS);
    return () => clearTimeout(t);
  }, [active, touched, isOpen]);

  const mvp = rankPlayers(model, 'score', 'avg')[0];
  const rec = facts.find(f => f.id === 'rec-kills');
  const hero = model.heroes[0];
  const elo = eloTable(model)[0];
  const roast = facts.find(f => f.tone === 'roast');
  const peek: Record<string, React.ReactNode> = {
    leaders: mvp && <><Avatar player={mvp.player} size={36} /><b>{mvp.player.name}</b><span className="tabular-nums">{mvp.value.toFixed(1)} pkt</span></>,
    records: rec && <><Avatar player={rec.player} size={36} /><b>{rec.title}</b><span className="tabular-nums">{rec.big} zabójstw</span></>,
    heroes: hero && <><HeroImg heroId={hero.heroId} variant="icon" className="w-9 h-9 rounded-full" /><b>{heroName(hero.heroId)}</b><span className="tabular-nums">{hero.contest}× w drafcie</span></>,
    teams: elo && <><TeamLogo team={elo.t} size={36} /><b>{elo.t.name}</b><span className="tabular-nums">{Math.round(elo.v)} Elo</span></>,
    roasts: roast && <><Avatar player={roast.player} size={36} ring={ROAST} /><b>{roast.title}</b><span className="italic truncate">„{roast.sub}”</span></>,
  };

  return (
    <>
      <LabTitle sub={<span>kliknij pasmo, by je rozwinąć</span>}>Pasma</LabTitle>
      <div className="flex-1 min-h-0 flex flex-col gap-2 mt-3">
        {BANDS.map((b, i) => {
          const on = i === active;
          return (
            <motion.div key={b.id} layout className="rounded-2xl overflow-hidden flex flex-col min-h-0" style={{ background: on ? ink(5) : ink(3), border: `1px solid ${on ? mix(C.secondary, 50) : ink(8)}` }}
              animate={{ flexGrow: on ? 1 : 0 }} transition={{ type: 'spring', stiffness: 160, damping: 24 }}>
              <button type="button" onClick={() => { setActive(i); setTouched(true); }} className="shrink-0 h-[58px] flex items-center gap-4 px-4 text-left">
                <span className="w-1.5 h-8 rounded-full" style={{ background: on ? C.secondary : ink(20) }} />
                <span className="w-56 text-xl font-logik-extended-bold uppercase" style={{ color: on ? C.heading : C.text, ...font }}>{b.label}</span>
                <span className="flex-1 min-w-0 flex items-center gap-3 text-sm" style={{ opacity: on ? 0 : 0.85 }}>{peek[b.id]}</span>
                {on && <span onClick={e => { e.stopPropagation(); open(b.page); }} className="rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest" style={{ background: C.primary, color: '#fff' }}>Otwórz: {REDESIGN_NAMES[b.page - 1]}</span>}
              </button>
              <AnimatePresence>
                {on && (
                  <motion.div className="flex-1 min-h-0 px-4 pb-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: 0.15 }}>
                    {b.id === 'leaders' && <Leaders model={model} />}
                    {b.id === 'records' && <Records facts={facts} />}
                    {b.id === 'heroes' && <Heroes model={model} />}
                    {b.id === 'teams' && <Teams model={model} />}
                    {b.id === 'roasts' && <Roasts facts={facts} />}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </>
  );
}

export default function D40Bands() {
  return <HubShell render={(m, x) => <Bands model={m} open={x.open} isOpen={x.isOpen} />} />;
}
