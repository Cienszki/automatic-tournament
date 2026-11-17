'use client';

// The redesigned card game's match screen (WP-55) against the computer, on the prototype's cards
// (Wiosenna), with no server and no database.
//   ?level=easy|medium|hard     the computer (without it: the choice of level)
//   &s=plan|fight|reveal|end    jump to that state (the first rounds are played by the computer)
//   &seed=N &round=N            which match, and from which round on to stop
//   &shot=1                     for screenshots: hides the development server's own corner mark
import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bot } from 'lucide-react';
import { mix, useHeaderFont } from '@/components/stats-lab/kit';
import { LEVELS, type Level } from '@/features/cards/domain/v2/ai/levels';
import { DEFAULT_RULES } from '@/features/cards/domain/v2/rules';
import type { Cast } from '@/features/cards/state/game';
import type { Jump } from '@/features/cards/state/jump';
import { FitStage } from '@/features/cards/components/match/FitStage';
import { MatchScreen } from '@/features/cards/components/match/MatchScreen';
import { T } from '@/features/cards/components/match/theme';
import { DECKS, POOL } from '../_shared/data';

const STATES = ['plan', 'fight', 'reveal', 'end'] as const;
const LEVEL_KEYS: Level[] = ['easy', 'medium', 'hard'];
const int = (v: string | null): number | undefined => (v !== null && /^\d+$/.test(v) ? Number(v) : undefined);

function Picker({ onPick }: { onPick: (l: Level) => void }) {
  const font = useHeaderFont();
  return (
    <div className="h-full flex flex-col items-center justify-center gap-10" style={{ background: `radial-gradient(110% 80% at 45% 0%, #191c25, ${T.bg} 62%)`, color: T.text }}>
      <div className="font-logik-extended-bold uppercase text-[54px] leading-none" style={font}>Kontrola mapy</div>
      <div className="flex gap-6">
        {LEVEL_KEYS.map((l) => (
          <button key={l} type="button" onClick={() => onPick(l)} className="flex flex-col items-center gap-3 rounded-[22px] px-12 py-8 transition-transform hover:scale-105"
            style={{ boxShadow: `inset 0 0 0 2px ${LEVELS[l].color}`, background: mix(LEVELS[l].color, 10) }}>
            <Bot className="w-10 h-10" style={{ color: LEVELS[l].color }} />
            <span className="font-logik-extended-bold uppercase text-[22px]" style={{ color: LEVELS[l].color, ...font }}>{LEVELS[l].name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Game() {
  const q = useSearchParams();
  const router = useRouter();
  const level = LEVEL_KEYS.find((l) => l === q.get('level'));
  const seed0 = int(q.get('seed')) ?? 1;
  const to = STATES.find((s) => s === q.get('s'));
  const round = int(q.get('round'));
  const jump: Jump | null = to ? { to, round } : round ? { to: 'plan', round } : null;
  // A match: the decks are fixed for it; a rematch keeps them, a new rival changes the computer's
  const [match, setMatch] = useState(() => ({ n: 0, mine: seed0 % DECKS.length, theirs: (seed0 + 3) % DECKS.length }));
  const hideDevMark = q.get('shot') ? <style>{'nextjs-portal{display:none}'}</style> : null;
  const go = (l: Level | null) => router.replace(l ? `?level=${l}` : '?');
  if (!level) return <div className="fixed inset-0">{hideDevMark}<Picker onPick={go} /></div>;
  const cast: Cast = { decks: [DECKS[match.mine], DECKS[match.theirs]], pool: POOL, level, rules: DEFAULT_RULES };
  const next = (theirs: number) => setMatch((x) => ({ n: x.n + 1, mine: x.mine, theirs }));
  return (
    <div className="fixed inset-0" style={{ background: T.bg }}>
      {hideDevMark}
      <FitStage>
        <MatchScreen key={`${level}-${match.n}`} seed={seed0 + match.n} cast={cast} jump={match.n ? null : jump}
          onRematch={() => next(match.theirs)}
          onNew={() => { let t = (match.theirs + 1) % DECKS.length; if (t === match.mine) t = (t + 1) % DECKS.length; next(t); }}
          onExit={() => go(null)} />
      </FitStage>
    </div>
  );
}

export default function GamePrototypePage() {
  return <Suspense fallback={null}><Game /></Suspense>;
}
