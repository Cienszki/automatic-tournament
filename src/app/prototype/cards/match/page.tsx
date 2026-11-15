'use client';

// Prototypes of the redesigned card game's match screen (WP-54): a whole match against the easy
// computer on the real rules engine, with no server, no database and no network.
//   ?v=1|2|3            the version (2 when missing): 1 the map, 2 three rows, 3 rows with the
//                       reveal played objective by objective
//   ?s=plan|fight|reveal|end   jump to that state (the first rounds are played by the computer)
//   &seed=N &round=N    which match, and from which round on to stop
//   &step=N             with s=reveal: the step of the reveal to stand still on
//   &pick=0             with s=plan or s=fight: nothing chosen yet
//   &shot=1             for screenshots: hides the development server's own corner mark
//   &frame=390x844      shows the page in a frame of that size at the top left: a phone's screen
//                       on a desktop, and the way to photograph it (a headless browser window
//                       cannot be narrower than about 500 px)
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
  const hideDevMark = q.get('shot') ? <style>{'nextjs-portal{display:none}'}</style> : null;
  const frame = /^(\d+)x(\d+)$/.exec(q.get('frame') ?? '');
  if (frame) {
    const inner = new URLSearchParams(q.toString());
    inner.delete('frame');
    return (
      <>
        {hideDevMark}
        <iframe title="Prototyp" src={`?${inner.toString()}`} width={frame[1]} height={frame[2]} style={{ position: 'fixed', left: 0, top: 0, border: 0, background: '#000' }} />
      </>
    );
  }
  const version = q.get('v') === '1' ? 1 : q.get('v') === '3' ? 3 : 2;
  const seed = int(q.get('seed')) ?? 1;
  const to = STATES.find((s) => s === q.get('s'));
  const round = int(q.get('round'));
  const jump: Jump | null = to ? { to, round } : round ? { to: 'plan', round } : null;
  return (
    <>
      {hideDevMark}
      <MatchScreen key={`${version}-${seed}-${again}-${to}-${round}`} version={version} seed={seed + again} jump={again ? null : jump} step={int(q.get('step'))} untouched={q.get('pick') === '0'} onAgain={() => setAgain((n) => n + 1)} />
      <VersionPicker current={version} query={q.toString()} />
    </>
  );
}

export default function MatchPrototypePage() {
  return <Suspense fallback={null}><Match /></Suspense>;
}
