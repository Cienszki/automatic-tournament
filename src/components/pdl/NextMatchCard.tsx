// src/components/pdl/NextMatchCard.tsx
// Card displaying the next match info and embedded Twitch stream side by side

'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { Tv, ExternalLink, Radio, Calendar, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fadeInUp } from '@/lib/animations';
import Link from 'next/link';
import Image from 'next/image';

interface NextMatch {
  id: string;
  teamA: string;
  teamB: string;
  scheduledFor: string;
  dateLabel: string;
  teamALogo?: string;
  teamBLogo?: string;
}

interface NextMatchCardProps {
  channel: string;
  nextMatch?: NextMatch | null;
  className?: string;
}

export function NextMatchCard({
  channel,
  nextMatch,
  className
}: NextMatchCardProps) {
  const t = useTranslations('pdlHome');
  const [isLoaded, setIsLoaded] = useState(false);
  const [parentDomain, setParentDomain] = useState('localhost');

  useEffect(() => {
    // Get the parent domain for Twitch embed
    if (typeof window !== 'undefined') {
      setParentDomain(window.location.hostname);
    }
  }, []);

  return (
    <motion.div
      variants={fadeInUp}
      className={cn(
        "relative h-full flex flex-col justify-center",
        className
      )}
    >
      <div className="relative w-full">
        {/* Header - Next Match Info Floating */}
        <div className="mb-8 flex items-end justify-between border-b border-white/10 pb-4">
          <div className="flex flex-col">
            <h2 className="text-2xl font-logik-extended-bold text-white tracking-wide">
              {t('nextMatch.title')}
            </h2>
          </div>

          <div className="text-right hidden sm:block">
            <div className="text-xl font-logik-extended-bold" style={{ color: '#d32f2f' }}>{nextMatch?.teamA} vs {nextMatch?.teamB}</div>
            <div className="text-sm text-white/40 font-mono mt-1">{nextMatch?.dateLabel}</div>
          </div>
        </div>

        {/* Floating Player Frame - Offline/Logo Mode (No Background/Border) */}
        <div className="relative w-full group" style={{ paddingBottom: '56.25%' }}>
          {/* Default Offline State - PDL Logo */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Image
              src="/logos/pdl/pdl-s1-logo-transparent.png"
              alt="PDL Logo"
              fill
              priority
              className="object-contain scale-110"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </div>

          {/* Glitch Overlay on Hover (Subtle) - Kept but made very subtle for interaction feedback */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#8B1538]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        </div>


      </div>
    </motion.div>
  );
}
