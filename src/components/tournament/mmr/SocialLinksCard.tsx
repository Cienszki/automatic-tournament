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

export function MmrSocialLinksCard({
  discordUrl,
  twitchUrl
}: SocialLinksCardProps) {
  const t = useTranslations('mmrHome.social');
  const { theme } = useTournament();

  if (!discordUrl && !twitchUrl) return null;

  return (
    <motion.div
      variants={fadeInUp}
      className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
        <MessageCircle className="h-4 w-4" style={{ color: theme.primaryColor }} />
        <h3 className="font-logik-extended-bold text-sm text-white">{t('title')}</h3>
      </div>

      <div className="p-4 space-y-3">
        {discordUrl && (
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
        )}

        {twitchUrl && (
          <motion.a
            href={twitchUrl}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center justify-between px-4 py-2.5 rounded-lg font-medium text-sm text-white transition-all duration-200"
            style={{ background: '#6441a5' }}
          >
            <span className="flex items-center gap-2">
              <Tv className="h-4 w-4" />
              {t('twitch')}
            </span>
            <ExternalLink className="h-4 w-4 opacity-70" />
          </motion.a>
        )}

        <div className="pt-2 text-xs text-muted-foreground text-center">
          {t('note')}
        </div>
      </div>
    </motion.div>
  );
}
