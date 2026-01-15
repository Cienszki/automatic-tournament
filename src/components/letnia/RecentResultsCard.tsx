// src/components/letnia/RecentResultsCard.tsx
// Recent match results card for Letnia home page

'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Trophy, ChevronRight } from 'lucide-react';
import { fadeInUp } from '@/lib/animations';
import { useTournament } from '@/context/TournamentContext';

export interface RecentResultItem {
  id: string;
  team1: string;
  team2: string;
  score1: number;
  score2: number;
  playedAtLabel: string;
}

interface RecentResultsCardProps {
  items: RecentResultItem[];
  hrefAll?: string;
}

export function LetniaRecentResultsCard({ items, hrefAll }: RecentResultsCardProps) {
  const t = useTranslations('letniaHome.recentResults');
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
          <Trophy className="h-4 w-4" style={{ color: theme.primaryColor }} />
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
              className="flex items-center justify-between p-2 rounded-lg bg-background/30 text-sm"
            >
              <div className="flex-1 text-right truncate pr-2">
                <span className={item.score1 > item.score2 ? 'font-medium' : 'text-muted-foreground'}>
                  {item.team1}
                </span>
              </div>
              <div 
                className="px-3 py-1 rounded font-bold text-xs min-w-[60px] text-center"
                style={{
                  background: `${theme.primaryColor}20`,
                  color: theme.primaryColor
                }}
              >
                {item.score1} - {item.score2}
              </div>
              <div className="flex-1 truncate pl-2">
                <span className={item.score2 > item.score1 ? 'font-medium' : 'text-muted-foreground'}>
                  {item.team2}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
