// src/components/pdl/RecentResultsCard.tsx

'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Clock, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fadeInUp } from '@/lib/animations';

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
  hrefAll: string;
  className?: string;
}

export function RecentResultsCard({ items, hrefAll, className }: RecentResultsCardProps) {
  const t = useTranslations('pdlHome');

  return (
    <motion.div
      variants={fadeInUp}
      className={cn(
        'relative rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm p-5',
        className
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[#8B1538] via-[#cbcccc] to-transparent opacity-60" />

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold">{t('recentResults.title')}</h3>
        <Link
          href={hrefAll}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          {t('common.viewAll')}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="space-y-3">
        {items.slice(0, 5).map((m) => {
          const winner1 = m.score1 > m.score2;
          const winner2 = m.score2 > m.score1;

          return (
            <div
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-white/5 transition-colors"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  <span className={cn(winner1 && 'text-foreground', !winner1 && 'text-muted-foreground')}>
                    {m.team1}
                  </span>
                  <span className="text-muted-foreground"> {t('common.vs')} </span>
                  <span className={cn(winner2 && 'text-foreground', !winner2 && 'text-muted-foreground')}>
                    {m.team2}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{m.playedAtLabel}</span>
                </div>
              </div>

              <div className="text-sm font-bold tabular-nums">
                <span className={cn(winner1 && 'text-foreground', !winner1 && 'text-muted-foreground')}>
                  {m.score1}
                </span>
                <span className="text-muted-foreground">:</span>
                <span className={cn(winner2 && 'text-foreground', !winner2 && 'text-muted-foreground')}>
                  {m.score2}
                </span>
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="text-sm text-muted-foreground">{t('recentResults.empty')}</div>
        )}
      </div>
    </motion.div>
  );
}
