'use client';

// The signed-out cards page: the headline and both ways in on the left, every card of the tournament
// drifting past on the right.

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useTournament } from '@/context/TournamentContext';
import { C, useHeaderFont } from '@/components/stats-lab/kit';
import { buildSeriesCards, byStrength, type GCard } from '@/lib/card-lab/cards';
import type { Model } from '@/lib/stats-lab/derive';
import { CardFace } from '../ui';
import { DiscordMark, GoogleMark } from '@/components/auth/BrandMarks';

/** Both ways in at once, in the providers' own colours */
export function LoginButtons() {
  const { signInWithDiscord, signInGoogleDirect, discordLogin } = useAuth();
  const btn = 'h-[62px] px-9 text-[17px] rounded-[8px] flex items-center justify-center gap-3 font-semibold transition-[filter,transform] hover:brightness-110 active:scale-[0.98]';
  return (
    <div className="flex gap-3">
      {discordLogin !== false && (
        <button type="button" onClick={() => signInWithDiscord()} className={btn} style={{ background: '#5865F2', color: '#fff', minWidth: 290, boxShadow: '0 10px 30px rgba(88,101,242,0.35)' }}>
          <DiscordMark />Zaloguj przez Discord
        </button>
      )}
      <button type="button" onClick={() => signInGoogleDirect()} className={btn} style={{ background: '#fff', color: '#1f1f1f', minWidth: 290, boxShadow: 'inset 0 0 0 1px #dadce0, 0 10px 30px rgba(0,0,0,0.25)' }}>
        <GoogleMark />Zaloguj przez Google
      </button>
    </div>
  );
}

/** Columns of cards drifting up and down */
function Wall({ cards, cols, w }: { cards: GCard[]; cols: number; w: number }) {
  const lanes = Array.from({ length: cols }, (_, i) => cards.filter((_, j) => j % cols === i));
  return (
    <div className="absolute inset-0 flex gap-4 justify-center" style={{ opacity: 0.75, filter: 'saturate(0.85)' }}>
      {lanes.map((col, i) => (
        <motion.div key={i} className="flex flex-col gap-4 shrink-0" animate={{ y: i % 2 ? [-420, 0] : [0, -420] }} transition={{ duration: 34 + (i % 3) * 6, repeat: Infinity, repeatType: 'mirror', ease: 'linear' }}>
          {[...col, ...col, ...col].map((c, j) => <CardFace key={`${c.id}-${j}`} c={c} w={w} tip={false} />)}
        </motion.div>
      ))}
    </div>
  );
}

function Headline() {
  const font = useHeaderFont();
  // The last word in the tournament's own colour, exactly as set
  const lines: Array<[string, string]> = [['Zbieraj.', '#fff'], ['Układaj.', 'rgba(255,255,255,0.55)'], ['Wygrywaj.', 'var(--tournament-primary)']];
  return (
    <div>
      {lines.map(([t, color], i) => (
        <motion.div key={t} className="font-logik-extended-bold uppercase leading-[0.86]" style={{ fontSize: 132, color, ...font }}
          initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.12, duration: 0.5 }}>{t}</motion.div>
      ))}
    </div>
  );
}

export function SignIn({ model }: { model: Model }) {
  const { tournament } = useTournament();
  // Each player's best card, strongest first
  const cards = useMemo(() => {
    const all = buildSeriesCards(model, tournament?.type);
    return [...new Map([...all].sort((a, b) => byStrength(b, a)).map(c => [c.pid, c])).values()].sort(byStrength).slice(0, 40);
  }, [model, tournament?.type]);
  return (
    <div className="relative h-full overflow-hidden" style={{ background: '#08090d', color: C.text }}>
      <div className="absolute inset-y-0 right-0 w-[64%]"><Wall cards={cards} cols={6} w={190} /></div>
      {/* Dark on the left for the words, the wall fading in to the right */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, #08090d 0%, #08090d 38%, rgba(8,9,13,0.75) 55%, rgba(8,9,13,0.15) 80%, rgba(8,9,13,0.35) 100%)' }} />
      <div className="absolute inset-x-0 top-0 h-32" style={{ background: 'linear-gradient(180deg, #08090d, transparent)' }} />
      <div className="absolute inset-x-0 bottom-0 h-32" style={{ background: 'linear-gradient(0deg, #08090d, transparent)' }} />
      <div className="relative h-full flex flex-col justify-center pl-28 gap-10 max-w-[1000px]">
        <div className="text-[13px] uppercase tracking-[0.4em] text-white/60">{tournament?.name} · gra karciana</div>
        <Headline />
        <p className="text-[19px] leading-relaxed text-white/80 max-w-[620px]">Zdobądź najlepszą talię i rzuć wyzwanie znajomym. Sprawdź, na czym polega kontrola mapy. Mecze zajmują ok. 5 minut.</p>
        <LoginButtons />
      </div>
    </div>
  );
}
