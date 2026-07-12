"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTournament } from '@/context/TournamentContext';
import { useTranslations } from 'next-intl';
import { BracketMatchCard } from './BracketMatchCard';
import {
  computeBracketLayout,
  isByeMatch,
  CARD_WIDTH,
  CONNECTOR_WIDTH,
  CARD_HEIGHT,
  CARD_GAP,
} from '@/lib/playoff-bracket-generator';
import type { PlayoffMatch } from '@/lib/definitions';

interface PlayoffBracketProps {
  matches: PlayoffMatch[];
  view: 'upper' | 'lower';
  maxHeight?: string | number;
}

const NAV_H  = 52; // horizontal nav row height (arrows + dots)
const HDR_H  = 30; // round-name header strip height
const NATURAL_STEP = CARD_WIDTH + CONNECTOR_WIDTH; // 322px — generator's column pitch

export function PlayoffBracket({ matches, view, maxHeight = '65vh' }: PlayoffBracketProps) {
  const { theme } = useTournament();
  const t = useTranslations('pdlPlayoffs');

  const viewportRef  = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [viewportHeight, setViewportHeight] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [hScroll, setHScroll]     = useState(0);
  const [vScrollPx, setVScrollPx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPx, setDragPx]         = useState({ x: 0, y: 0 });
  const dragRef = useRef({ active: false, moved: false, clientX: 0, clientY: 0, hPx: 0, vPx: 0 });

  // ── Layout ───────────────────────────────────────────────────────────────────
  const layout = useMemo(() => computeBracketLayout(matches, view), [matches, view]);
  const { positions, connectors, totalHeight, roundCount } = layout;

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

  // ── ResizeObservers ──────────────────────────────────────────────────────────
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setViewportHeight(e.contentRect.height));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setContainerWidth(e.contentRect.width));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => { setHScroll(0); setVScrollPx(0); }, [view]);

  // ── Horizontal stretch ───────────────────────────────────────────────────────
  // Number of columns that fit at natural card size.
  const naturalVisible = containerWidth > 0
    ? Math.max(1, Math.floor(containerWidth / NATURAL_STEP)) : 4;
  const visibleRounds = Math.min(roundCount, naturalVisible);

  // Stretch each column so exactly `visibleRounds` columns fill the container.
  const effectiveStep = containerWidth > 0 && visibleRounds > 0
    ? containerWidth / visibleRounds : NATURAL_STEP;
  const effectiveCardWidth = Math.round(effectiveStep - CONNECTOR_WIDTH);

  // All generator x-coords are in multiples of NATURAL_STEP → scale to effectiveStep.
  const xScale = effectiveStep / NATURAL_STEP;

  // Full canvas width with stretched columns.
  const scaledTotalWidth = roundCount * effectiveStep;

  // Horizontal carousel
  const maxHScroll     = Math.max(0, roundCount - visibleRounds);
  const effHScroll     = Math.min(hScroll, maxHScroll);
  const canScrollLeft  = effHScroll > 0;
  const canScrollRight = effHScroll + visibleRounds < roundCount;
  const scrollLeft     = () => canScrollLeft  && setHScroll(effHScroll - 1);
  const scrollRight    = () => canScrollRight && setHScroll(effHScroll + 1);

  // ── Vertical paging ──────────────────────────────────────────────────────────
  const needsHNav  = roundCount > visibleRounds;
  const activeNavH = needsHNav ? NAV_H : 0;
  const vStep      = CARD_HEIGHT + CARD_GAP;
  const clipHeight = Math.max(0, viewportHeight - activeNavH - HDR_H - vStep - 4);
  const maxVScroll = Math.max(0, totalHeight - clipHeight);
  const effVScroll = Math.min(vScrollPx, maxVScroll);
  const canScrollUp   = effVScroll > 0;
  const canScrollDown = effVScroll < maxVScroll;
  const scrollUp   = () => canScrollUp   && setVScrollPx(Math.max(0, effVScroll - vStep));
  const scrollDown = () => canScrollDown && setVScrollPx(Math.min(maxVScroll, effVScroll + vStep));

  // ── Live drag offsets (pixel-accurate during drag, snapped otherwise) ─────────
  const liveHPx = isDragging
    ? Math.max(0, Math.min(dragRef.current.hPx - dragPx.x, maxHScroll * effectiveStep))
    : effHScroll * effectiveStep;
  const liveVPx = isDragging
    ? Math.max(0, Math.min(dragRef.current.vPx - dragPx.y, maxVScroll))
    : effVScroll;

  // ── Column helpers ───────────────────────────────────────────────────────────
  // Convert generator x → column index
  const posToCol = (x: number) => Math.round(x / NATURAL_STEP);

  const uniqueCols = Array.from(new Set(positions.map(p => posToCol(p.x))));

  const getColLabel = (col: number): string => {
    const hit = positions.find(p => posToCol(p.x) === col);
    if (!hit) return '';
    const m = hit.match;
    if (m.bracketType === 'final') return t('grandFinal');
    return `${view === 'upper' ? 'UB' : 'LB'} R${m.round}`;
  };

  // ── Scale connector x-coords ─────────────────────────────────────────────────
  // Generator fromX = col*NATURAL_STEP + CARD_WIDTH  →  col*effectiveStep + effectiveCardWidth
  // Generator toX   = col*NATURAL_STEP               →  col*effectiveStep
  const scaledConnectors = connectors.map(c => ({
    fromX: (c.fromX - CARD_WIDTH) * xScale + effectiveCardWidth,
    fromY: c.fromY,
    toX:   c.toX * xScale,
    toY:   c.toY,
  }));

  // ── Empty state ───────────────────────────────────────────────────────────────
  if (positions.length === 0) {
    return (
      <div className="w-full flex items-center justify-center p-12 text-gray-500 font-logik">
        {t('tbd')}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div ref={viewportRef} className="relative w-full" style={{ height: maxHeight }}>

      {/* ── Horizontal nav: left/right arrows + dots — only when carousel is needed ── */}
      {needsHNav && <div className="relative flex items-center justify-center" style={{ height: NAV_H }}>
        <div className="absolute left-0 top-1/2 -translate-y-1/2 z-20">
          <motion.button
            whileHover={{ scale: 1.1, x: -4 }} whileTap={{ scale: 0.95 }}
            onClick={scrollLeft} disabled={!canScrollLeft}
            className={cn('flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300',
              canScrollLeft ? 'cursor-pointer' : 'opacity-0 pointer-events-none')}
          >
            <ChevronLeft className="w-5 h-5" style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.4)' }} />
            <div className="text-left hidden md:block">
              <div className="text-[10px] uppercase tracking-widest font-mono" style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.2)' }}>Wcześniej</div>
              <div className="text-sm" style={{ color: theme?.primaryTextColor || 'rgba(255,255,255,0.5)' }}>{getColLabel(effHScroll - 1)}</div>
            </div>
          </motion.button>
        </div>

        <div className="absolute right-0 top-1/2 -translate-y-1/2 z-20">
          <motion.button
            whileHover={{ scale: 1.1, x: 4 }} whileTap={{ scale: 0.95 }}
            onClick={scrollRight} disabled={!canScrollRight}
            className={cn('flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300',
              canScrollRight ? 'cursor-pointer' : 'opacity-0 pointer-events-none')}
          >
            <div className="text-right hidden md:block">
              <div className="text-[10px] uppercase tracking-widest font-mono" style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.2)' }}>Dalej</div>
              <div className="text-sm" style={{ color: theme?.primaryTextColor || 'rgba(255,255,255,0.5)' }}>{getColLabel(effHScroll + visibleRounds)}</div>
            </div>
            <ChevronRight className="w-5 h-5" style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.4)' }} />
          </motion.button>
        </div>

        {roundCount > visibleRounds && (
          <div className="flex items-center gap-2">
            {Array.from({ length: roundCount }).map((_, idx) => {
              const isActive = idx === effHScroll + Math.floor(visibleRounds / 2);
              return (
                <button key={idx} aria-label={`Round ${idx + 1}`}
                  onClick={() => setHScroll(Math.max(0, Math.min(idx - Math.floor(visibleRounds / 2), maxHScroll)))}
                  className="flex items-center justify-center">
                  <div className={cn('w-2 h-2 rounded-full transition-all duration-300', isActive ? 'scale-150' : 'hover:opacity-70')}
                    style={{
                      backgroundColor: isActive ? (theme?.headingColor || '#fff') : (theme?.secondaryTextColor || '#555'),
                      boxShadow: isActive ? `0 0 8px ${theme?.headingColor || '#fff'}` : undefined,
                    }} />
                </button>
              );
            })}
          </div>
        )}
      </div>}

      {/* ── Round-name headers (only h-scrolls, never v-scrolls) ── */}
      <div className="relative overflow-hidden" style={{ height: HDR_H }}>
        <div className={cn('absolute inset-y-0 left-0', !isDragging && 'transition-transform duration-500 ease-out')}
          style={{ transform: `translateX(${-liveHPx}px)` }}>
          {uniqueCols.map(col => (
            <div key={`hdr-${col}`}
              className="absolute top-0 bottom-0 flex items-center text-[10px] uppercase tracking-widest font-logik font-medium whitespace-nowrap"
              style={{
                left: col * effectiveStep + effectiveCardWidth / 2,
                transform: 'translateX(-50%)',
                color: theme?.secondaryTextColor || '#6b7280',
              }}>
              {getColLabel(col)}
            </div>
          ))}
        </div>
      </div>

      {/* ── Bracket clip viewport ── */}
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden"
        style={{ height: clipHeight > 0 ? clipHeight : undefined, cursor: isDragging ? 'grabbing' : 'grab' }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          // Do NOT capture the pointer on press — capturing here would steal the
          // subsequent `click` from child cards/buttons, so tapping a match card
          // could never open its detail modal. We capture only once a real drag
          // begins (see onPointerMove).
          dragRef.current = { active: true, moved: false, clientX: e.clientX, clientY: e.clientY, hPx: liveHPx, vPx: liveVPx };
        }}
        onPointerMove={(e) => {
          if (!dragRef.current.active) return;
          const dx = e.clientX - dragRef.current.clientX;
          const dy = e.clientY - dragRef.current.clientY;
          if (!dragRef.current.moved && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
            dragRef.current.moved = true;
            setIsDragging(true);
            // A drag is underway: capture so we keep receiving move/up events even
            // if the pointer leaves the viewport.
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }
          if (dragRef.current.moved) setDragPx({ x: dx, y: dy });
        }}
        onPointerUp={(e) => {
          if (!dragRef.current.active) return;
          dragRef.current.active = false;
          if (dragRef.current.moved) {
            const dx = e.clientX - dragRef.current.clientX;
            const dy = e.clientY - dragRef.current.clientY;
            const finalHPx = Math.max(0, Math.min(dragRef.current.hPx - dx, maxHScroll * effectiveStep));
            const finalVPx = Math.max(0, Math.min(dragRef.current.vPx - dy, maxVScroll));
            setHScroll(Math.round(finalHPx / (effectiveStep || 1)));
            setVScrollPx(finalVPx);
          }
          setDragPx({ x: 0, y: 0 });
          setIsDragging(false);
          // Leave `moved` set so the click that follows a drag is suppressed by
          // onClickCapture; it is reset on the next pointer-down.
        }}
        onPointerCancel={() => {
          dragRef.current.active = false;
          dragRef.current.moved = false;
          setIsDragging(false);
          setDragPx({ x: 0, y: 0 });
        }}
        onClickCapture={(e) => {
          if (dragRef.current.moved) e.stopPropagation();
        }}
      >

        {/* Scroll canvas: both h-scroll and v-scroll */}
        <div className={cn('absolute top-0 left-0', !isDragging && 'transition-transform duration-500 ease-out')}
          style={{
            width: scaledTotalWidth,
            height: totalHeight,
            transform: `translateX(${-liveHPx}px) translateY(${-liveVPx}px)`,
          }}>

          {/* SVG connectors */}
          <svg className="absolute inset-0 pointer-events-none z-0" width={scaledTotalWidth} height={totalHeight}>
            {scaledConnectors.map((c, i) => {
              const midX = (c.fromX + c.toX) / 2;
              return (
                <path key={i}
                  d={`M ${c.fromX} ${c.fromY} C ${midX} ${c.fromY}, ${midX} ${c.toY}, ${c.toX} ${c.toY}`}
                  fill="none" stroke={theme?.secondaryTextColor || 'rgba(255,255,255,0.12)'} strokeWidth={1.5} opacity={0.4} />
              );
            })}
          </svg>

          {/* Match cards */}
          {positions.map(pm => (
            <div key={pm.match.id} className="absolute z-10" style={{ left: pm.x * xScale, top: pm.y }}>
              {isByeMatch(pm.match) ? (
                <div
                  aria-hidden
                  className="rounded-lg border border-dashed border-white/5"
                  style={{
                    width: effectiveCardWidth,
                    height: CARD_HEIGHT,
                    backgroundColor: 'transparent',
                  }}
                />
              ) : (
                <BracketMatchCard
                  match={pm.match}
                  cardWidth={effectiveCardWidth}
                  teamASourceLabel={!pm.match.teamA ? slotSourceMap.get(`${pm.match.id}:teamA`) : undefined}
                  teamBSourceLabel={!pm.match.teamB ? slotSourceMap.get(`${pm.match.id}:teamB`) : undefined}
                  divisionColor={theme?.primaryColor || '#d4af37'}
                />
              )}
            </div>
          ))}
        </div>

        {/* ── Vertical nav: up/down arrows (floating right) ── */}
        {(canScrollUp || canScrollDown) && (
          <div className="absolute right-2 top-0 bottom-0 flex flex-col items-center justify-center gap-3 z-30 pointer-events-none">
            <motion.button whileHover={{ scale: 1.15, y: -3 }} whileTap={{ scale: 0.9 }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={scrollUp} style={{ pointerEvents: 'auto' }}
              className={cn('flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-300',
                canScrollUp ? 'cursor-pointer' : 'opacity-20 pointer-events-none')}>
              <ChevronUp className="w-5 h-5" style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.5)' }} />
            </motion.button>

            {clipHeight > 0 && totalHeight > clipHeight && (
              <div className="flex flex-col items-center gap-1.5">
                {Array.from({ length: Math.ceil(totalHeight / vStep) }).map((_, idx) => {
                  const segTop = idx * vStep;
                  const inView = segTop >= effVScroll - vStep / 2 && segTop < effVScroll + clipHeight;
                  return (
                    <div key={idx}
                      className={cn('rounded-full transition-all duration-300', inView ? 'w-1.5 h-1.5' : 'w-1 h-1 opacity-30')}
                      style={{ backgroundColor: theme?.secondaryTextColor || '#666' }} />
                  );
                })}
              </div>
            )}

            <motion.button whileHover={{ scale: 1.15, y: 3 }} whileTap={{ scale: 0.9 }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={scrollDown} style={{ pointerEvents: 'auto' }}
              className={cn('flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-300',
                canScrollDown ? 'cursor-pointer' : 'opacity-20 pointer-events-none')}>
              <ChevronDown className="w-5 h-5" style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.5)' }} />
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
}
