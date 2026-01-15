// src/components/pdl/LeagueFormatCard.tsx

'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Trophy, ArrowUpDown, CalendarDays, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fadeInUp } from '@/lib/animations';

interface LeagueFormatCardProps {
  seasonLabel: string;
  seriesFormatLabel: string;
  divisionsLabel: string;
  matchdayLabel: string;
  className?: string;
}

export function LeagueFormatCard({
  seasonLabel,
  seriesFormatLabel,
  divisionsLabel,
  matchdayLabel,
  className
}: LeagueFormatCardProps) {
  const t = useTranslations('pdlHome');

  return (
    <motion.div
      variants={fadeInUp}
      className={cn('relative rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm p-5', className)}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[#8B1538] via-[#cbcccc] to-transparent opacity-60" />

      <h3 className="text-base font-bold mb-4">{t('format.title')}</h3>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Trophy className="h-4 w-4 text-[#8B1538]" />
          <span className="text-muted-foreground">{t('format.season')}</span>
          <span className="ml-auto font-medium">{seasonLabel}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <ArrowUpDown className="h-4 w-4 text-[#8B1538]" />
          <span className="text-muted-foreground">{t('format.series')}</span>
          <span className="ml-auto font-medium">{seriesFormatLabel}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Layers className="h-4 w-4 text-[#8B1538]" />
          <span className="text-muted-foreground">{t('format.divisions')}</span>
          <span className="ml-auto font-medium">{divisionsLabel}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <CalendarDays className="h-4 w-4 text-[#8B1538]" />
          <span className="text-muted-foreground">{t('format.matchday')}</span>
          <span className="ml-auto font-medium">{matchdayLabel}</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        {t('format.note')}
      </p>
    </motion.div>
  );
}
