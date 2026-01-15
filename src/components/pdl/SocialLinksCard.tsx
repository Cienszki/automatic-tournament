// src/components/pdl/SocialLinksCard.tsx

'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { MessageCircle, Tv } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fadeInUp } from '@/lib/animations';

interface SocialLinksCardProps {
  discordUrl: string;
  twitchUrl: string;
  className?: string;
}

export function SocialLinksCard({ discordUrl, twitchUrl, className }: SocialLinksCardProps) {
  const t = useTranslations('pdlHome');

  return (
    <motion.div
      variants={fadeInUp}
      className={cn('relative rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm p-5', className)}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[#8B1538] via-[#cbcccc] to-transparent opacity-60" />

      <h3 className="text-base font-bold mb-4">{t('social.title')}</h3>

      <div className="grid grid-cols-1 gap-3">
        <Link
          href={discordUrl}
          target="_blank"
          rel="noreferrer"
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-bold transition-all',
            'border border-border/60 bg-card/40 text-foreground hover:bg-card/60 hover:ring-1 hover:ring-primary/25'
          )}
        >
          <MessageCircle className="h-4 w-4" />
          {t('social.discord')}
        </Link>

        <Link
          href={twitchUrl}
          target="_blank"
          rel="noreferrer"
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-bold transition-all',
            'text-white'
          )}
          style={{ background: '#6441a5' }}
        >
          <Tv className="h-4 w-4" />
          {t('social.twitch')}
        </Link>
      </div>

      <p className="text-xs text-muted-foreground mt-4">{t('social.note')}</p>
    </motion.div>
  );
}
