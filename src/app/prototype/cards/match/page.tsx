'use client';

// Prototypes of the redesigned card game's match screen (WP-54): a whole match against the easy
// computer on the real rules engine, with no server, no database and no network.
//   ?v=1|2|3            the version (2 when missing): 1 the map, 2 three rows, 3 rows with the
//                       reveal played objective by objective
//   ?s=plan|fight|reveal|end   jump to that state (the first rounds are played by the computer)
//   &seed=N &round=N    which match, and from which round on to stop
//   &step=N             with s=reveal: the step of the reveal to stand still on
//   &pick=0             with s=plan or s=fight: nothing chosen yet
import React, { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MatchScreen } from '../_shared/MatchScreen';
import type { Jump } from '../_shared/state/game';
import { VersionPicker } from '../_shared/ui/VersionPicker';

const STATES = ['plan', 'fight', 'reveal', 'end'] as const;
const int = (v: string | null): number | undefined => (v !== null && /^\d+$/.test(v) ? Number(v) : undefined);

function Match() {
  const q = useSearchParams();
  const [again, setAgain] = useState(0);
  const version = q.get('v') === '1' ? 1 : q.get('v') === '3' ? 3 : 2;
  const seed = int(q.get('seed')) ?? 1;
  const to = STATES.find((s) => s === q.get('s'));
  const round = int(q.get('round'));
  const jump: Jump | null = to ? { to, round } : round ? { to: 'plan', round } : null;
  return (
    <>
      <MatchScreen key={`${version}-${seed}-${again}-${to}-${round}`} version={version} seed={seed + again} jump={again ? null : jump} step={int(q.get('step'))} untouched={q.get('pick') === '0'} onAgain={() => setAgain((n) => n + 1)} />
      <VersionPicker current={version} query={q.toString()} />
    </>
  );
}

export default function MatchPrototypePage() {
  return <Suspense fallback={null}><Match /></Suspense>;
}
