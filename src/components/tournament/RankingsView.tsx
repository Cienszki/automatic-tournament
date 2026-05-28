'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTournament } from '@/context/TournamentContext';
import { cn } from '@/lib/utils';
import { Trophy } from 'lucide-react';
import type { RankingEntry } from '@/lib/performance-rankings-calculator';

// --- Stored rankings shape (mirrors PerformanceRankingsDoc) ---

interface StoredRankings {
  teams:           RankingEntry[];
  carry:           RankingEntry[];
  mid:             RankingEntry[];
  offlane:         RankingEntry[];
  'soft-support':  RankingEntry[];
  'hard-support':  RankingEntry[];
  updatedAt?:      string;
}

// --- Data hook: reads precomputed Firestore documents ---

function useRankingsData(): { data: StoredRankings | null; loading: boolean } {
  const { tournament, isLegacyTournament } = useTournament();
  const [data, setData]       = useState<StoredRankings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      if (!tournament?.id || isLegacyTournament) { setLoading(false); return; }

      try {
        const base = `tournaments/${tournament.id}/performanceRankings`;
        const [teamsDoc, carryDoc, midDoc, offlaneDoc, softDoc, hardDoc] = await Promise.all([
          getDoc(doc(db, base, 'teams')),
          getDoc(doc(db, base, 'carry')),
          getDoc(doc(db, base, 'mid')),
          getDoc(doc(db, base, 'offlane')),
          getDoc(doc(db, base, 'soft-support')),
          getDoc(doc(db, base, 'hard-support')),
        ]);

        if (cancelled) return;
        setData({
          teams:           teamsDoc.exists()   ? (teamsDoc.data()!.entries   as RankingEntry[]) : [],
          carry:           carryDoc.exists()   ? (carryDoc.data()!.entries   as RankingEntry[]) : [],
          mid:             midDoc.exists()     ? (midDoc.data()!.entries     as RankingEntry[]) : [],
          offlane:         offlaneDoc.exists() ? (offlaneDoc.data()!.entries as RankingEntry[]) : [],
          'soft-support':  softDoc.exists()    ? (softDoc.data()!.entries    as RankingEntry[]) : [],
          'hard-support':  hardDoc.exists()    ? (hardDoc.data()!.entries    as RankingEntry[]) : [],
          updatedAt: teamsDoc.exists() ? (teamsDoc.data()!.updatedAt as string | undefined) : undefined,
        });
      } catch (err) {
        console.error('[RankingsView] Failed to load rankings:', err);
      }
      if (!cancelled) setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [tournament?.id, isLegacyTournament]);

  return { data, loading };
}

// --- Drag-scroll list ---

function DraggableList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const containerRef       = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY         = useRef(0);
  const dragStartScrollTop = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartY.current         = e.clientY;
    dragStartScrollTop.current = containerRef.current?.scrollTop ?? 0;
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const el = containerRef.current;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      el.scrollTop = dragStartScrollTop.current - (e.clientY - dragStartY.current);
    };
    const onUp = () => setIsDragging(false);

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current         = e.touches[0].clientY;
    dragStartScrollTop.current = containerRef.current?.scrollTop ?? 0;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!containerRef.current) return;
    containerRef.current.scrollTop =
      dragStartScrollTop.current - (e.touches[0].clientY - dragStartY.current);
    e.stopPropagation();
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onWheel={(e) => e.stopPropagation()}
      className={cn(
        'overflow-y-scroll select-none',
        '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]',
        isDragging ? 'cursor-grabbing' : 'cursor-grab',
        className,
      )}
    >
      {children}
    </div>
  );
}

// --- Single ranking table column ---

function RankingTable({
  title,
  entries,
  primaryColor,
  headerFont,
}: {
  title:        string;
  entries:      RankingEntry[];
  primaryColor: string;
  headerFont?:  string;
}) {
  const fontStyle = headerFont ? { fontFamily: `var(${headerFont})` } : {};

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <div className="text-center mb-2 shrink-0">
        <h3
          className="text-xs font-logik-extended-bold uppercase tracking-widest"
          style={{ color: 'var(--tournament-heading)', ...fontStyle }}
        >
          {title}
        </h3>
        <div
          className="h-px mt-1.5"
          style={{ background: `linear-gradient(to right, transparent, ${primaryColor}80, transparent)` }}
        />
      </div>

      <DraggableList className="flex-1 min-h-0 pb-2">
        {entries.length === 0 ? (
          <p className="text-center text-xs opacity-30 py-4">Brak danych</p>
        ) : (
          entries.map((entry, idx) => (
            <div
              key={`${entry.name}-${idx}`}
              className="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-white/[0.04] transition-colors"
            >
              <span
                className="text-[10px] font-mono opacity-35 shrink-0 w-5 text-right"
                style={{ color: 'var(--tournament-secondary-text, rgba(255,255,255,0.4))' }}
              >
                {idx + 1}
              </span>
              <span
                className="flex-1 truncate text-xs font-logik-extended-bold uppercase tracking-wide"
                style={{ color: 'var(--tournament-text, #ffffff)', ...fontStyle }}
              >
                {entry.name}
              </span>
              <span
                className="text-xs font-mono font-bold tabular-nums shrink-0"
                style={{ color: 'var(--tournament-heading)' }}
              >
                {entry.avgScore.toFixed(2)}
              </span>
            </div>
          ))
        )}
      </DraggableList>
    </div>
  );
}

// --- Exported main view ---

export function RankingsView() {
  const { theme } = useTournament();
  const { data, loading } = useRankingsData();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t            = theme as Record<string, any> | null;
  const primaryColor = (t?.primaryColor as string) || '#8B1538';
  const headerFont   = t?.headerFont   as string | undefined;

  const tables: Array<{ key: string; title: string; entries: RankingEntry[] }> = [
    { key: 'teams',        title: 'Dru\u017cyny',    entries: data?.teams           ?? [] },
    { key: 'carry',        title: 'Carry',      entries: data?.carry           ?? [] },
    { key: 'mid',          title: 'Mid',        entries: data?.mid             ?? [] },
    { key: 'offlane',      title: 'Offlane',    entries: data?.offlane         ?? [] },
    { key: 'soft-support', title: 'Soft Supp.', entries: data?.['soft-support'] ?? [] },
    { key: 'hard-support', title: 'Hard Supp.', entries: data?.['hard-support'] ?? [] },
  ];

  return (
    <div className="h-full w-full flex flex-col px-4 sm:px-8 lg:px-12 py-4 overflow-hidden">
      <div className="text-center mb-3 shrink-0">
        <h2
          className="text-4xl md:text-6xl font-logik-extended-bold uppercase tracking-tight"
          style={{
            color: (t?.titleColor as string) || 'white',
            ...(headerFont ? { fontFamily: `var(${headerFont})` } : {}),
          }}
        >
          Rankingi
        </h2>
        <div className="flex items-center justify-center gap-4 mt-1 opacity-60">
          <div
            className="h-[1px] w-12"
            style={{ background: `linear-gradient(to right, transparent, ${primaryColor})` }}
          />
          <Trophy className="w-3 h-3" style={{ color: primaryColor }} />
          <div
            className="h-[1px] w-12"
            style={{ background: `linear-gradient(to left, transparent, ${primaryColor})` }}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div
            className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2"
            style={{ borderColor: primaryColor }}
          />
        </div>
      ) : (
        <div className="flex-1 flex gap-2 sm:gap-3 min-h-0 pr-10">
          {tables.map(table => (
            <RankingTable
              key={table.key}
              title={table.title}
              entries={table.entries}
              primaryColor={primaryColor}
              headerFont={headerFont}
            />
          ))}
        </div>
      )}
    </div>
  );
}
