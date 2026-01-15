// src/components/letnia/UpcomingMatchesCard.tsx
// Upcoming matches card for Letnia home page

'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Calendar, ChevronRight } from 'lucide-react';
import { fadeInUp } from '@/lib/animations';
import { useTournament } from '@/context/TournamentContext';

export interface UpcomingMatchItem {
  id: string;
  team1: string;
  team2: string;
  whenLabel: string;
}

interface UpcomingMatchesCardProps {
  items: UpcomingMatchItem[];
  hrefAll?: string;
}

export function LetniaUpcomingMatchesCard({ items, hrefAll }: UpcomingMatchesCardProps) {
  const t = useTranslations('letniaHome.upcoming');
  const tCommon = useTranslations('letniaHome.common');
  const { theme, getTournamentPath } = useTournament();

  return (
    <motion.div
      variants={fadeInUp}
      className="rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" style={{ color: theme.secondaryColor }} />
          <h3 className="font-bold text-sm">{t('title')}</h3>
        </div>
        {hrefAll && (
          <Link 
            href={hrefAll}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            {tCommon('viewAll')}
            <ChevronRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        {items.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            {t('empty')}
          </div>
        ) : (
          items.map((item) => (
            <div 
              key={item.id}
              className="p-2 rounded-lg bg-background/30 text-sm"
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="font-medium">{item.team1}</span>
                <span 
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ 
                    background: `${theme.secondaryColor}20`,
                    color: theme.secondaryColor 
                  }}
                >
                  {tCommon('vs')}
                </span>
                <span className="font-medium">{item.team2}</span>
              </div>
              <div className="text-center text-xs text-muted-foreground">
                {item.whenLabel}
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
