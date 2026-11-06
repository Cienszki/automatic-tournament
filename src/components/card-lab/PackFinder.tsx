'use client';

// Packs found on the site (every tournament page, signed in): once a minute, while the tab is
// visible and the person did something in that minute, the browser tells the server; now and then
// the server hides a pack. It peeks in from an edge of the screen for 10 minutes; a click takes it.
// Never shown over a card match (anything marked data-snap-lock).

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useStatsKey } from '@/components/stats-lab/kit';
import { count } from '@/lib/plural';
import { FoilPack, GOLD } from './FoilPack';

const BEAT = 60_000;
const IDLE = 60_000;

interface Spot { side: 'left' | 'right' | 'bottom'; at: number; tilt: number }
const spotFor = (id: string): Spot => {
  // From the pack's id, so every tab shows it in the same place
  const n = parseInt(id.slice(0, 6), 16);
  const side = (['left', 'right', 'bottom'] as const)[n % 3];
  return { side, at: 22 + (n >> 2) % 56, tilt: side === 'left' ? 18 : side === 'right' ? -18 : ((n >> 4) % 2 ? 10 : -10) };
};

async function post(user: NonNullable<ReturnType<typeof useAuth>['user']>, body: object) {
  const r = await fetch('/api/cards/find', {
    method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Nie udało się');
  return j;
}

export function PackFinder() {
  const { user } = useAuth();
  const key = useStatsKey();
  const { toast } = useToast();
  const [find, setFind] = useState<{ id: string; expiresAt: number } | null>(null);
  const [hidden, setHidden] = useState(false);
  const [taking, setTaking] = useState(false);
  const lastInput = useRef(0);

  // Real activity only: moving, scrolling, typing, touching
  useEffect(() => {
    const on = () => { lastInput.current = Date.now(); };
    const evs = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'scroll', 'touchstart'] as const;
    evs.forEach(e => window.addEventListener(e, on, { passive: true, capture: true }));
    return () => evs.forEach(e => window.removeEventListener(e, on, { capture: true }));
  }, []);

  // Once a minute: an active minute → maybe a pack
  useEffect(() => {
    if (!user || !key) { setFind(null); return; }
    const tick = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastInput.current > IDLE) return;
      post(user, { action: 'beat', t: key }).then(j => setFind(j.find ?? null)).catch(() => {});
    };
    const t = setInterval(tick, BEAT);
    return () => clearInterval(t);
  }, [user, key]);

  // Gone after its time; tucked away while a card match is on screen
  useEffect(() => {
    if (!find) return;
    const t = setInterval(() => {
      if (Date.now() > find.expiresAt) setFind(null);
      setHidden(!!document.querySelector('[data-snap-lock]'));
    }, 1000);
    return () => clearInterval(t);
  }, [find]);

  const take = async () => {
    if (!user || !find || taking) return;
    setTaking(true);
    try {
      const j = await post(user, { action: 'claim', id: find.id });
      // An open card game shows the new count right away
      window.dispatchEvent(new CustomEvent('cards:packs', { detail: { t: key, packs: j.packs } }));
      toast({ title: 'Nowa paczka kart', description: `Masz ${count(j.packs, 'paczkę', 'paczki', 'paczek')} do otwarcia w Grze karcianej.` });
    } catch (e) { toast({ title: (e as Error).message }); }
    finally { setFind(null); setTaking(false); }
  };

  const s = find ? spotFor(find.id) : null;
  const place: React.CSSProperties = !s ? {} : s.side === 'left' ? { left: -22, top: `${s.at}%` } : s.side === 'right' ? { right: -22, top: `${s.at}%` } : { bottom: -34, left: `${s.at}%` };
  const from = !s ? {} : s.side === 'left' ? { x: -90 } : s.side === 'right' ? { x: 90 } : { y: 110 };
  return (
    <AnimatePresence>
      {find && s && !hidden && (
        <motion.button key={find.id} type="button" onClick={take} aria-label="Znaleziona paczka kart: kliknij, żeby ją wziąć"
          title="Paczka kart! Kliknij, żeby ją wziąć"
          className="fixed z-[70] cursor-pointer" style={place}
          initial={{ opacity: 0, rotate: s.tilt, ...from }} animate={{ opacity: 1, x: 0, y: 0, rotate: s.tilt }}
          exit={taking ? { opacity: 0, scale: 1.8, rotate: 0 } : { opacity: 0, ...from }}
          transition={{ type: 'spring', stiffness: 120, damping: 14 }} whileHover={{ scale: 1.15, rotate: 0 }}>
          {/* A slow glow and a small wobble, so it gets noticed without shouting */}
          <motion.span className="absolute -inset-4 rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${GOLD}55, transparent 65%)` }}
            animate={{ opacity: [0.4, 0.9, 0.4] }} transition={{ duration: 2.2, repeat: Infinity }} />
          <motion.span className="relative block" animate={{ rotate: [0, -4, 4, 0] }} transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 3.5 }}>
            <FoilPack w={58} />
          </motion.span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
