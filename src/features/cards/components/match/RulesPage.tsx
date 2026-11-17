'use client';

// The "?" page (GAME_DESIGN 6): the round in one sentence, the five abilities, the six objectives.
// For looking something up; it never opens by itself.
import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { ROLE_KEYS } from '@/lib/card-lab/cards';
import { OBJ_IDS } from '@/lib/card-lab/outposts';
import { useHeaderFont } from '@/components/stats-lab/kit';
import { ABILITY, ACC_L, OBJECTIVE, ROLE, T, objModel } from './theme';

export function RulesPage({ onClose }: { onClose: () => void }) {
  const font = useHeaderFont();
  const head = (t: string) => <div className="font-logik-extended-bold uppercase text-[15px] tracking-wider mb-3" style={{ color: ACC_L, ...font }}>{t}</div>;
  return (
    <motion.div className="absolute inset-0 z-[58] flex items-center justify-center" style={{ background: 'rgba(5,6,9,0.9)', color: T.text }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <button type="button" onClick={onClose} aria-label="Zamknij" className="absolute right-6 top-5 w-11 h-11 flex items-center justify-center opacity-70 hover:opacity-100"><X className="w-7 h-7" /></button>
      <div className="w-[1500px] flex flex-col gap-10" onClick={(e) => e.stopPropagation()}>
        <div className="text-[22px] leading-snug max-w-[1100px]">
          Obaj gracze w tajemnicy wydają po dwa rozkazy: zagrywają kartę na objective albo przesuwają jednostkę. Potem wszystko się odsłania, każdy uderza jedną jednostkę rywala i osłania jedną swoją, a na każdym objectivie silniejsza strona rani Ancienta rywala.
        </div>
        <div className="grid grid-cols-2 gap-16">
          <div>
            {head('Pozycje')}
            <div className="flex flex-col gap-3">
              {ROLE_KEYS.map((r) => {
                const Icon = ROLE[r].icon;
                return (
                  <div key={r} className="flex gap-3">
                    <Icon className="w-5 h-5 mt-0.5 shrink-0" style={{ color: ACC_L }} />
                    <div><b>{ROLE[r].name} · {ROLE[r].ability}.</b> <span style={{ color: T.muted }}>{ABILITY[r]}</span></div>
                  </div>
                );
              })}
              <div className="flex gap-3 pl-8"><div><b>Drużyna.</b> <span style={{ color: T.muted }}>+1 dla każdego, kto stoi z graczem tej samej drużyny.</span></div></div>
            </div>
          </div>
          <div>
            {head("Objective'y")}
            <div className="flex flex-col gap-2">
              {OBJ_IDS.map((id) => (
                <div key={id} className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={objModel(id)} alt="" className="w-[40px] h-[40px] object-contain shrink-0" />
                  <div><b>{OBJECTIVE[id].name}.</b> <span style={{ color: T.muted }}>{OBJECTIVE[id].rule}.</span></div>
                </div>
              ))}
              <div className="mt-2" style={{ color: T.muted }}>Każdy kontrolowany objective zabiera Ancientowi rywala 1 HP, od rundy 5 podwójnie.</div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
