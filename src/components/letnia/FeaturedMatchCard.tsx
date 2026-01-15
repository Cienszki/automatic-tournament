// src/components/letnia/FeaturedMatchCard.tsx
// Featured match card for Letnia home page

'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Flame, ExternalLink } from 'lucide-react';
import { fadeInUp } from '@/lib/animations';
import { useTournament } from '@/context/TournamentContext';
import { cn } from '@/lib/utils';

interface FeaturedMatchCardProps {
  date?: string;
  time?: string;
  format?: string;
  matchLabel?: string;
  team1?: string;
  team2?: string;
  streamUrl?: string;
}

export function FeaturedMatchCard({
  date,
  time,
  format,
  matchLabel,
  team1,
  team2,
  streamUrl
}: FeaturedMatchCardProps) {
  const t = useTranslations('letniaHome');
  const tCommon = useTranslations('letniaHome.common');
  const { theme, getTournamentPath } = useTournament();

  const hasMatch = team1 && team2;

  return (
    <motion.div
      variants={fadeInUp}
      className="relative overflow-hidden rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm h-full flex flex-col"
    >
      {/* Neon glow effect */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          background: `radial-gradient(ellipse at top right, ${theme.primaryColor}40 0%, transparent 60%)`
        }}
      />

      {/* Header */}
      <div className="relative px-4 py-3 border-b border-border/30 flex items-center gap-2">
        <Flame className="h-5 w-5" style={{ color: theme.primaryColor }} />
        <h3 className="font-bold text-lg">{t('nextMatch.title')}</h3>
      </div>

      {/* Content */}
      <div className="relative flex-grow p-4 flex flex-col justify-center">
        {hasMatch ? (
          <>
            {/* Match label */}
            {matchLabel && (
              <div 
                className="text-xs font-medium mb-3 text-center"
                style={{ color: theme.secondaryColor }}
              >
                {matchLabel}
              </div>
            )}

            {/* Teams */}
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="text-right flex-1">
                <div 
                  className="font-bold text-lg"
                  style={{ textShadow: `0 0 10px ${theme.primaryColor}40` }}
                >
                  {team1}
                </div>
              </div>
              
              <div 
                className="px-3 py-1 rounded-full text-sm font-bold"
                style={{ 
                  background: `${theme.primaryColor}20`,
                  color: theme.primaryColor,
                  boxShadow: `0 0 10px ${theme.primaryColor}30`
                }}
              >
                {tCommon('vs')}
              </div>
              
              <div className="text-left flex-1">
                <div 
                  className="font-bold text-lg"
                  style={{ textShadow: `0 0 10px ${theme.secondaryColor}40` }}
                >
                  {team2}
                </div>
              </div>
            </div>

            {/* Date/Time/Format */}
            <div className="text-center text-sm text-muted-foreground mb-4">
              {date && <span>{date}</span>}
              {time && <span> • {time}</span>}
              {format && <span className="block mt-1 text-xs">{format}</span>}
            </div>

            {/* Stream Button */}
            {streamUrl && (
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link
                  href={streamUrl}
                  className={cn(
                    "flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium w-full",
                    "transition-all duration-300"
                  )}
                  style={{
                    background: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
                    boxShadow: `0 0 15px ${theme.primaryColor}50`
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                  {t('nextMatch.watchStream')}
                </Link>
              </motion.div>
            )}
          </>
        ) : (
          <div className="text-center py-6">
            <p className="text-muted-foreground">{t('nextMatch.noMatches')}</p>
            <Link
              href={getTournamentPath('/schedule')}
              className="text-sm mt-2 inline-block hover:underline"
              style={{ color: theme.primaryColor }}
            >
              {t.rich('common.viewAll', { default: 'Zobacz terminarz' })}
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  );
}
