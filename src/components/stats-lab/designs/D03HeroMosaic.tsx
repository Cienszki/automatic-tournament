'use client';

// #3 — Hero meta mosaic. Every hero is a tile; brightness = how contested it is, the bar under
// it splits picks vs bans, the dot is its win rate. Click a tile for the hero's story.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getAllHeroData } from '@/lib/hero-mapping';
import { opponentOf, type HeroX, type Model } from '@/lib/stats-lab/derive';
import { ATTR_COLOR, heroAttr, heroName, type HeroAttr } from '@/lib/stats-lab/heroes';
import { fmtPct } from '@/lib/stats-lab/metrics';
import { Avatar, C, HeroImg, HeroRender, LabTitle, LabView, Seg, TeamLogo, Tip, TipBody, WithModel, ink, mix, playerTip, useHeaderFont, useSize, wrColor } from '../kit';
import { plural } from '@/lib/plural';

type SortKey = 'contest' | 'picks' | 'bans' | 'wr';
const SORTS: Array<{ value: SortKey; label: string; tip: string }> = [
  { value: 'contest', label: 'Sporne', tip: 'Picki + bany — jak bardzo bohater był pożądany' },
  { value: 'picks', label: 'Picki', tip: 'Ile razy bohater został wybrany' },
  { value: 'bans', label: 'Bany', tip: 'Ile razy bohater został zbanowany' },
  { value: 'wr', label: 'Wygrane', tip: 'Procent wygranych gier (bohaterowie z min. 3 grami)' },
];
type AttrFilter = 'any' | HeroAttr;
const ATTRS: Array<{ value: AttrFilter; label: React.ReactNode }> = [
  { value: 'any', label: 'Wszyscy' },
  { value: 'str', label: <span style={{ color: ATTR_COLOR.str }}>Siła</span> },
  { value: 'agi', label: <span style={{ color: ATTR_COLOR.agi }}>Zręczność</span> },
  { value: 'int', label: <span style={{ color: ATTR_COLOR.int }}>Inteligencja</span> },
  { value: 'all', label: <span style={{ color: ATTR_COLOR.all }}>Uniwersalni</span> },
];

function emptyHero(heroId: number): HeroX {
  return { heroId, picks: 0, wins: 0, bans: 0, contest: 0, pickRate: 0, banRate: 0, contestRate: 0, wr: 0, radiant: { picks: 0, wins: 0 }, dire: { picks: 0, wins: 0 }, firstPhaseBans: 0, perfs: [], avgK: 0, avgD: 0, avgA: 0, avgGpm: 0, players: [] };
}

/** Largest 16:9 tile that fits n tiles in w×h */
function fitTiles(n: number, w: number, h: number, gap: number) {
  let best = { cols: 10, tw: 40 };
  for (let cols = 6; cols <= 30; cols++) {
    const tw = (w - gap * (cols - 1)) / cols;
    const th = tw * 9 / 16 + 5;
    const rows = Math.ceil(n / cols);
    if (rows * th + (rows - 1) * gap <= h && tw > best.tw) best = { cols, tw };
  }
  return best;
}

function Ring({ value, label, color, tip }: { value: number; label: string; color: string; tip: string }) {
  const font = useHeaderFont();
  const r = 26; const c = 2 * Math.PI * r;
  return (
    <Tip content={tip}>
      <div className="flex flex-col items-center cursor-help">
        <svg width={64} height={64} viewBox="0 0 64 64">
          <circle cx={32} cy={32} r={r} fill="none" stroke={ink(10)} strokeWidth={6} />
          <motion.circle cx={32} cy={32} r={r} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" transform="rotate(-90 32 32)"
            initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - Math.min(1, value)) }} strokeDasharray={c} transition={{ duration: 0.7 }} />
          <text x={32} y={37} textAnchor="middle" fontSize={14} fontWeight={700} fill="currentColor" style={font}>{fmtPct(value)}</text>
        </svg>
        <span className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: C.muted }}>{label}</span>
      </div>
    </Tip>
  );
}

function HeroPanel({ model, hero }: { model: Model; hero: HeroX }) {
  const font = useHeaderFont();
  const attr = heroAttr(hero.heroId);
  const best = [...hero.perfs].filter(p => p.player && Number.isFinite(p.score)).sort((a, b) => b.score - a.score)[0];
  const banners = useMemo(() => model.teams
    .map(t => ({ t, n: t.bansBy.find(b => b.heroId === hero.heroId)?.count ?? 0 }))
    .filter(x => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 5), [model, hero.heroId]);
  const rTot = hero.radiant.picks + hero.dire.picks || 1;

  return (
    <motion.div key={hero.heroId} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
      className="h-full flex flex-col rounded-2xl overflow-hidden" style={{ background: ink(4), border: `1px solid ${ink(10)}` }}>
      <div className="relative h-[30%] min-h-[110px] shrink-0 overflow-hidden" style={{ background: '#0d0d12' }}>
        <HeroImg heroId={hero.heroId} title={false} className="absolute inset-0 w-full h-full scale-125 blur-xl opacity-50" />
        <div className="absolute top-2 bottom-0 right-0 w-[60%]"><HeroRender heroId={hero.heroId} sizes="240px" /></div>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.85))' }} />
        <div className="absolute left-0 right-0 bottom-0 p-3 flex items-end justify-between text-white">
          <div>
            <div className="h-1 w-10 rounded-full mb-1.5" style={{ background: ATTR_COLOR[attr] }} />
            <div className="text-2xl font-logik-extended-bold uppercase leading-none" style={font}>{heroName(hero.heroId)}</div>
          </div>
          <Tip content="Gry wygrane – przegrane tym bohaterem">
            <div className="text-right text-sm font-bold tabular-nums cursor-help"><span style={{ color: C.win }}>{hero.wins}</span><span className="opacity-40"> – </span><span style={{ color: C.loss }}>{hero.picks - hero.wins}</span></div>
          </Tip>
        </div>
      </div>
      <div className="flex-1 min-h-0 p-3 flex flex-col gap-3">
        <div className="flex justify-around">
          <Ring value={hero.pickRate} label="Pick" color={C.primary} tip={`Wybrany w ${hero.picks} z ${model.games.length} gier`} />
          <Ring value={hero.banRate} label="Ban" color={C.muted} tip={`Zbanowany w ${hero.bans} z ${model.draftGames} gier z zapisanym draftem${hero.firstPhaseBans ? ` · ${hero.firstPhaseBans}× w pierwszej fazie` : ''}`} />
          <Ring value={hero.wr} label="Win" color={wrColor(hero.wr)} tip={hero.picks ? `${Math.round(hero.wr * 100)}% wygranych w ${hero.picks} ${plural(hero.picks, 'grze', 'grach', 'grach')}` : 'Jeszcze nie grany'} />
        </div>
        {hero.picks > 0 && (
          <Tip content={`Radiant: ${hero.radiant.wins}/${hero.radiant.picks} wygranych · Dire: ${hero.dire.wins}/${hero.dire.picks} wygranych`}>
            <div className="cursor-help">
              <div className="flex h-2 rounded-full overflow-hidden">
                <div style={{ width: `${(hero.radiant.picks / rTot) * 100}%`, background: C.radiant }} />
                <div className="flex-1" style={{ background: C.dire }} />
              </div>
              <div className="flex justify-between text-[10px] mt-0.5" style={{ color: C.muted }}><span>Radiant {hero.radiant.picks}</span><span>{hero.dire.picks} Dire</span></div>
            </div>
          </Tip>
        )}
        {hero.picks > 0 && (
          <Tip content="Średnie zabójstwa / śmierci / asysty oraz złoto na minutę na tym bohaterze">
            <div className="flex justify-between text-center cursor-help">
              {[['K', hero.avgK], ['D', hero.avgD], ['A', hero.avgA], ['GPM', hero.avgGpm]].map(([l, v]) => (
                <div key={l as string}><div className="font-bold tabular-nums" style={font}>{(v as number).toFixed(l === 'GPM' ? 0 : 1)}</div><div className="text-[9px] uppercase tracking-widest" style={{ color: C.muted }}>{l}</div></div>
              ))}
            </div>
          </Tip>
        )}
        <div className="flex-1 min-h-0 flex flex-col gap-1 overflow-hidden">
          {hero.players.slice(0, 4).map(u => (
            <div key={u.player.id} className="flex items-center gap-2.5 text-sm">
              <Tip content={playerTip(u.player)}><span><Avatar player={u.player} size={34} /></span></Tip>
              <span className="flex-1 truncate font-semibold">{u.player.name}</span>
              <div className="flex gap-0.5">{Array.from({ length: Math.min(u.games, 8) }, (_, i) => <span key={i} className="w-1.5 h-3 rounded-sm" style={{ background: i < u.wins ? C.win : C.loss }} />)}</div>
              <span className="w-8 text-right tabular-nums" style={{ color: C.muted }}>{u.wins}-{u.games - u.wins}</span>
            </div>
          ))}
        </div>
        {best && (
          <Tip content={<TipBody title="Najlepszy występ (punkty fantasy)">{best.kills}/{best.deaths}/{best.assists} · {best.gpm} GPM · vs {opponentOf(best)?.name}</TipBody>}>
            <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-help" style={{ background: mix(C.secondary, 12) }}>
              <Avatar player={best.player} size={34} ring={C.secondary} />
              <span className="flex-1 truncate text-sm font-semibold">{best.player?.name}</span>
              <span className="text-xs tabular-nums">{best.kills}/{best.deaths}/{best.assists}</span>
              <span className="font-bold tabular-nums" style={{ color: C.secondary }}>{best.score.toFixed(2)}</span>
            </div>
          </Tip>
        )}
        {banners.length > 0 && (
          <div>
            <Tip content="Drużyny, które najczęściej banują tego bohatera (liczba = ile razy)"><div className="text-[10px] uppercase tracking-widest mb-1.5 cursor-help inline-block" style={{ color: C.muted }}>Banują go</div></Tip>
            <div className="flex items-center gap-2.5">
              {banners.map(b => (
                <Tip key={b.t.id} content={`${b.t.name} — ${b.n}× ban`}>
                  <span className="relative rounded-xl p-1" style={{ background: ink(5) }}>
                    <TeamLogo team={b.t} size={44} />
                    <span className="absolute -bottom-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-full text-[11px] font-bold flex items-center justify-center" style={{ background: C.primary, color: '#fff' }}>{b.n}</span>
                  </span>
                </Tip>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Mosaic({ model }: { model: Model }) {
  const [sort, setSort] = useState<SortKey>('contest');
  const [attr, setAttr] = useState<AttrFilter>('any');
  const [sel, setSel] = useState<number>(model.heroes[0]?.heroId ?? 1);
  const [ref, size] = useSize<HTMLDivElement>();

  const all = useMemo(() => {
    const ids = Object.values(getAllHeroData()).map(h => h.id);
    return ids.map(id => model.heroById.get(id) ?? emptyHero(id));
  }, [model]);
  const list = useMemo(() => {
    const filtered = all.filter(h => attr === 'any' || heroAttr(h.heroId) === attr);
    const val = (h: HeroX) => sort === 'wr' ? (h.picks >= 3 ? h.wr + h.picks / 1e4 : -1 + h.picks / 1e4) : h[sort];
    return [...filtered].sort((a, b) => val(b) - val(a) || b.contest - a.contest || heroName(a.heroId).localeCompare(heroName(b.heroId)));
  }, [all, sort, attr]);
  const maxContest = Math.max(1, ...all.map(h => h.contest));
  const never = all.filter(h => h.contest === 0);
  const { cols, tw } = fitTiles(list.length, size.w, size.h, 4);
  const hero = model.heroById.get(sel) ?? emptyHero(sel);

  return (
    <>
      <LabTitle
        sub={
          <Tip content={never.length ? <TipBody title="Nikt ich nie wybrał ani nie zbanował">{never.map(h => heroName(h.heroId)).join(', ')}</TipBody> : 'Każdy bohater był w drafcie'}>
            <span className="cursor-help">{all.length - never.length} / {all.length} bohaterów w drafcie</span>
          </Tip>
        }
        right={<div className="hidden md:flex gap-2"><Seg size="sm" value={attr} onChange={setAttr} options={ATTRS} /><Seg size="sm" value={sort} onChange={setSort} options={SORTS} /></div>}
      >
        Bohaterowie
      </LabTitle>
      <div className="flex-1 min-h-0 flex gap-4 mt-3">
        <div ref={ref} className="flex-[1.9] min-w-0 min-h-0">
          {size.w > 0 && (
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, ${tw}px)` }}>
              {list.map((h, i) => {
                const heat = h.contest / maxContest;
                const active = h.heroId === sel;
                return (
                  <Tip key={h.heroId} content={<TipBody title={heroName(h.heroId)}>{h.contest ? `${h.picks} pick · ${h.bans} ban · ${h.picks ? `${Math.round(h.wr * 100)}% wygranych` : 'nie grany'}` : 'Ani razu w drafcie'}</TipBody>}>
                    <motion.button type="button" layout transition={{ type: 'spring', stiffness: 400, damping: 35, delay: Math.min(i, 60) * 0.003 }}
                      onClick={() => setSel(h.heroId)}
                      className="relative rounded-md overflow-hidden"
                      style={{ width: tw, height: tw * 9 / 16 + 5, outline: active ? `2px solid ${C.secondary}` : 'none', outlineOffset: 1 }}>
                      <HeroImg heroId={h.heroId} title={false} className="w-full transition-all" style={{ height: tw * 9 / 16, filter: h.contest ? `saturate(${0.35 + heat * 0.65}) brightness(${0.55 + heat * 0.5})` : 'grayscale(1) brightness(0.35)' }} />
                      <div className="absolute left-0 right-0 bottom-0 h-[5px] flex" style={{ background: ink(8) }}>
                        <div style={{ width: `${(h.picks / maxContest) * 100}%`, background: C.primary }} />
                        <div style={{ width: `${(h.bans / maxContest) * 100}%`, background: C.muted, opacity: 0.6 }} />
                      </div>
                      {h.picks > 0 && <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full" style={{ background: wrColor(h.wr), boxShadow: '0 0 0 1px rgba(0,0,0,0.6)' }} />}
                    </motion.button>
                  </Tip>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-[280px] max-w-[400px] min-h-0 hidden md:block">
          <AnimatePresence mode="wait"><HeroPanel key={hero.heroId} model={model} hero={hero} /></AnimatePresence>
        </div>
      </div>
    </>
  );
}

export default function D03HeroMosaic() {
  return <LabView><WithModel>{m => <Mosaic model={m} />}</WithModel></LabView>;
}
