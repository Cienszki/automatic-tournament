// src/components/pdl/NextMatchCard.tsx
// Card displaying the next match info

'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { fadeInUp } from '@/lib/animations';
import Image from 'next/image';
import { useTournament } from '@/context/TournamentContext';

interface NextMatch {
  id: string;
  teamA: string;
  teamB: string;
  scheduledFor: string;
  dateLabel: string;
  teamALogo?: string;
  teamBLogo?: string;
}

interface NextMatchCardProps {
  nextMatch?: NextMatch | null;
  className?: string;
}

export function NextMatchCard({
  nextMatch,
  className
}: NextMatchCardProps) {
  const t = useTranslations('pdlHome');
  const { theme, tournament } = useTournament();
  const primaryColor = theme?.primaryColor || '#8B1538';

  return (
    <motion.div
      variants={fadeInUp}
      className={cn(
        "relative h-full flex flex-col justify-center",
        className
      )}
    >
      <div className="relative w-full">
        {/* Header */}
        <div className="mb-6 flex items-end justify-between border-b border-white/10 pb-3">
          <h2 className="text-xl font-logik-extended-bold text-white tracking-wide">
            {nextMatch ? t('nextMatch.title') : 'Wyróżniony Mecz'}
          </h2>
          {nextMatch && (
            <div className="text-right hidden sm:block">
              <div
                className="text-lg font-logik-extended-bold"
                style={{ color: primaryColor }}
              >
                {nextMatch.teamA} vs {nextMatch.teamB}
              </div>
              <div className="text-xs text-white/40 font-mono mt-1">{nextMatch.dateLabel}</div>
            </div>
          )}
        </div>

        {/* Logo area */}
        <div className="relative w-full group" style={{ paddingBottom: '56.25%' }}>
          <div className="absolute inset-0 flex items-center justify-center">
            {theme?.logoUrl ? (
              <Image
                src={theme.logoUrl}
                alt={tournament?.name || ''}
                fill
                priority
                className="object-contain scale-110"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            ) : (
              <div
                className="w-32 h-32 rounded-full blur-3xl opacity-30"
                style={{ background: primaryColor }}
              />
            )}
          </div>
          <div
            className="absolute inset-0 bg-gradient-to-t to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{ backgroundImage: `linear-gradient(to top, ${primaryColor}15, transparent)` }}
          />
        </div>
      </div>
    </motion.div>
  );
}
