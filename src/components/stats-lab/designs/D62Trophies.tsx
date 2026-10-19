'use client';

// #62 — Trophy cabinet. Everything a player won this season, on glass shelves: a cup for every
// tournament record they hold, gold and silver achievement medals, a statuette for game MVPs and a
// plaque for every Team of the Week. The list on the left ranks the fullest cabinets.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, Perf, PlayerX } from '@/lib/stats-lab/derive';
import { topPerfs } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { metric, type MetricKey } from '@/lib/stats-lab/metrics';
import { computeAchievements, TIER_COLOR, TIER_NAME } from '@/lib/stats-lab/achievements';
import { fmtShort, mondayOf, plural } from '@/lib/stats-lab/season';
import { Avatar, C, LabTitle, LabView, TeamLogo, Tip, TipBody, WithModel, ink, mix, useFitCount, useHeaderFont, useSize } from '../kit';

type Kind = 'cup' | 'gold' | 'silver' | 'mvp' | 'week';
interface Trophy { kind: Kind; label: string; detail: string; n?: number }
interface Cabinet { p: PlayerX; trophies: Trophy[]; points: number }

const PTS: Record<Kind, number> = { cup: 10, gold: 6, silver: 3, mvp: 1, week: 2 };
const RECORDS: MetricKey[] = ['kills', 'assists', 'kda', 'gpm', 'xpm', 'lastHits', 'heroDamage', 'towerDamage', 'heroHealing', 'wards', 'dewards', 'stacks', 'netWorth', 'score'];
const ROLES = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'];

function buildCabinets(model: Model): Cabinet[] {
  const map = new Map<string, Cabinet>();
  const get = (p: PlayerX) => { let c = map.get(p.id); if (!c) { c = { p, trophies: [], points: 0 }; map.set(p.id, c); } return c; };
  const add = (p: PlayerX, t: Trophy, pts: number) => { const c = get(p); c.trophies.push(t); c.points += pts; };
  for (const k of RECORDS) {
    const r = topPerfs(model, k, 1)[0];
    if (r?.player) { const m = metric(k); add(r.player, { kind: 'cup', label: m.label, detail: `Rekord turnieju: ${m.fmt(m.get(r))} · ${heroName(r.heroId)}` }, PTS.cup); }
  }
  for (const s of computeAchievements(model)) for (const u of s.unlocks) {
    if (u.tier < 1) continue;
    add(u.player, { kind: u.tier === 2 ? 'gold' : 'silver', label: s.a.name, detail: `${TIER_NAME[u.tier]} · ${u.value.toLocaleString('pl-PL')}${u.perf ? ` · ${heroName(u.perf.heroId)}` : ''}` }, PTS[u.tier === 2 ? 'gold' : 'silver']);
  }
  const mvps = new Map<string, number>();
  for (const g of model.games) if (g.mvp?.player) mvps.set(g.mvp.pid, (mvps.get(g.mvp.pid) ?? 0) + 1);
  for (const [id, n] of mvps) { const p = model.playerById.get(id); if (p) add(p, { kind: 'mvp', label: 'MVP gry', detail: `Najwięcej punktów występu w ${n} ${plural(n, 'grze', 'grach', 'grach')}`, n }, PTS.mvp * n); }
  // Team of the week: best average per role each week
  const weeks = new Map<string, Perf[]>();
  for (const p of model.perfs) if (p.player?.role && Number.isFinite(p.score)) { const k = mondayOf(p.game.start); if (!weeks.has(k)) weeks.set(k, []); weeks.get(k)!.push(p); }
  const tow = new Map<string, string[]>();
  for (const [wk, list] of weeks) for (const role of ROLES) {
    const by = new Map<string, Perf[]>();
    for (const p of list) if (p.player!.role === role) { if (!by.has(p.pid)) by.set(p.pid, []); by.get(p.pid)!.push(p); }
    const best = [...by.entries()].map(([id, l]) => ({ id, v: l.reduce((a, x) => a + x.score, 0) / l.length })).sort((a, b) => b.v - a.v)[0];
    if (best) tow.set(best.id, [...(tow.get(best.id) ?? []), fmtShort(wk)]);
  }
  for (const [id, wks] of tow) { const p = model.playerById.get(id); if (p) add(p, { kind: 'week', label: 'Drużyna tygodnia', detail: `Tygodnie: ${wks.join(', ')}`, n: wks.length }, PTS.week * wks.length); }
  const order: Kind[] = ['cup', 'gold', 'mvp', 'week', 'silver'];
  for (const c of map.values()) c.trophies.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  return [...map.values()].sort((a, b) => b.points - a.points || b.trophies.length - a.trophies.length);
}

function TrophyArt({ t, size }: { t: Trophy; size: number }) {
  const id = `tg-${t.kind}`;
  const metal = t.kind === 'silver' ? TIER_COLOR[1] : t.kind === 'week' ? '#c98a55' : TIER_COLOR[2];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="drop-shadow-[0_8px_10px_rgba(0,0,0,0.5)]">
      <defs><linearGradient id={id} x1="0" x2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.9" /><stop offset="0.25" stopColor={metal} /><stop offset="0.7" stopColor={metal} /><stop offset="1" stopColor="#3a2a10" /></linearGradient></defs>
      {t.kind === 'cup' && (<>
        <path d="M28 14 H72 V34 C72 52 62 60 50 62 C38 60 28 52 28 34 Z" fill={`url(#${id})`} />
        <path d="M28 20 C12 20 12 44 31 46 M72 20 C88 20 88 44 69 46" fill="none" stroke={metal} strokeWidth="5" />
        <rect x="45" y="61" width="10" height="14" fill={metal} /><rect x="32" y="75" width="36" height="9" rx="2" fill={`url(#${id})`} /><rect x="27" y="84" width="46" height="9" rx="2" fill="#3b2a1a" />
      </>)}
      {(t.kind === 'gold' || t.kind === 'silver') && (<>
        <path d="M36 6 L46 40 L54 40 L64 6 L56 6 L50 26 L44 6 Z" fill={C.primary} />
        <circle cx="50" cy="64" r="26" fill={`url(#${id})`} stroke="rgba(0,0,0,0.3)" strokeWidth="2" /><circle cx="50" cy="64" r="18" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" />
      </>)}
      {t.kind === 'mvp' && (<>
        <path d="M50 8 L58 30 L82 30 L63 44 L70 67 L50 53 L30 67 L37 44 L18 30 L42 30 Z" fill={`url(#${id})`} />
        <rect x="40" y="66" width="20" height="10" fill={metal} /><rect x="28" y="76" width="44" height="16" rx="2" fill="#3b2a1a" />
      </>)}
      {t.kind === 'week' && (<>
        <path d="M18 10 H82 V70 L50 94 L18 70 Z" fill="#5a3b1e" stroke="#2c1c0d" strokeWidth="3" />
        <rect x="28" y="24" width="44" height="30" rx="3" fill={`url(#${id})`} />
      </>)}
      {t.n != null && t.n > 1 && <text x="50" y={t.kind === 'week' ? 46 : t.kind === 'mvp' ? 89 : 50} textAnchor="middle" fontSize="16" fontWeight="900" fill={t.kind === 'mvp' ? '#fff' : '#2a1a08'}>×{t.n}</text>}
    </svg>
  );
}

function Trophies({ model }: { model: Model }) {
  const font = useHeaderFont();
  const cabs = useMemo(() => buildCabinets(model), [model]);
  const [selId, setSel] = useState<string | null>(null);
  const sel = cabs.find(c => c.p.id === selId) ?? cabs[0];
  const [listRef, fit] = useFitCount<HTMLDivElement>(52, 5, 3);
  const [box, size] = useSize<HTMLDivElement>();
  const n = sel?.trophies.length ?? 0;
  // three shelves; trophy size so they all fit
  const shelves = 3;
  const perShelf = Math.max(1, Math.ceil(n / shelves));
  const tsz = Math.max(40, Math.min(110, Math.floor((size.w - 40) / perShelf) - 14, Math.floor(size.h / shelves) - 46));
  const rows = Array.from({ length: shelves }, (_, i) => sel?.trophies.slice(i * perShelf, i * perShelf + perShelf) ?? []);

  return (
    <>
      <LabTitle sub={<Tip content={<TipBody title="Punkty gabloty">rekord 10 · złoto 6 · srebro 3 · drużyna tygodnia 2 · MVP gry 1</TipBody>}><span className="cursor-help">{cabs.length} graczy z trofeami</span></Tip>}>Gablota trofeów</LabTitle>
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        <div ref={listRef} className="w-[300px] shrink-0 flex flex-col gap-[5px] min-h-0">
          {cabs.slice(0, fit).map((c, i) => {
            const on = c === sel;
            return (
              <button key={c.p.id} type="button" onClick={() => setSel(c.p.id)} className="h-[52px] shrink-0 flex items-center gap-3 rounded-xl px-2.5 text-left"
                style={{ background: on ? mix(C.primary, 40) : ink(4), boxShadow: on ? `inset 0 0 0 1px ${C.secondary}` : undefined }}>
                <span className="w-5 text-sm font-bold tabular-nums" style={{ color: C.muted }}>{i + 1}</span>
                <Avatar player={c.p} size={38} />
                <span className="flex-1 min-w-0 truncate font-bold">{c.p.name}</span>
                <span className="text-xs tabular-nums" style={{ color: TIER_COLOR[2] }}>{c.trophies.filter(t => t.kind === 'cup').length || ''}</span>
                <span className="w-10 text-right text-lg font-bold tabular-nums" style={{ color: C.heading }}>{c.points}</span>
              </button>
            );
          })}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-3 min-h-0">
          {sel && (
            <div className="shrink-0 flex items-center gap-4">
              <Avatar player={sel.p} size={72} ring={TIER_COLOR[2]} />
              <div className="min-w-0">
                <div className="text-3xl font-logik-extended-bold uppercase truncate" style={{ color: C.heading, ...font }}>{sel.p.name}</div>
                <div className="flex items-center gap-2 text-sm" style={{ color: C.muted }}><TeamLogo team={sel.p.team} size={20} />{sel.p.team?.name} · {sel.trophies.length} trofeów · {sel.points} pkt</div>
              </div>
            </div>
          )}
          {/* cabinet */}
          <div className="flex-1 min-h-0 rounded-2xl p-3" style={{ background: 'linear-gradient(180deg, #3b2614, #24170b)', boxShadow: 'inset 0 0 0 6px #4a3019, 0 20px 50px rgba(0,0,0,0.5)' }}>
            <div ref={box} className="relative h-full rounded-lg overflow-hidden flex flex-col" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02)), #120c06' }}>
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.07) 48%, transparent 56%)' }} />
              <AnimatePresence mode="wait">
                <motion.div key={sel?.p.id} className="flex-1 flex flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {rows.map((row, r) => (
                    <div key={r} className="flex-1 flex flex-col justify-end">
                      <div className="flex items-end justify-center gap-[14px] px-4">
                        {row.map((t, k) => (
                          <Tip key={k} content={<TipBody title={t.label}>{t.detail}</TipBody>}>
                            <motion.div className="flex flex-col items-center cursor-help" style={{ width: tsz }} initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: (r * perShelf + k) * 0.04 }} whileHover={{ y: -6 }}>
                              <TrophyArt t={t} size={tsz} />
                              <span className="text-[10px] text-center leading-tight text-white/70 truncate max-w-full">{t.label}</span>
                            </motion.div>
                          </Tip>
                        ))}
                      </div>
                      <div className="h-2.5 mx-2 mt-1 rounded-sm" style={{ background: 'linear-gradient(180deg, rgba(200,230,255,0.35), rgba(200,230,255,0.08))', boxShadow: '0 6px 10px rgba(0,0,0,0.5)' }} />
                    </div>
                  ))}
                  {!n && <div className="absolute inset-0 flex items-center justify-center text-white/50">Gablota czeka na pierwsze trofeum</div>}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function D62Trophies() {
  return <LabView><WithModel>{m => <Trophies model={m} />}</WithModel></LabView>;
}
