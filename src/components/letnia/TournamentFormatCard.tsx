// src/components/letnia/TournamentFormatCard.tsx
// Tournament format info card for Letnia home page

'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Info } from 'lucide-react';
import { fadeInUp } from '@/lib/animations';
import { useTournament } from '@/context/TournamentContext';

interface TournamentFormatCardProps {
  groupsLabel: string;
  teamsPerGroupLabel: string;
  playoffsTeamsLabel: string;
  playoffsFormatLabel: string;
}

export function TournamentFormatCard({
  groupsLabel,
  teamsPerGroupLabel,
  playoffsTeamsLabel,
  playoffsFormatLabel
}: TournamentFormatCardProps) {
  const t = useTranslations('letniaHome.format');
  const { theme } = useTournament();

  const items = [
    { label: t('groups'), value: groupsLabel },
    { label: t('teamsPerGroup'), value: teamsPerGroupLabel },
    { label: t('playoffsTeams'), value: playoffsTeamsLabel },
    { label: t('playoffsFormat'), value: playoffsFormatLabel }
  ];

  return (
    <motion.div
      variants={fadeInUp}
      className="rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
        <Info className="h-4 w-4" style={{ color: theme.secondaryColor }} />
        <h3 className="font-bold text-sm">{t('title')}</h3>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {items.map((item, idx) => (
          <div 
            key={idx} 
            className="flex items-center justify-between text-sm"
          >
            <span className="text-muted-foreground">{item.label}</span>
            <span 
              className="font-medium"
              style={{ color: theme.primaryColor }}
            >
              {item.value}
            </span>
          </div>
        ))}
        
        {/* Note */}
        <div 
          className="pt-3 mt-3 border-t border-border/30 text-xs text-muted-foreground"
        >
          {t('note')}
        </div>
      </div>
    </motion.div>
  );
}
