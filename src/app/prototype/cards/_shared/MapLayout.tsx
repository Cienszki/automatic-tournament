'use client';

// Version 1: the board as a map, laid out like today's game (OutpostsGame.tsx). The three
// objectives stand side by side as columns, each on the patch of the minimap where the objective
// really is; the rival's units stand above the objective and the player's below; the Ancients and
// the round track run along the top; the hand is at the bottom. On a phone a column is narrow, so
// each side's units wrap two to a line instead of shrinking past a readable size.
import React from 'react';
import { mix, useSize } from '@/components/stats-lab/kit';
import type { ObjId } from '@/lib/card-lab/outposts';
import type { Side, Slot } from '@/features/cards/domain/v2/types';
import type { LayoutProps } from './layout';
import { refOf } from './layout';
import type { UnitModel } from '@/features/cards/state/scene';
import { BandMarks, ConfirmButton } from './ui/ActionBand';
import { Ancient, incomingOf, RivalHand, RoundTrack } from './ui/Ancients';
import { Hand } from './ui/Hand';
import { Medallion, ObjectiveLabel } from './ui/Medallion';
import { ACC, ACC_L, T } from './ui/theme';
import { UnitTile } from './ui/UnitTile';

/** Where each objective is on the 7.41 minimap (fractions of the image), as today's game has them */
const MAP_AT: Record<ObjId, [number, number]> = {
  roshan: [0.355, 0.375], tormentor: [0.135, 0.18], outpost: [0.293, 0.535],
  gates: [0.098, 0.36], lotus: [0.465, 0.13], highground: [0.24, 0.72],
};
const MAP_VIEW = 0.3;
const MAP_EDGE = [0.065, 0.935];

/** The column's background: the minimap, centred on where the objective really is */
function Arena({ id }: { id: ObjId }) {
  const [ref, box] = useSize<HTMLDivElement>();
  const D = box.w / MAP_VIEW;
  const clamp = (v: number, half: number) => Math.min(MAP_EDGE[1] - half, Math.max(MAP_EDGE[0] + half, v));
  const x = clamp(MAP_AT[id][0], MAP_VIEW / 2); const y = clamp(MAP_AT[id][1], box.h / D / 2 || 0);
  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden pointer-events-none">
      {box.w > 0 && <div className="absolute inset-0" style={{ backgroundImage: 'url(/stats-lab/minimap-741.webp)', backgroundSize: `${D}px ${D}px`, backgroundPosition: `${box.w / 2 - x * D}px ${box.h / 2 - y * D}px`, filter: 'saturate(0.9) brightness(0.55)' }} />}
      <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, ${T.bg}, transparent 14%, transparent 86%, ${T.bg}), linear-gradient(180deg, ${T.bg}, transparent 12%, transparent 88%, ${T.bg})` }} />
    </div>
  );
}

interface Metrics { phone: boolean; top: number; colW: number; unitW: number; perLine: number; centre: number; cardW: number; handH: number; band: number }

function metrics(w: number, h: number, cap: number): Metrics {
  if (w < 700) {
    const colW = Math.floor((w - 8) / 3);
    const perLine = 2;
    const unitW = Math.min(56, Math.floor((colW - 10) / perLine) - 3);
    const cardW = Math.min(104, Math.round(w * 0.256));
    return { phone: true, top: 112, colW, unitW, perLine, centre: 44, cardW, handH: Math.round(cardW * 1.42) + 10, band: 70 };
  }
  const colW = Math.min(480, Math.floor((w - 80) / 3));
  const cardW = Math.min(124, Math.round(h * 0.138));
  const handH = Math.round(cardW * 1.42) + 16;
  const unitH = Math.min(150, Math.floor((h - 96 - handH - 150) / 2));
  const unitW = Math.min(Math.round(unitH / 1.42), Math.floor((colW - 24 - (cap - 1) * 8) / cap));
  return { phone: false, top: 96, colW, unitW, perLine: cap, centre: Math.round(unitW * 0.82), cardW, handH, band: 0 };
}

function Column({ at, p, m }: { at: Slot; p: LayoutProps; m: Metrics }) {
  const o = p.scene.objectives[at];
  const target = p.slots?.[at];
  const off = p.slots !== null && target === null;
  const units = (side: Side): UnitModel[] => p.scene.units.filter((u) => u.side === side && u.at === at);
  const mine = units(0);
  const gap = m.phone ? 4 : 8;
  const lines = Math.ceil(p.rules.capacity / m.perLine);
  const sideH = lines * Math.round(m.unitW * 1.42) + (lines - 1) * gap;
  const tile = (u: UnitModel) => (
    <div key={u.uid} className="shrink-0" style={{ opacity: p.dragged === u.uid ? 0 : 1 }}>
      <UnitTile m={u} w={m.unitW} look={p.look(u)} layoutId={u.uid} dataRef={u.side === 0 ? refOf(u) : `rival:${u.uid}`} />
    </div>
  );
  const group = (side: Side, children: React.ReactNode) => (
    <div className={`flex flex-wrap justify-center ${side === 1 ? 'content-end' : 'content-start'}`} style={{ width: m.perLine * m.unitW + (m.perLine - 1) * gap, height: sideH, gap }}>{children}</div>
  );
  return (
    <div data-slot={at} data-target={target ?? undefined} className="relative flex flex-col items-center justify-center" style={{ width: m.colW, height: '100%', opacity: off ? 0.4 : 1, transition: 'opacity .2s', cursor: target ? 'pointer' : undefined, gap: m.phone ? 8 : 14 }}>
      <Arena id={o.id} />
      {o.holder !== null && <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(70% 50% at 50% ${o.holder === 0 ? 80 : 20}%, ${mix(o.holder === 0 ? T.me : T.rival, 22)}, transparent 70%)` }} />}
      {target && <div className="absolute inset-0 pointer-events-none" style={{ background: mix(target === 'replace' ? T.hit : ACC, 12), boxShadow: `inset 0 0 0 2px ${mix(target === 'replace' ? T.hit : ACC, 65)}` }} />}
      <div className="relative">{group(1, units(1).map(tile))}</div>
      <div className="relative flex flex-col items-center" style={{ gap: 6 }}>
        <Medallion at={at} o={o} size={m.centre} verdict={p.verdicts.get(at)} lit={!!target} />
        <ObjectiveLabel o={o} size={m.phone ? 10 : 13} stack={m.phone} />
      </div>
      <div className="relative">
        {group(0, <>
          {mine.map(tile)}
          {target === 'ok' && mine.length < p.rules.capacity && <span className="shrink-0" style={{ width: m.unitW, height: Math.round(m.unitW * 1.42), borderRadius: Math.max(7, m.unitW * 0.11), border: `1.5px dashed ${ACC_L}`, opacity: 0.7 }} />}
        </>)}
      </div>
    </div>
  );
}

export function MapLayout(p: LayoutProps) {
  const { scene, size, rules, tick } = p;
  const m = metrics(size.w, size.h, rules.capacity);
  const incoming = incomingOf(scene);
  const boardH = size.h - m.top - m.handH - m.band - (m.phone ? 0 : 10);
  const ancientPx = m.phone ? 74 : 86;
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-x-0 top-0 flex items-end justify-between" style={{ height: m.top, padding: m.phone ? '0 8px 6px' : '0 40px 8px' }}>
        <Ancient side={0} hp={scene.hp[0]} max={rules.hp} incoming={incoming[0]} tick={tick} size={ancientPx} />
        {/* On a phone the two Ancients take the whole width: the round track goes above them */}
        <div className={m.phone ? 'absolute inset-x-0 flex justify-center' : 'flex flex-col items-center'} style={m.phone ? { top: 10 } : { paddingBottom: 10, transform: 'scale(1.3)' }}>
          <RoundTrack round={scene.round} cap={rules.roundCap} lateFrom={rules.lateFrom} />
        </div>
        <Ancient side={1} hp={scene.hp[1]} max={rules.hp} incoming={incoming[1]} tick={tick} size={ancientPx}><RivalHand n={scene.rivalHand} /></Ancient>
      </div>
      <div className="absolute flex justify-center" style={{ top: m.top, height: boardH, left: 0, right: 0 }}>
        {([0, 1, 2] as Slot[]).map((at) => (
          <React.Fragment key={at}>
            {at > 0 && <div className="w-px self-stretch shrink-0" style={{ background: `linear-gradient(180deg, transparent, ${T.line}, transparent)` }} />}
            <Column at={at} p={p} m={m} />
          </React.Fragment>
        ))}
      </div>
      {m.phone ? (
        <div className="absolute inset-x-0 flex items-center justify-between" style={{ top: m.top + boardH, height: m.band, padding: '0 14px', zIndex: 45 }}>
          <div><BandMarks mode={p.band} onUndo={p.onUndo} /></div>
          <ConfirmButton mode={p.band} ready={p.ready} size={52} wide onConfirm={p.onConfirm} />
        </div>
      ) : (
        <div className="absolute flex items-center" style={{ right: 40, bottom: 28, gap: 28, zIndex: 45 }}>
          <BandMarks mode={p.band} onUndo={p.onUndo} />
          <ConfirmButton mode={p.band} ready={p.ready} size={112} onConfirm={p.onConfirm} />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 overflow-hidden pointer-events-none" style={{ height: m.handH + 70 }}>
        <Hand cards={scene.hand} width={size.w} cardW={m.cardW} glow={p.hand.glow} picked={p.hand.picked} away={p.hand.away} hidden={p.dragged} />
      </div>
    </div>
  );
}
