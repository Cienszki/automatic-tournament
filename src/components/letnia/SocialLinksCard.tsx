// src/components/letnia/SocialLinksCard.tsx
// Social links card for Letnia home page

'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { MessageCircle, Tv, ExternalLink } from 'lucide-react';
import { fadeInUp } from '@/lib/animations';
import { useTournament } from '@/context/TournamentContext';

interface SocialLinksCardProps {
  discordUrl?: string;
  twitchUrl?: string;
}

export function LetniaSocialLinksCard({
  discordUrl = 'https://discord.gg/',
  twitchUrl = 'https://twitch.tv/'
}: SocialLinksCardProps) {
  const t = useTranslations('letniaHome.social');
  const { theme } = useTournament();

  return (
    <motion.div
      variants={fadeInUp}
      className="rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
        <MessageCircle className="h-4 w-4" style={{ color: theme.primaryColor }} />
        <h3 className="font-bold text-sm">{t('title')}</h3>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Discord */}
        <motion.a
          href={discordUrl}
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center justify-between px-4 py-2.5 rounded-lg font-medium text-sm bg-[#5865F2] text-white transition-all duration-200 hover:bg-[#4752C4]"
        >
          <span className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            {t('discord')}
          </span>
          <ExternalLink className="h-4 w-4 opacity-70" />
        </motion.a>

        {/* Twitch */}
        <motion.a
          href={twitchUrl}
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center justify-between px-4 py-2.5 rounded-lg font-medium text-sm text-white transition-all duration-200"
          style={{ 
            background: '#6441a5',
          }}
        >
          <span className="flex items-center gap-2">
            <Tv className="h-4 w-4" />
            {t('twitch')}
          </span>
          <ExternalLink className="h-4 w-4 opacity-70" />
        </motion.a>

        {/* Note */}
        <div className="pt-2 text-xs text-muted-foreground text-center">
          {t('note')}
        </div>
      </div>
    </motion.div>
  );
}
