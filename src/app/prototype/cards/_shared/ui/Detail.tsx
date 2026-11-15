'use client';

// What a long press shows: the card as it is in the collection (the game's own card face), what
// its position does in this game, and the series it comes from; or an objective and its rule.
// It is the only place with a sentence of rules, and it never opens by itself.
import React from 'react';
import { motion } from 'framer-motion';
import { CardFace } from '@/components/card-lab/ui';
import { useHeaderFont } from '@/components/stats-lab/kit';
import { KEYWORD, OBJECTIVES } from '@/lib/card-lab/outposts';
import type { ObjectiveModel, UnitModel } from '../state/scene';
import { ABILITY, ACC_L, OBJECTIVE_RULE, T, objModel, sideColor } from './theme';

export type DetailOf = { kind: 'unit'; m: UnitModel } | { kind: 'objective'; o: ObjectiveModel };

// The card face writes out the ability of today's game from 130 px up; below that it shows only
// the card itself. The redesigned game's sentence is written beside it.
const FACE_W = 128;

export function Detail({ of, size }: { of: DetailOf; size: { w: number; h: number } }) {
  const font = useHeaderFont();
  const scale = Math.min(1.7, (size.w * 0.56) / FACE_W, (size.h * 0.42) / (FACE_W * 1.42));
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center" style={{ zIndex: 95, background: 'rgba(5,6,9,0.82)', gap: 18, padding: 24 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {of.kind === 'unit' ? (
        <>
          <motion.div style={{ width: FACE_W * scale, height: FACE_W * 1.42 * scale }} initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: '0 0' }}><CardFace c={of.m.card} w={FACE_W} tip={false} /></div>
          </motion.div>
          <div className="text-center" style={{ maxWidth: 320 }}>
            <div className="font-logik-extended-bold uppercase" style={{ fontSize: 15, color: ACC_L, ...font }}>{KEYWORD[of.m.card.role].name} · {KEYWORD[of.m.card.role].ability}</div>
            <div style={{ fontSize: 15, lineHeight: 1.4, marginTop: 4 }}>{ABILITY[of.m.card.role]}</div>
            <div style={{ fontSize: 13, marginTop: 10, color: T.muted }}>
              {of.m.card.team?.name}{of.m.card.series.opp ? ` · seria ${of.m.card.series.result} z ${of.m.card.series.opp.name}` : ''}
            </div>
          </div>
        </>
      ) : (
        <>
          <motion.img src={objModel(of.o.id)} alt="" draggable={false} style={{ width: Math.min(220, size.w * 0.5), height: Math.min(220, size.w * 0.5), objectFit: 'contain', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.9))' }} initial={{ scale: 0.8 }} animate={{ scale: 1 }} />
          <div className="text-center" style={{ maxWidth: 320 }}>
            <div className="font-logik-extended-bold uppercase" style={{ fontSize: 22, color: of.o.holder === null ? T.text : sideColor(of.o.holder), ...font }}>{OBJECTIVES[of.o.id].name}</div>
            <div style={{ fontSize: 15, lineHeight: 1.4, marginTop: 6 }}>{OBJECTIVE_RULE[of.o.id]}</div>
          </div>
        </>
      )}
    </motion.div>
  );
}
