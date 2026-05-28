// src/components/divisions/InlineDivisionView.tsx
// Inline division detail view rendered inside the main page Groups section.

'use client';

import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTournament, useTournamentType } from '@/context/TournamentContext';
import { useDivisionData } from '@/hooks/useDivisionData';
import { DivisionStandingsTable } from '@/components/divisions/DivisionStandingsTable';
import { FixtureCrossbox } from '@/components/divisions/FixtureCrossbox';
import { getDivisionTheme } from '@/lib/division-themes';

interface InlineDivisionViewProps {
  divisionId: string;
  onBack: () => void;
}

export function InlineDivisionView({ divisionId, onBack }: InlineDivisionViewProps) {
  const { theme } = useTournament();
  const { isMmrLimited } = useTournamentType();
  const { divisionInfo, standings, matches, loading, error } = useDivisionData(divisionId);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: theme?.primaryColor }} />
      </div>
    );
  }

  if (error || !divisionInfo) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="font-logik text-lg" style={{ color: 'var(--tournament-muted)' }}>
          {error ?? (isMmrLimited ? 'Nie znaleziono grupy.' : 'Nie znaleziono dywizji.')}
        </p>
      </div>
    );
  }

  const divisionColor = divisionInfo.color || theme?.primaryColor || '#888';
  const isElite = divisionInfo.tier === 1;
  const isLowest = divisionInfo.tier === 3;

  const themeData = getDivisionTheme(divisionInfo.theme);
  const displayColor = themeData?.primaryColor || divisionColor;

  return (
    <motion.div
      key={divisionId}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="h-full flex flex-col overflow-hidden"
    >
      {/* Hero section */}
      <div className="flex-shrink-0 relative px-4 sm:px-8 lg:px-16 pt-5 pb-5 overflow-hidden">
        {/* Atmospheric glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 55% 130% at 20% 60%, ${displayColor}22 0%, transparent 70%)`,
          }}
        />

        {/* Back button */}
        <button
          onClick={onBack}
          className={cn(
            'inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em]',
            'transition-all opacity-40 hover:opacity-80 mb-4',
          )}
          style={{ color: 'var(--tournament-secondary-text)' }}
        >
          <ArrowLeft className="w-3 h-3" />
          Wszystkie {isMmrLimited ? 'grupy' : 'dywizje'}
        </button>

        {/* Division identity */}
        <div className="flex items-center gap-5">
          {divisionInfo.medalUrl && (
            <img
              src={divisionInfo.medalUrl}
              alt={divisionInfo.name}
              className="w-14 h-14 object-contain shrink-0"
              style={{ filter: `drop-shadow(0 0 10px ${displayColor}60)` }}
            />
          )}
          <div className="flex flex-col">
            <h2
              className="text-3xl sm:text-4xl font-logik-extended-bold uppercase leading-none tracking-wide"
              style={{
                color: displayColor,
                textShadow: `0 0 40px ${displayColor}50, 0 2px 20px ${displayColor}30`,
              }}
            >
              {divisionInfo.name}
            </h2>
            {divisionInfo.matchday && (
              <span
                className="mt-2 text-[10px] font-mono uppercase tracking-[0.3em]"
                style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.35)' }}
              >
                {divisionInfo.matchday}
              </span>
            )}
          </div>
        </div>

        {/* Decorative bottom rule */}
        <div
          className="absolute bottom-0 left-4 sm:left-8 lg:left-16 right-0 h-px"
          style={{ background: `linear-gradient(90deg, ${displayColor}60 0%, transparent 55%)` }}
        />
      </div>

      {/* Content: standings + fixture crossbox side by side */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 lg:px-16 pb-4 pt-5">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          <DivisionStandingsTable
            standings={standings}
            divisionColor={displayColor}
            divisionName={divisionInfo.name}
            currentRound={divisionInfo.currentRound}
            matchday={divisionInfo.matchday}
            isElite={isElite}
            isLowest={isLowest}
            theme={theme}
            highlights={divisionInfo.highlights}
          />
          <FixtureCrossbox
            matches={matches}
            standings={standings}
            divisionColor={divisionColor}
            divisionTier={divisionInfo.tier}
            theme={theme}
            divisionTheme={divisionInfo.theme}
          />
        </div>
      </div>
    </motion.div>
  );
}

