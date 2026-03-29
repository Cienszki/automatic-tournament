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

export function MmrUpcomingMatchesCard({ items, hrefAll }: UpcomingMatchesCardProps) {
  const t = useTranslations('mmrHome.upcoming');
  const tCommon = useTranslations('mmrHome.common');
  const { theme } = useTournament();

  return (
    <motion.div
      variants={fadeInUp}
      className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" style={{ color: theme.secondaryColor }} />
          <h3 className="font-logik-extended-bold text-sm text-white">{t('title')}</h3>
        </div>
        {hrefAll && (
          <Link 
            href={hrefAll}
            className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1 transition-colors"
          >
            {tCommon('viewAll')}
            <ChevronRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      <div className="p-3 space-y-2">
        {items.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            {t('empty')}
          </div>
        ) : (
          items.map((item) => (
            <div 
              key={item.id}
              className="p-2 rounded-lg bg-white/5 border border-white/5 text-sm"
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
