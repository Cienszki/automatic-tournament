'use client';

// "Zgłoś błąd": a short description from the player, plus what the game knows on its own (the
// match state, the last errors on the page, the browser). Goes to /api/cards/report; the admins see
// it in Admin → Karty and get a Discord message.

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bug, Check, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useStatsKey } from '@/components/stats-lab/kit';
import { installClientLog, recentLog } from '@/lib/card-lab/client-log';

export function ReportBug({ context, className, style }: { context: () => Record<string, unknown>; className?: string; style?: React.CSSProperties }) {
  const { user } = useAuth();
  const key = useStatsKey();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  useEffect(() => { installClientLog(); }, []);

  const send = async () => {
    if (!user || !key || text.trim().length < 3) return;
    setState('sending');
    try {
      let ctx: Record<string, unknown> = {};
      try { ctx = context(); } catch (e) { ctx = { contextError: String(e) }; }
      const r = await fetch('/api/cards/report', {
        method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          t: key, text: text.trim(), url: location.href,
          client: { ua: navigator.userAgent, w: innerWidth, h: innerHeight, at: Date.now() },
          log: recentLog(), context: ctx,
        }),
      });
      if (!r.ok) throw new Error();
      setState('sent'); setText('');
      setTimeout(() => { setOpen(false); setState('idle'); }, 1600);
    } catch { setState('error'); }
  };

  if (!user) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Zgłoś błąd" title="Zgłoś błąd" className={className} style={style}>
        <Bug className="w-5 h-5" />
      </button>
      {typeof document !== 'undefined' && createPortal(<AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[300] flex items-center justify-center" style={{ background: 'rgba(5,6,9,0.7)', backdropFilter: 'blur(4px)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={e => { if (e.target === e.currentTarget && state !== 'sending') setOpen(false); }}>
            <motion.div className="w-[620px] rounded-[18px] p-7 flex flex-col gap-4 text-white" style={{ background: '#12141b', boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}
              initial={{ y: 20 }} animate={{ y: 0 }}>
              <div className="font-logik-extended-bold uppercase text-[22px]">Zgłoś błąd</div>
              <div className="text-[15px] opacity-70">Napisz krótko, co się stało. Stan gry i ostatnie błędy strony dołączymy sami.</div>
              <textarea autoFocus value={text} onChange={e => setText(e.target.value)} maxLength={1500} rows={5}
                className="rounded-[10px] p-3 text-[15px] bg-transparent outline-none resize-none" style={{ boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.2)' }}
                placeholder="Np. walka się zawiesiła, nie dało się kliknąć…" onKeyDown={e => e.stopPropagation()} />
              <div className="flex items-center gap-4">
                <button type="button" onClick={send} disabled={state === 'sending' || state === 'sent' || text.trim().length < 3}
                  className="h-11 px-7 rounded-full font-bold uppercase tracking-widest text-[13px] disabled:opacity-40 flex items-center gap-2" style={{ background: 'var(--tournament-primary)' }}>
                  {state === 'sending' && <Loader2 className="w-4 h-4 animate-spin" />}{state === 'sent' && <Check className="w-4 h-4" />}{state === 'sent' ? 'Wysłane, dzięki!' : 'Wyślij'}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="text-[13px] uppercase tracking-widest opacity-60 hover:opacity-100">Anuluj</button>
                {state === 'error' && <span className="text-[14px] text-[#ff7a6b]">Nie udało się wysłać. Spróbuj jeszcze raz.</span>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}
    </>
  );
}
