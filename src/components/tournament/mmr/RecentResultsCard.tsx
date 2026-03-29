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

export function MmrRecentResultsCard({ items, hrefAll }: RecentResultsCardProps) {
  const t = useTranslations('mmrHome.recentResults');
  const tCommon = useTranslations('mmrHome.common');
  const { theme } = useTournament();

  return (
    <motion.div
      variants={fadeInUp}
      className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4" style={{ color: theme.primaryColor }} />
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
              className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 text-sm"
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
