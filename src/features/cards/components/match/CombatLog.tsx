'use client';

// "Przebieg meczu": every round as it was shown, newest first: plays, moves, ganks, hits and guards,
// and on each objective the two totals, who took it and the damage. Card chips show the card on
// hover. The match against the computer waits while it is open.
import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowRightLeft, Crosshair, Flag, Plus, ScrollText, Shield, Swords, Wind, X } from 'lucide-react';
import type { GCard } from '@/lib/card-lab/cards';
import { baseMight, type ObjId } from '@/lib/card-lab/outposts';
import { Avatar, Tip, useHeaderFont } from '@/components/stats-lab/kit';
import type { Side, Slot } from '@/features/cards/domain/v2/types';
import type { LogRound, LogRow } from '@/features/cards/state/log';
import { ABILITY, ACC_L, OBJECTIVE, ROLE, T, objModel, sideColor } from './theme';

export function CardInfo({ card }: { card: GCard }) {
  const role = ROLE[card.role];
  return (
    <div className="w-[280px] text-[12px] leading-snug">
      <div className="text-[15px] font-bold break-words">{card.name}</div>
      <div className="break-words" style={{ color: T.muted }}>{card.team?.name}{card.series.opp ? ` vs ${card.series.opp.name}` : ''}</div>
      <div className="mt-2 font-logik-extended-bold uppercase text-[13px] tracking-wide" style={{ color: ACC_L }}>{role.name} · {role.ability}</div>
      <div className="text-[13px]">{ABILITY[card.role]}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5 text-[14px]"><span className="uppercase tracking-wide font-bold">Siła</span><b className="font-logik-extended-bold">{baseMight(card)}</b></div>
    </div>
  );
}

function Mini({ c, struck }: { c: GCard; struck?: boolean }) {
  return (
    <Tip content={<CardInfo card={c} />}>
      <span className="inline-flex items-center gap-1.5 rounded-full pl-0.5 pr-2.5 py-0.5 cursor-help" style={{ background: 'rgba(255,255,255,0.06)', textDecoration: struck ? 'line-through' : undefined }}>
        <Avatar player={c.player} size={22} />
        <span className="font-bold text-[12px]">{c.name}</span>
        <span className="text-[10px] uppercase tracking-wider" style={{ color: ACC_L }}>{ROLE[c.role].name}</span>
      </span>
    </Tip>
  );
}

function Obj({ id }: { id: ObjId }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <span className="inline-flex items-center gap-1.5 font-bold"><img src={objModel(id)} alt="" className="w-[28px] h-[28px] object-contain" />{OBJECTIVE[id].name}</span>;
}

const Act = ({ tip, children }: { tip: string; children: React.ReactNode }) => <Tip content={tip}><span className="inline-flex cursor-help">{children}</span></Tip>;
const who = (s: Side) => <span className="font-bold w-[52px] shrink-0" style={{ color: sideColor(s) }}>{s === 0 ? 'Ty' : 'Rywal'}</span>;

function Row({ r, objectives }: { r: LogRow; objectives: ObjId[] }) {
  const font = useHeaderFont();
  const at = (s: Slot) => <Obj id={objectives[s]} />;
  switch (r.kind) {
    case 'play': return <div className="flex items-center gap-2 flex-wrap">{who(r.side)}<Act tip="Karta z ręki"><Plus className="w-4 h-4" style={{ color: sideColor(r.side) }} /></Act><Mini c={r.card} /><ArrowRight className="w-4 h-4 opacity-50" />{at(r.to)}{r.replaced && <><span style={{ color: T.muted }}>w miejsce</span><Mini c={r.replaced} struck /></>}</div>;
    case 'move': return <div className="flex items-center gap-2 flex-wrap">{who(r.side)}<Act tip={r.free === 'smoke' ? 'Smoke: ruch bez rozkazu' : r.free === 'gates' ? 'Twin Gates: ruch bez rozkazu' : 'Ruch (1 rozkaz)'}>{r.free === 'smoke' ? <Wind className="w-4 h-4" style={{ color: T.smoke }} /> : r.free === 'gates' ? <ArrowRightLeft className="w-4 h-4" style={{ color: sideColor(r.side) }} /> : <ArrowRight className="w-4 h-4" style={{ color: sideColor(r.side) }} />}</Act><Mini c={r.card} />{at(r.from)}<ArrowRight className="w-4 h-4 opacity-50" />{at(r.to)}</div>;
    case 'gank': return <div className="flex items-center gap-2 flex-wrap">{who(r.side)}<Act tip="Gank"><Swords className="w-4 h-4" style={{ color: T.warn }} /></Act><Mini c={r.mid} />{r.target ? <><ArrowRight className="w-4 h-4 opacity-50" /><Mini c={r.target} struck /></> : <span style={{ color: T.muted }}>bez celu</span>}{at(r.at)}</div>;
    case 'strike': return <div className="flex items-center gap-2 flex-wrap">{who(r.side)}<Act tip={r.guarded ? 'Cios zatrzymany osłoną' : 'Cios'}>{r.guarded ? <Shield className="w-4 h-4" style={{ color: T.guard }} /> : <Crosshair className="w-4 h-4" style={{ color: T.wound }} />}</Act><Mini c={r.target} />{at(r.at)}</div>;
    case 'control': return (
      <div className="flex items-center gap-2">
        <span className="w-[52px] shrink-0" />
        <Act tip="Siła obu stron i kto przejął kontrolę"><Flag className="w-4 h-4" style={{ color: r.controller === null ? T.muted : sideColor(r.controller) }} /></Act>{at(r.at)}
        <span className="font-logik-extended-bold text-[16px] tabular-nums" style={font}><span style={{ color: T.me }}>{r.power[0]}</span><span className="opacity-40"> : </span><span style={{ color: T.rival }}>{r.power[1]}</span></span>
        {r.damage > 0 && r.controller !== null && <span className="font-logik-extended-bold" style={{ color: T.pts, ...font }}>{r.controller === 0 ? 'Ancient rywala' : 'Twój Ancient'} −{r.damage}</span>}
      </div>
    );
  }
}

export function CombatLog({ rounds, objectives, onClose }: { rounds: LogRound[]; objectives: ObjId[]; onClose: () => void }) {
  const font = useHeaderFont();
  return (
    <motion.div className="absolute inset-0 z-[55] flex justify-center pt-16" style={{ background: 'rgba(5,6,9,0.6)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="w-[900px] max-h-[78%] overflow-y-auto rounded-[22px] px-7 py-5" style={{ background: '#11131a', boxShadow: '0 30px 80px rgba(0,0,0,0.6)', color: T.text }}
        initial={{ y: -30 }} animate={{ y: 0 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <ScrollText className="w-5 h-5" style={{ color: ACC_L }} />
          <span className="font-logik-extended-bold uppercase text-[20px]" style={font}>Przebieg meczu</span>
          <span className="flex-1" />
          <button type="button" onClick={onClose} aria-label="Zamknij" className="w-11 h-11 flex items-center justify-center opacity-60 hover:opacity-100"><X className="w-6 h-6" /></button>
        </div>
        <div className="flex flex-col gap-4 text-[13px]">
          {rounds.map((r) => (
            <div key={r.round} className="flex gap-4">
              <div className="w-[70px] shrink-0 pt-1 font-logik-extended-bold text-[13px] uppercase" style={{ color: T.muted, ...font }}>Runda {r.round}</div>
              <div className="flex-1 flex flex-col gap-1.5 pl-4" style={{ borderLeft: `2px solid ${T.line}` }}>{r.rows.map((row, i) => <Row key={i} r={row} objectives={objectives} />)}</div>
            </div>
          ))}
          {!rounds.length && <div style={{ color: T.muted }}>Jeszcze nic się nie wydarzyło.</div>}
        </div>
      </motion.div>
    </motion.div>
  );
}
