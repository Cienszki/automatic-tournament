'use client';

// "Kolejność i bohaterowie" for either team, editable: the captain knows things the data doesn't —
// a player won't touch a hero (×), will play one (+), or picks at a different time (▲▼). Every change
// feeds back into the predictions, the plan, the simulator and the cheat sheet.

import React, { useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, ChevronUp, Plus, Search, X } from 'lucide-react';
import { Avatar, C, HeroImg, ink } from '@/components/stats-lab/kit';
import { heroName } from '@/lib/stats-lab/heroes';
import { predictOrder } from '@/lib/draft-prep/engine';
import { RoleTag } from './role';
import { useDP } from './state';
import { DataChip, PlayerTip, RULE, dotabuff, vh } from './ui';
import { topHeroes } from './sheet';

function AddHero({ onAdd, exclude }: { onAdd: (h: number) => void; exclude: number[] }) {
  const { input } = useDP();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const all = useMemo(() => [...(input?.meta.keys() ?? [])].sort((a, b) => heroName(a).localeCompare(heroName(b))), [input]);
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const list = all.filter(h => !exclude.includes(h) && (!q || norm(heroName(h)).includes(norm(q)))).slice(0, 40);
  return (
    <Popover.Root open={open} onOpenChange={o => { setOpen(o); if (!o) setQ(''); }}>
      <Popover.Trigger asChild>
        <button type="button" className="shrink-0 h-full aspect-video max-h-[64px] rounded-sm flex items-center justify-center border border-dashed hover:bg-white/5" style={{ borderColor: ink(25), color: C.muted }} aria-label="Dodaj bohatera">
          <Plus className="w-5 h-5" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={6} align="start" className="z-[9999] w-[360px] rounded-xl p-3 shadow-2xl text-white" style={{ background: '#15151c', border: '1px solid rgba(255,255,255,0.12)' }}>
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/50 mb-2">Dodaj bohatera, którym zagra</div>
          <label className="flex items-center gap-2 border-b border-white/25 px-1 py-1.5 mb-2">
            <Search className="w-4 h-4 text-white/60" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter' && list[0] != null) { onAdd(list[0]); setOpen(false); setQ(''); } }} placeholder="Szukaj bohatera" className="flex-1 bg-transparent outline-none text-sm" />
          </label>
          <div className="grid grid-cols-5 gap-1.5 max-h-[260px] overflow-y-auto">
            {list.map(h => (
              <button key={h} type="button" onClick={() => { onAdd(h); setOpen(false); setQ(''); }} className="text-left hover:opacity-80">
                <HeroImg heroId={h} className="w-full aspect-video rounded-sm" />
                <span className="block truncate text-[10px] text-white/70">{heroName(h)}</span>
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function OrderChart({ side }: { side: 'us' | 'them' }) {
  const dp = useDP(); const d = dp.input;
  const players = dp.players[side];
  const line = side === 'us' ? dp.lineUs : dp.lineThem;
  const order = useMemo(() => (d ? predictOrder(side === 'us' ? d.habitsUs : d.habitsThem, players) : []), [d, players, side]);
  const keys = order.map(o => o.pm.p.key);
  const move = (k: number, dir: -1 | 1) => {
    const j = k + dir; if (j < 0 || j >= keys.length) return;
    const n = [...keys]; [n[k], n[j]] = [n[j], n[k]];
    dp.setPickOrder(side, n);
  };
  const edits = dp.editsOf(side);
  const changed = !!(edits.order || Object.values(edits.out ?? {}).some(x => x.length) || Object.values(edits.add ?? {}).some(x => x.length));
  const color = side === 'us' ? C.radiant : C.dire;
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {order.map((o, k) => {
        const pm = o.pm; const heroes = topHeroes(pm);
        const slot = line.find(s => s.key === pm.p.key);
        return (
          <div key={pm.p.key} className="flex-1 min-h-0 flex items-center gap-3 border-b" style={{ borderColor: RULE }}>
            <span className="w-7 font-bold shrink-0" style={{ color, fontSize: vh(14, 2.2, 22) }}>{k + 1}.</span>
            <span className="flex flex-col shrink-0" style={{ color: C.muted }}>
              <button type="button" onClick={() => move(k, -1)} disabled={k === 0} className="hover:text-white disabled:opacity-20" aria-label="Wybiera wcześniej"><ChevronUp className="w-4 h-4" /></button>
              <button type="button" onClick={() => move(k, 1)} disabled={k === order.length - 1} className="hover:text-white disabled:opacity-20" aria-label="Wybiera później"><ChevronDown className="w-4 h-4" /></button>
            </span>
            <PlayerTip pm={pm}>
              <span className="w-44 shrink-0 min-w-0 flex items-center gap-2.5 cursor-help">
                <Avatar player={{ name: pm.p.name, avatar: slot?.avatar }} size={44} />
                <span className="min-w-0">
                  <a href={dotabuff(pm.p.sid32)} target="_blank" rel="noopener noreferrer" className="block truncate font-bold hover:underline" style={{ color: C.heading, fontSize: vh(13, 1.9, 19) }}>{pm.p.name}</a>
                  <span className="flex items-center gap-2 text-xs" style={{ color: C.muted }}><RoleTag role={pm.p.role} /><DataChip pm={pm} short /></span>
                </span>
              </span>
            </PlayerTip>
            <div className="flex-1 min-w-0 h-full py-2 flex items-center gap-2">
              {heroes.map(h => (
                <span key={h} className="group relative w-[17%] max-w-[116px] min-w-0 flex flex-col gap-1">
                  <HeroImg heroId={h} className="rounded-sm w-full aspect-video" />
                  <span className="truncate text-[11px] leading-none" style={{ color: C.text }}>{heroName(h)}</span>
                  <button type="button" onClick={() => dp.setHeroOut(side, pm.p.key, h)} title={`${pm.p.name} nie zagra: ${heroName(h)}`}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.8)', color: '#fff' }}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <AddHero exclude={heroes} onAdd={h => dp.addHero(side, pm.p.key, h)} />
            </div>
          </div>
        );
      })}
      <div className="shrink-0 pt-2 flex items-center gap-4 text-xs" style={{ color: C.muted }}>
        <span>Znasz ich lepiej niż dane: <b style={{ color: C.text }}>×</b> na bohaterze — nim nie zagra, <b style={{ color: C.text }}>+</b> — doda bohatera, strzałki — zmienią kolejność wyboru. Plan, symulacja i ściąga uwzględnią zmiany.</span>
        {changed && <button type="button" onClick={() => dp.resetEdits(side)} className="shrink-0 underline underline-offset-2" style={{ color: C.secondary }}>Przywróć przewidywania</button>}
      </div>
    </div>
  );
}
