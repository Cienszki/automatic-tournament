'use client';

// The navbar's way in for visitors (where signed-in people see the bell): "Zaloguj", which slides
// open into the two providers' round buttons. Click outside or Escape folds it back.

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LogIn } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { DiscordMark, GoogleMark } from './BrandMarks';

export function NavLogin({ color }: { color?: string }) {
  const { signInWithDiscord, signInGoogleDirect, discordLogin } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const round = 'w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform hover:scale-110 active:scale-95';
  return (
    <div ref={ref} className="self-stretch flex items-center px-2">
      <AnimatePresence mode="wait" initial={false}>
        {!open ? (
          <motion.button key="in" type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 px-2 py-2 text-sm font-medium hover:opacity-80"
            style={{ color }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }}>
            <LogIn className="h-4 w-4" />
            <span className="hidden lg:inline">Zaloguj</span>
          </motion.button>
        ) : (
          <motion.div key="ways" className="flex items-center gap-2" initial="hide" animate="show" exit="hide"
            variants={{ show: { transition: { staggerChildren: 0.06 } }, hide: {} }}>
            {discordLogin !== false && (
              <motion.button type="button" onClick={() => signInWithDiscord()} aria-label="Zaloguj przez Discord" title="Zaloguj przez Discord" className={round}
                style={{ background: '#5865F2', color: '#fff', boxShadow: '0 4px 14px rgba(88,101,242,0.45)' }}
                variants={{ hide: { opacity: 0, scale: 0.4, x: 14 }, show: { opacity: 1, scale: 1, x: 0 } }}>
                <DiscordMark size={20} />
              </motion.button>
            )}
            <motion.button type="button" onClick={() => signInGoogleDirect()} aria-label="Zaloguj przez Google" title="Zaloguj przez Google" className={round}
              style={{ background: '#fff', boxShadow: 'inset 0 0 0 1px #dadce0, 0 4px 14px rgba(0,0,0,0.25)' }}
              variants={{ hide: { opacity: 0, scale: 0.4, x: 14 }, show: { opacity: 1, scale: 1, x: 0 } }}>
              <GoogleMark size={18} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
