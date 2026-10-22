'use client';

// The overview ("Rozdziały"). The main pages as a chapter list (each row with its live headline
// number), the chosen one as a big spotlight next to it; the list moves on by itself every few
// seconds until somebody hovers it. Games, match preparation and the advanced index on the right.

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import type { Model } from '@/lib/stats-lab/derive';
import { C, LabView, WithModel, ink, mix, onDark, useHeaderFont } from '@/components/stats-lab/kit';
import { PAGE_BY_ID } from './catalog';
import { useStatsNav } from './nav';
import { buildOverview, type OverviewData } from './overview-data';
import { ColumnHead, MAIN_IDS, NEXT_MS, PlayColumn, TeaserFrame, mainFace, useCycle, type MainId } from './overview-kit';

function Chapter({ id, d, index, on, paused, onHover, onOpen }: { id: MainId; d: OverviewData; index: number; on: boolean; paused: boolean; onHover: () => void; onOpen: () => void }) {
  const font = useHeaderFont();
  const page = PAGE_BY_ID.get(id)!;
  const Icon = page.icon;
  const f = mainFace(id, d);
  return (
    <button type="button" onMouseEnter={onHover} onFocus={onHover} onClick={onOpen}
      className="group relative flex-1 min-h-0 w-full flex items-center gap-3 pl-4 pr-3 text-left rounded-xl overflow-hidden transition-colors"
      style={{ background: on ? mix(C.primary, 16) : 'transparent', borderBottom: `1px solid ${ink(7)}` }}>
      <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full transition-all" style={{ background: on ? onDark(C.secondary) : 'transparent' }} />
      <span className="w-11 h-11 shrink-0 flex items-center justify-center">{f.visual}</span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: on ? onDark(C.secondary) : C.muted }} />
          <span className="font-logik-extended-bold uppercase text-sm leading-tight truncate" style={{ color: C.heading, ...font }}>{page.title}</span>
        </span>
        <span className="block text-[11px] truncate mt-0.5" style={{ color: C.muted }}>{f.line}</span>
      </span>
      <span className="font-logik-extended-bold tabular-nums text-xl shrink-0" style={{ color: on ? onDark(C.secondary) : C.heading, ...font }}>{f.value}</span>
      <span className="absolute right-2 top-1.5 text-[9px] tabular-nums" style={{ color: C.muted }}>{String(index + 1).padStart(2, '0')}</span>
      {on && !paused && <motion.span key={`${id}-t`} className="absolute bottom-0 left-0 h-[2px]" style={{ background: onDark(C.secondary) }} initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: NEXT_MS / 1000, ease: 'linear' }} />}
    </button>
  );
}

function Spotlight({ d }: { d: OverviewData }) {
  const nav = useStatsNav();
  const [hover, setHover] = useState(false);
  const [i, setI] = useCycle(MAIN_IDS.length, NEXT_MS, hover);
  const id = MAIN_IDS[i];
  const page = PAGE_BY_ID.get(id)!;
  const Icon = page.icon;
  return (
    <div className="min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 flex max-lg:flex-col gap-4" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <div className="lg:w-[300px] xl:w-[330px] shrink-0 flex flex-col max-lg:h-[380px]">
          {MAIN_IDS.map((m, k) => <Chapter key={m} id={m} d={d} index={k} on={k === i} paused={hover} onHover={() => setI(k)} onOpen={() => nav?.go(m)} />)}
        </div>
        <div role="button" tabIndex={0} onClick={() => nav?.go(id)} onKeyDown={e => { if (e.key === 'Enter') nav?.go(id); }}
          className="relative flex-1 min-w-0 max-lg:h-[360px] text-left rounded-2xl overflow-hidden cursor-pointer"
          style={{ boxShadow: `0 0 0 2px ${onDark(C.secondary)}, 0 20px 50px rgba(0,0,0,0.45)` }}>
          <TeaserFrame id={id} d={d} className="absolute inset-0">
            <div className="relative mt-5 flex items-center gap-3">
              <span className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ background: C.primary, boxShadow: `0 0 18px ${mix(C.primary, 50)}` }}>
                <Icon className="w-3.5 h-3.5" />{page.title}<ChevronRight className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs text-white/60 truncate">{page.blurb}</span>
            </div>
          </TeaserFrame>
        </div>
      </div>
    </div>
  );
}

function OverviewBody({ model }: { model: Model }) {
  const d = useMemo(() => buildOverview(model), [model]);
  return (
    <div className="flex-1 min-h-0 grid gap-6 max-lg:overflow-y-auto max-lg:grid-cols-1 max-lg:auto-rows-max lg:grid-cols-[minmax(0,2.5fr)_minmax(320px,1fr)] lg:gap-8">
      <Spotlight d={d} />
      <PlayColumn model={model} />
    </div>
  );
}

export default function Overview() {
  return (
    <LabView className="!pt-0">
      <WithModel>{m => <OverviewBody model={m} />}</WithModel>
    </LabView>
  );
}
