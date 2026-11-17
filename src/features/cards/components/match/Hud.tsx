'use client';

// The top of the screen: back, the rival's hand as card backs, the race of the two Ancients with
// the round between them, the opponent (with a mark while it thinks), the "?" page, the combat log
// and the bug report.
import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Bot, CircleHelp, ScrollText } from 'lucide-react';
import { CardBack } from '@/components/card-lab/ui';
import { ReportBug } from '@/components/card-lab/ReportBug';
import { Tip, mix, useHeaderFont } from '@/components/stats-lab/kit';
import { LEVELS, type Level } from '@/features/cards/domain/v2/ai/levels';
import type { Side } from '@/features/cards/domain/v2/types';
import { count } from '@/lib/plural';
import { T, ancientModel, sideColor } from './theme';

function ScoreRace({ hp, max, round, lateFrom, lastRound }: { hp: [number, number]; max: number; round: number; lateFrom: number; lastRound: number }) {
  const font = useHeaderFont();
  const bar = (side: Side) => (
    <div className={`flex-1 flex gap-1 ${side === 1 ? 'flex-row-reverse' : ''}`}>
      {Array.from({ length: max }, (_, i) => {
        const alive = i < hp[side];
        return <span key={i} className="h-[10px] flex-1 rounded-full transition-all duration-500" style={{ background: alive ? sideColor(side) : T.faint, boxShadow: alive ? `0 0 8px ${sideColor(side)}` : undefined }} />;
      })}
    </div>
  );
  const ancient = (side: Side) => (
    <Tip content={side === 0 ? `Twój Ancient: ${hp[0]} z ${max} HP` : `Ancient rywala: ${hp[1]} z ${max} HP`}>
      <span data-ancient={side} className={`flex items-center gap-2 cursor-help ${side === 1 ? 'flex-row-reverse' : ''}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ancientModel(side)} alt="" className="h-[58px] w-[48px] object-contain -my-2" style={{ filter: `drop-shadow(0 4px 10px rgba(0,0,0,0.9))${hp[side] <= 0 ? ' grayscale(1) brightness(0.5)' : ''}` }} />
        <span className="flex flex-col leading-none" style={{ alignItems: side === 1 ? 'flex-end' : 'flex-start' }}>
          <span className="font-logik-extended-bold text-[30px] tabular-nums" style={{ color: sideColor(side), ...font }}>{Math.max(0, hp[side])}</span>
          <span className="text-[9px] uppercase tracking-[0.2em] mt-0.5" style={{ color: T.muted }}>HP</span>
        </span>
      </span>
    </Tip>
  );
  const late = round >= lateFrom;
  return (
    <div className="flex items-center gap-4 w-[780px]">
      {ancient(0)}{bar(0)}
      <Tip content={late ? `Od rundy ${lateFrom} obrażenia są podwójne. Mecz kończy się najpóźniej po rundzie ${lastRound}.` : `Od rundy ${lateFrom} obrażenia są podwójne. Mecz kończy się najpóźniej po rundzie ${lastRound}.`}>
        <div className="text-center leading-none cursor-help min-w-[84px]">
          <div className="font-logik-extended-bold text-[15px] uppercase" style={{ color: T.text, ...font }}>Runda {round}</div>
          <div className="text-[11px] uppercase tracking-[0.18em] mt-1 font-bold" style={{ color: late ? T.pts : T.muted }}>{late ? 'obrażenia ×2' : `z ${lastRound}`}</div>
        </div>
      </Tip>
      {bar(1)}{ancient(1)}
    </div>
  );
}

const round44 = 'w-11 h-11 rounded-full flex items-center justify-center';

export interface HudProps {
  hp: [number, number]; max: number; round: number; lateFrom: number; lastRound: number;
  rival: { hand: number; deck: number; grave: number };
  level: Level; thinking: boolean;
  onBack?: () => void; onHelp: () => void; onLog: () => void; report: () => Record<string, unknown>;
}

export function Hud({ hp, max, round, lateFrom, lastRound, rival, level, thinking, onBack, onHelp, onLog, report }: HudProps) {
  const font = useHeaderFont();
  const lv = LEVELS[level];
  return (
    <div className="h-[64px] shrink-0 flex items-center justify-center relative z-40">
      {onBack && (
        <motion.button type="button" onClick={onBack} whileHover={{ x: -3 }} className="absolute left-5 flex items-center gap-1.5 rounded-full pl-2.5 pr-4 h-11 text-[13px] font-bold"
          style={{ boxShadow: `inset 0 0 0 1.5px ${T.faint}`, color: T.text }}><ArrowLeft className="w-4 h-4" />Karty</motion.button>
      )}
      <Tip content={`Rywal: ${count(rival.hand, 'karta', 'karty', 'kart')} na ręce, ${rival.deck} w talii, ${rival.grave} odrzuconych`}>
        <div className="absolute left-[200px] flex items-center gap-3 cursor-help">
          <div className="flex -space-x-5">{Array.from({ length: rival.hand }, (_, i) => <div key={i} style={{ transform: `rotate(${(i - rival.hand / 2) * 6}deg)` }}><CardBack w={28} /></div>)}</div>
          <span className="font-logik-extended-bold text-[22px]" style={{ color: T.rival, ...font }}>{rival.hand}</span>
        </div>
      </Tip>
      <ScoreRace hp={hp} max={max} round={round} lateFrom={lateFrom} lastRound={lastRound} />
      <div className="absolute right-[234px] flex items-center gap-2.5 whitespace-nowrap">
        <span className="font-logik-extended-bold uppercase text-[14px] leading-tight text-right" style={{ color: lv.color, ...font }}>Komputer {lv.name}</span>
        <span className="relative w-9 h-9 rounded-full flex items-center justify-center" style={{ background: mix(lv.color, 25), boxShadow: `0 0 0 2px ${lv.color}` }}>
          <Bot className="w-5 h-5" style={{ color: lv.color }} />
          {thinking && (
            <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-[3px]" aria-label="Rywal myśli">
              {[0, 1, 2].map((i) => <span key={i} className="w-[5px] h-[5px] rounded-full" style={{ background: lv.color, animation: `karty-dots 1.1s ${i * 0.18}s infinite` }} />)}
            </span>
          )}
        </span>
      </div>
      <div className="absolute right-5 flex items-center gap-2">
        <Tip content="Zasady"><motion.button type="button" onClick={onHelp} whileHover={{ scale: 1.08 }} className={round44} style={{ boxShadow: `inset 0 0 0 1.5px ${T.faint}`, color: T.text }} aria-label="Zasady"><CircleHelp className="w-5 h-5" /></motion.button></Tip>
        <Tip content="Przebieg meczu"><motion.button type="button" onClick={onLog} whileHover={{ scale: 1.08 }} className={round44} style={{ boxShadow: `inset 0 0 0 1.5px ${T.faint}`, color: T.text }} aria-label="Przebieg meczu"><ScrollText className="w-5 h-5" /></motion.button></Tip>
        <ReportBug className={`${round44} transition-transform hover:scale-[1.08]`} style={{ boxShadow: `inset 0 0 0 1.5px ${T.faint}`, color: T.text }} context={report} />
      </div>
    </div>
  );
}
