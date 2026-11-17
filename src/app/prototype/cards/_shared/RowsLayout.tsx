'use client';

// Versions 2 and 3: three rows, one per objective. In each row the player's units stand on the
// left of the objective and the rival's on the right, so the whole left half of the screen is the
// player's and the right half the rival's, Ancients included. Built for a 390 px portrait phone:
// the rows and everything else the player acts on sit in the lower two-thirds, the Ancients fill
// the top. On a wide screen the same pieces get more air and the Ancients move to the sides.
import React from 'react';
import { mix } from '@/components/stats-lab/kit';
import type { Side, Slot } from '@/features/cards/domain/v2/types';
import type { LayoutProps } from './layout';
import { refOf } from './layout';
import type { UnitModel } from './state/scene';
import { BandMarks, ConfirmButton } from './ui/ActionBand';
import { Ancient, incomingOf, RivalHand, RoundTrack } from './ui/Ancients';
import { Hand } from './ui/Hand';
import { Medallion, medallionBox, ObjectiveLabel } from './ui/Medallion';
import { ACC, ACC_L, T } from './ui/theme';
import { UnitTile } from './ui/UnitTile';

interface Metrics { phone: boolean; top: number; rowH: number; unitW: number; gap: number; centre: number; cardW: number; handH: number; band: number; side: number }

function metrics(w: number, h: number): Metrics {
  if (w < 700) {
    const gap = 3; const centre = 46;
    const unitW = Math.min(64, Math.floor((w - 12 - medallionBox(centre).w - 8 - 4 * gap) / 6));
    const rowH = Math.round(unitW * 1.42) + 46;
    const cardW = Math.min(104, Math.round(w * 0.256));
    const handH = Math.round(cardW * 1.42) + 10;
    const band = 70;
    return { phone: true, top: Math.max(120, h - 3 * rowH - band - handH), rowH, unitW, gap, centre, cardW, handH, band, side: 0 };
  }
  const cardW = Math.min(124, Math.round(h * 0.138));
  const handH = Math.round(cardW * 1.42) + 16;
  const top = 64;
  const unitH = Math.min(150, Math.floor((h - top - handH - 12) / 3) - 58);
  const unitW = Math.round(unitH / 1.42);
  return { phone: false, top, rowH: unitH + 58, unitW, gap: 10, centre: Math.round(unitH * 0.7), cardW, handH, band: 0, side: Math.min(260, Math.round(w * 0.17)) };
}

function Row({ at, p, m }: { at: Slot; p: LayoutProps; m: Metrics }) {
  const o = p.scene.objectives[at];
  const target = p.slots?.[at];
  const off = p.slots !== null && target === null;
  const wash = target === 'replace' ? T.hit : ACC;
  const sideW = 3 * m.unitW + 2 * m.gap;
  const units = (side: Side): UnitModel[] => p.scene.units.filter((u) => u.side === side && u.at === at);
  const mine = units(0);
  // One dashed place shows where the held card or unit would stand
  const free = target === 'ok' && mine.length < p.rules.capacity ? 1 : 0;
  const tiles = (side: Side) => units(side).map((u) => (
    <div key={u.uid} style={{ opacity: p.dragged === u.uid ? 0 : 1 }}>
      <UnitTile m={u} w={m.unitW} look={p.look(u)} layoutId={u.uid} dataRef={side === 0 ? refOf(u) : `rival:${u.uid}`} />
    </div>
  ));
  return (
    <div data-slot={at} data-target={target ?? undefined} className="relative flex flex-col items-center" style={{ height: m.rowH, opacity: off ? 0.4 : 1, transition: 'opacity .2s', cursor: target ? 'pointer' : undefined }}>
      <div className="absolute pointer-events-none" style={{ inset: m.phone ? '10px 0 -10px' : '0 -160px', background: `radial-gradient(ellipse ${m.phone ? 44 : 30}% 50% at ${m.phone ? 6 : 30}% 50%, ${mix(T.me, 14)}, transparent), radial-gradient(ellipse ${m.phone ? 44 : 30}% 50% at ${m.phone ? 94 : 70}% 50%, ${mix(T.rival, 14)}, transparent)` }} />
      {target && <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(90deg, ${mix(wash, 26)}, ${mix(wash, 8)} 55%, transparent)`, boxShadow: `inset 0 1px 0 ${mix(wash, 70)}, inset 0 -1px 0 ${mix(wash, 70)}` }} />}
      <div className="relative flex items-center w-full" style={{ height: m.phone ? 20 : 24, gap: 10, padding: `0 ${m.phone ? 10 : 0}px` }}>
        <span className="flex-1 h-px" style={{ background: `linear-gradient(90deg, transparent, ${o.holder === 0 ? mix(T.me, 60) : T.line})` }} />
        <ObjectiveLabel o={o} size={m.phone ? 10 : 13} />
        <span className="flex-1 h-px" style={{ background: `linear-gradient(270deg, transparent, ${o.holder === 1 ? mix(T.rival, 60) : T.line})` }} />
      </div>
      <div className="relative flex items-center justify-center" style={{ gap: m.phone ? 4 : 24, marginTop: m.phone ? 6 : 8 }}>
        <div className="flex flex-row-reverse items-center" style={{ width: sideW, gap: m.gap }}>
          {tiles(0)}
          {Array.from({ length: free }, (_, i) => <span key={i} className="shrink-0" style={{ width: m.unitW, height: Math.round(m.unitW * 1.42), borderRadius: Math.max(7, m.unitW * 0.11), border: `1.5px dashed ${ACC_L}`, opacity: 0.7 }} />)}
        </div>
        <Medallion at={at} o={o} size={m.centre} verdict={p.verdicts.get(at)} lit={!!target} />
        <div className="flex items-center" style={{ width: sideW, gap: m.gap }}>{tiles(1)}</div>
      </div>
    </div>
  );
}

export function RowsLayout(p: LayoutProps) {
  const { scene, size, rules, tick } = p;
  const m = metrics(size.w, size.h);
  const incoming = incomingOf(scene);
  const ancient = (side: Side, px: number, column: boolean) => (
    <Ancient side={side} hp={scene.hp[side]} max={rules.hp} incoming={incoming[side]} tick={tick} size={px} column={column}>
      {side === 1 && <RivalHand n={scene.rivalHand} />}
    </Ancient>
  );
  const rowsW = m.phone ? size.w : 6 * m.unitW + 4 * m.gap + medallionBox(m.centre).w + 48 + 80;
  return (
    <div className="absolute inset-0">
      {/* The map behind the Ancients, fading into the table */}
      <div className="absolute inset-x-0 top-0 pointer-events-none" style={{
        height: m.phone ? m.top + 40 : size.h, backgroundImage: 'url(/stats-lab/minimap-741.webp)', backgroundSize: 'cover', backgroundPosition: '50% 42%', filter: 'saturate(0.85) brightness(0.5)', opacity: m.phone ? 0.75 : 0.3,
        maskImage: m.phone ? 'linear-gradient(180deg, black 55%, transparent)' : 'linear-gradient(90deg, black, transparent 34%, transparent 66%, black)', WebkitMaskImage: m.phone ? 'linear-gradient(180deg, black 55%, transparent)' : 'linear-gradient(90deg, black, transparent 34%, transparent 66%, black)',
      }} />
      {m.phone ? (
        <div className="absolute inset-x-0 top-0 flex items-end justify-between" style={{ height: m.top, padding: '0 10px 14px' }}>
          {ancient(0, Math.min(124, m.top * 0.46), false)}
          {ancient(1, Math.min(124, m.top * 0.46), false)}
          <div className="absolute inset-x-0 flex justify-center" style={{ top: 18 }}><RoundTrack round={scene.round} cap={rules.roundCap} lateFrom={rules.lateFrom} /></div>
        </div>
      ) : (
        <>
          <div className="absolute inset-x-0 top-0 flex items-center justify-center" style={{ height: m.top, transform: 'scale(1.4)' }}><RoundTrack round={scene.round} cap={rules.roundCap} lateFrom={rules.lateFrom} /></div>
          {([0, 1] as Side[]).map((side) => (
            <div key={side} className="absolute flex items-center justify-center" style={{ top: m.top, height: 3 * m.rowH, width: m.side, [side === 0 ? 'left' : 'right']: Math.max(0, (size.w - rowsW) / 2 - m.side - 20) }}>
              {ancient(side, Math.min(230, m.side * 0.9), true)}
            </div>
          ))}
        </>
      )}
      <div className="absolute" style={{ top: m.top, left: (size.w - rowsW) / 2, width: rowsW }}>
        {([0, 1, 2] as Slot[]).map((at) => <Row key={at} at={at} p={p} m={m} />)}
      </div>
      {m.phone ? (
        <div className="absolute inset-x-0 flex items-center justify-between" style={{ top: m.top + 3 * m.rowH, height: m.band, padding: '0 14px', zIndex: 45 }}>
          <div><BandMarks mode={p.band} onUndo={p.onUndo} /></div>
          <ConfirmButton mode={p.band} ready={p.ready} size={52} wide onConfirm={p.onConfirm} />
        </div>
      ) : (
        <div className="absolute flex items-center" style={{ right: Math.max(24, (size.w - rowsW) / 2 - m.side), bottom: 28, gap: 28, zIndex: 45 }}>
          <BandMarks mode={p.band} onUndo={p.onUndo} />
          <ConfirmButton mode={p.band} ready={p.ready} size={112} onConfirm={p.onConfirm} />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 overflow-hidden pointer-events-none" style={{ height: m.handH + 70 }}>
        <Hand cards={scene.hand} width={size.w} cardW={m.cardW}  glow={p.hand.glow} picked={p.hand.picked} away={p.hand.away} hidden={p.dragged} />
      </div>
    </div>
  );
}
