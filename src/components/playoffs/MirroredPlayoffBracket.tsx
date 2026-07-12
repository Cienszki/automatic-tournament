"use client";

import { useMemo, useRef, useState, useEffect } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { useTranslations } from 'next-intl';
import { BracketMatchCard } from './BracketMatchCard';
import {
  computeMirroredBracketLayout,
  isByeMatch,
  CARD_WIDTH,
  CARD_HEIGHT,
} from '@/lib/playoff-bracket-generator';
import type { PlayoffMatch } from '@/lib/definitions';

interface MirroredPlayoffBracketProps {
  matches: PlayoffMatch[];
  maxHeight?: string | number;
}

const HDR_H = 26; // column-label strip height (in canvas units)
const PAD = 6; // viewport padding kept around the fitted canvas

/**
 * Two-sided playoff bracket: upper bracket on the left, lower bracket mirrored
 * on the right, and the grand final in the middle. The whole canvas is scaled
 * to fit the viewport so both halves stay visible at once.
 */
export function MirroredPlayoffBracket({ matches, maxHeight = '80vh' }: MirroredPlayoffBracketProps) {
  const { theme } = useTournament();
  const t = useTranslations('pdlPlayoffs');

  const viewportRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const layout = useMemo(() => computeMirroredBracketLayout(matches), [matches]);
  const { positions, connectors, columns, totalWidth, totalHeight } = layout;

  // Source labels ("U2A Winner" / "L1B Loser") for still-empty slots.
  const slotSourceMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of matches) {
      if (m.nextWinnerMatchId && m.code)
        map.set(`${m.nextWinnerMatchId}:${m.nextWinnerSlot ?? 'teamA'}`, `${m.code} ${t('bracketWinner')}`);
      if (m.nextLoserMatchId && m.code)
        map.set(`${m.nextLoserMatchId}:${m.nextLoserSlot ?? 'teamB'}`, `${m.code} ${t('bracketLoser')}`);
    }
    return map;
  }, [matches, t]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    // Measure from the live box and only update on a real change (avoids
    // redundant renders while still catching late layout settling).
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize(prev => (prev.w === r.width && prev.h === r.height ? prev : { w: r.width, h: r.height }));
    };
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    // The home page settles late (loading screen, fonts, snap-scroll container),
    // and the observer may capture a stale size before that. Re-measure across a
    // few frames/timeouts and on window resize so the fit is correct without the
    // user having to nudge the window.
    const raf = requestAnimationFrame(measure);
    const t1 = setTimeout(measure, 200);
    const t2 = setTimeout(measure, 600);
    window.addEventListener('resize', measure);
    return () => {
      obs.disconnect();
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', measure);
    };
  }, []);

  const canvasW = totalWidth;

  // The folded bracket is wide and short, so card size is governed by width.
  // When there is spare vertical room, spread the rows to fill it — this uses
  // the vertical space without shrinking the cards.
  const availW = size.w - PAD * 2;
  const availH = size.h - PAD * 2;
  const wScale = availW > 0 && canvasW > 0 ? availW / canvasW : 1;
  const vRoom = wScale > 0 ? availH / wScale - HDR_H : totalHeight; // body height available, in canvas units
  const vStretch = totalHeight > 0 && vRoom > totalHeight
    ? Math.min(vRoom / totalHeight, 2.6)
    : 1;

  const bodyH = totalHeight * vStretch;
  const canvasH = bodyH + HDR_H;

  // Contain-fit to the viewport. Whenever the width is known, ALWAYS fit to
  // width (height only tightens it further) — so a late/zero height reading can
  // never leave the bracket at natural size and clip the outer columns.
  const scale =
    availW > 0 && canvasW > 0
      ? (availH > 0 && canvasH > 0
          ? Math.min(availW / canvasW, availH / canvasH)
          : availW / canvasW)
      : 1;
  const offsetX = Math.max(PAD, (size.w - canvasW * scale) / 2);
  const offsetY = Math.max(PAD, (size.h - canvasH * scale) / 2);

  const colLabel = (kind: 'upper' | 'lower' | 'final', round: number) =>
    kind === 'final' ? t('grandFinal') : `${kind === 'upper' ? 'UB' : 'LB'} R${round}`;

  // The viewport container is ALWAYS rendered (even before matches load) so the
  // ResizeObserver attaches on mount and measures a real size. Returning early with a
  // different tree here would leave the observer unattached; when data then arrived the
  // canvas would render at natural size (scale 1) and clip the outer columns until a
  // manual window resize forced a re-measure.
  return (
    <div ref={viewportRef} className="relative w-full overflow-hidden" style={{ height: maxHeight }}>
      {positions.length === 0 ? (
        <div className="w-full h-full flex items-center justify-center p-12 text-gray-500 font-logik">
          {t('tbd')}
        </div>
      ) : (
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          width: canvasW,
          height: canvasH,
          transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
        }}
      >
        {/* Connectors */}
        <svg
          className="absolute left-0 pointer-events-none z-0"
          style={{ top: HDR_H }}
          width={canvasW}
          height={bodyH}
        >
          {connectors.map((c, i) => {
            const midX = (c.fromX + c.toX) / 2;
            const fromY = c.fromY * vStretch;
            const toY = c.toY * vStretch;
            return (
              <path
                key={i}
                d={`M ${c.fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${c.toX} ${toY}`}
                fill="none"
                stroke={theme?.secondaryTextColor || 'rgba(255,255,255,0.12)'}
                strokeWidth={1.5}
                opacity={0.4}
              />
            );
          })}
        </svg>

        {/* Column headers */}
        {columns.map((col, i) => (
          <div
            key={`hdr-${i}`}
            className="absolute text-[11px] uppercase tracking-widest font-logik font-medium text-center whitespace-nowrap"
            style={{
              left: col.x,
              top: 0,
              width: CARD_WIDTH,
              color: col.kind === 'final'
                ? (theme?.primaryColor || '#d4af37')
                : (theme?.secondaryTextColor || '#6b7280'),
            }}
          >
            {colLabel(col.kind, col.round)}
          </div>
        ))}

        {/* Match cards */}
        {positions.map(pm => (
          <div key={pm.match.id} className="absolute z-10" style={{ left: pm.x, top: pm.y * vStretch + HDR_H }}>
            {isByeMatch(pm.match) ? (
              <div
                aria-hidden
                className="rounded-lg border border-dashed border-white/5"
                style={{ width: CARD_WIDTH, height: CARD_HEIGHT, backgroundColor: 'transparent' }}
              />
            ) : (
              <BracketMatchCard
                match={pm.match}
                cardWidth={CARD_WIDTH}
                teamASourceLabel={!pm.match.teamA ? slotSourceMap.get(`${pm.match.id}:teamA`) : undefined}
                teamBSourceLabel={!pm.match.teamB ? slotSourceMap.get(`${pm.match.id}:teamB`) : undefined}
                divisionColor={theme?.primaryColor || '#d4af37'}
              />
            )}
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
