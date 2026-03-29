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

export function MmrTournamentFormatCard({
  groupsLabel,
  teamsPerGroupLabel,
  playoffsTeamsLabel,
  playoffsFormatLabel
}: TournamentFormatCardProps) {
  const t = useTranslations('mmrHome.format');
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
      className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
        <Info className="h-4 w-4" style={{ color: theme.secondaryColor }} />
        <h3 className="font-logik-extended-bold text-sm text-white">{t('title')}</h3>
      </div>

      <div className="p-4 space-y-3">
        {items.map((item, idx) => (
          <div 
            key={idx} 
            className="flex items-center justify-between text-sm text-white/60"
          >
            <span>{item.label}</span>
            <span 
              className="font-medium"
              style={{ color: theme.primaryColor }}
            >
              {item.value}
            </span>
          </div>
        ))}
        
        <div className="pt-3 mt-3 border-t border-white/10 text-xs text-white/30">
          {t('note')}
        </div>
      </div>
    </motion.div>
  );
}
