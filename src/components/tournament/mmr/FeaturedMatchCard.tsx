'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { fadeInUp } from '@/lib/animations';
import { useTournament } from '@/context/TournamentContext';

interface FeaturedMatchCardProps {
  date?: string;
  matchLabel?: string;
  team1?: string;
  team2?: string;
}

export function MmrFeaturedMatchCard({
  date,
  matchLabel,
  team1,
  team2,
}: FeaturedMatchCardProps) {
  const { theme, tournament } = useTournament();

  const hasMatch = team1 && team2;

  return (
    <motion.div
      variants={fadeInUp}
      className="relative h-full flex flex-col justify-center"
    >
      <div className="relative w-full">
        {/* Header row — match info or tournament title */}
        <div className="mb-6 flex items-end justify-between border-b border-white/10 pb-3">
          <h2 className="text-xl font-logik-extended-bold text-[var(--tournament-section-header)] tracking-wide">
            Następny Mecz
          </h2>
          {hasMatch && (
            <div className="text-right hidden sm:block">
              <div
                className="text-lg font-logik-extended-bold"
                style={{ color: theme?.primaryColor || '#8B1538' }}
              >
                {team1} vs {team2}
              </div>
              {(matchLabel || date) && (
                <div className="text-xs text-[var(--tournament-muted)] font-mono mt-1">
                  {matchLabel}{matchLabel && date ? ' · ' : ''}{date}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Logo area — 16:9 aspect ratio, frameless, like PDL */}
        <div className="relative w-full group" style={{ paddingBottom: '56.25%' }}>
          <div className="absolute inset-0 flex items-center justify-center">
            {theme?.logoUrl ? (
              <Image
                src={theme.logoUrl}
                alt={tournament?.name || ''}
                fill
                priority
                className="object-contain scale-105"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            ) : (
              /* Fallback glow placeholder when no logo */
              <div
                className="w-32 h-32 rounded-full blur-3xl opacity-30"
                style={{ background: theme?.primaryColor || '#8B1538' }}
              />
            )}
          </div>
          <div
            className="absolute inset-0 bg-gradient-to-t to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{ backgroundImage: `linear-gradient(to top, ${theme?.primaryColor || '#8B1538'}15, transparent)` }}
          />
        </div>
      </div>
    </motion.div>
  );
}
