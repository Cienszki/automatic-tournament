// src/components/format-preview/LanBracket.tsx
// TEMPORARY — the LAN as the tournament's own playoff bracket: generated from the organiser's
// playoff settings (here: single elimination, 4 teams, bo3 semis, bo5 final), drawn as a classic
// bracket (semis on the left, the final to their right) with the playoff match cards, which open
// the usual match details. Seeding is the admin's job; the preview seeds 1–4 and 2–3.
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { BracketMatchCard } from '@/components/playoffs/BracketMatchCard';
import { CARD_HEIGHT, CARD_WIDTH, computeBracketLayout, generateBracket } from '@/lib/playoff-bracket-generator';
import type { PlayoffMatch, PlayoffMatchFormat } from '@/lib/definitions';
import { matchState, type FPMatch, type FormatSim } from './model';

const HEAD_H = 34;

/** `real`: the tournament's own playoff matches (real tournaments); the preview simulates them. */
export function LanBracket({ sim, after, real }: { sim: FormatSim; after: number; real?: PlayoffMatch[] }) {
  const { tournament, theme } = useTournament();
  const cfg = (tournament as { playoffs?: Record<string, unknown> } | null)?.playoffs ?? {};
  const primary = theme?.primaryColor || '#d4af37';

  const matches = useMemo(() => {
    const fmt = (v: unknown, d: PlayoffMatchFormat) => (v === 'bo1' || v === 'bo3' || v === 'bo5' ? v : d);
    const bracket = generateBracket({
      format: 'single-elimination',
      upperBracketTeams: 4,
      lowerBracketTeams: 0,
      defaultFormat: 'bo3',
      semifinalFormat: fmt(cfg.semifinalFormat, 'bo3'),
      finalFormat: fmt(cfg.finalFormat, 'bo3'),
      grandFinalFormat: fmt(cfg.grandFinalFormat, 'bo5'),
    });
    // Real tournament: the bracket the admin set up (or the empty template until then).
    if (!sim.lan) return real && real.length ? real : bracket;
    const lan = sim.lan;
    const team = (id: string) => ({ id, name: sim.teams[id].name, logoUrl: sim.teams[id].logoUrl });
    const fill = (pm: PlayoffMatch, m: FPMatch, teamsKnown: boolean): PlayoffMatch => {
      const played = matchState(m, after) === 'played';
      return {
        ...pm,
        matchId: `preview-${m.id}`,
        teamA: teamsKnown ? team(m.a) : undefined,
        teamB: teamsKnown && m.b ? team(m.b) : undefined,
        status: played ? 'completed' : 'scheduled',
        result: played
          ? { winnerId: m.sa > m.sb ? m.a : m.b!, loserId: m.sa > m.sb ? m.b! : m.a, teamAScore: m.sa, teamBScore: m.sb, completedAt: '' }
          : undefined,
      };
    };
    const qualified = after >= sim.totalRounds;
    return bracket.map(pm => {
      if (pm.round === 1 && pm.position === 1) return fill(pm, lan.semis[0], qualified);
      if (pm.round === 1 && pm.position === 2) return fill(pm, lan.semis[1], qualified);
      if (pm.bracketType === 'final') return fill(pm, lan.final, after >= sim.totalRounds + 1);
      return pm;
    });
  }, [sim, after, real, cfg.semifinalFormat, cfg.finalFormat, cfg.grandFinalFormat]);

  const layout = useMemo(() => computeBracketLayout(matches, 'upper'), [matches]);

  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Wider connector gap than the generator's 50px so the bracket reads at a large scale.
  const SPREAD = 70;
  const colOf = (x: number) => Math.round(x / (CARD_WIDTH + 50));
  const W = layout.totalWidth + (layout.roundCount - 1) * SPREAD;
  const H = layout.totalHeight + HEAD_H;
  const scale = size.w > 0 && size.h > 0 ? Math.min(size.w / W, size.h / H, 1.8) : 0;
  const px = (x: number) => x + colOf(x) * SPREAD;
  const rounds = [...new Set(layout.positions.map(p => p.match.round))].sort((a, b) => a - b);
  const lastRound = rounds[rounds.length - 1];

  return (
    <div ref={viewport} className="relative h-full w-full overflow-hidden">
      {scale > 0 && (
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ width: W, height: H, transform: `translate(${(size.w - W * scale) / 2}px, ${(size.h - H * scale) / 2}px) scale(${scale})` }}
        >
          {rounds.map((r, i) => (
            <div
              key={r}
              className="absolute text-[11px] uppercase tracking-widest font-logik font-medium text-center"
              style={{ left: i * (CARD_WIDTH + 50 + SPREAD), top: 0, width: CARD_WIDTH, color: r === lastRound ? primary : (theme?.secondaryTextColor || '#6b7280') }}
            >
              {r === lastRound ? 'Finał' : r === lastRound - 1 ? 'Półfinały' : `Runda ${r}`}
            </div>
          ))}
          <svg className="absolute left-0 pointer-events-none" style={{ top: HEAD_H }} width={W} height={layout.totalHeight}>
            {layout.connectors.map((c, i) => {
              const x1 = px(c.fromX - CARD_WIDTH) + CARD_WIDTH;
              const x2 = px(c.toX);
              const mx = (x1 + x2) / 2;
              return (
                <path
                  key={i}
                  d={`M ${x1} ${c.fromY} H ${mx} V ${c.toY} H ${x2}`}
                  fill="none"
                  stroke={theme?.secondaryTextColor || 'rgba(255,255,255,0.3)'}
                  strokeWidth={1.5}
                  opacity={0.5}
                />
              );
            })}
          </svg>
          {layout.positions.map(p => (
            <div key={p.match.id} className="absolute" style={{ left: px(p.x), top: p.y + HEAD_H, height: CARD_HEIGHT }}>
              <BracketMatchCard match={p.match} divisionColor={primary} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
