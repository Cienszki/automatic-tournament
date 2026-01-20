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

interface NextMatch {
  id: string;
  teamA: string;
  teamB: string;
  scheduledFor: string;
  dateLabel: string;
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
        "relative rounded-2xl overflow-hidden h-full",
        "bg-gradient-to-br from-[#1e1e24] to-[#16161a]",
        "border border-[#2a2a32]",
        "shadow-2xl shadow-black/50",
        className
      )}
    >
      {/* Animated glow effect */}
      <motion.div
        className="absolute -inset-1 bg-gradient-to-r from-[#6441a5]/20 via-[#9146FF]/20 to-[#6441a5]/20 rounded-2xl blur-xl opacity-40"
        animate={{
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      <div className="relative h-full flex flex-col p-6">
        {/* Next Match Info - Above Twitch */}
        <div className="text-center mb-6">
          {nextMatch ? (
            <>
              <div className="text-xl font-bold text-white mb-3">
                <span className="text-white">{nextMatch.teamA}</span>
                <span className="text-[#8B1538] mx-3">vs</span>
                <span className="text-white">{nextMatch.teamB}</span>
              </div>
              
              <div className="inline-flex items-center gap-2 text-sm text-[#a0a0a0]">
                <Clock className="h-4 w-4" />
                <span>{nextMatch.dateLabel}</span>
              </div>
            </>
          ) : (
            <>
              <div className="text-lg font-bold text-[#a0a0a0] mb-2">
                Brak zaplanowanych meczów
              </div>
              <div className="text-sm text-[#808090]">
                Sprawdź ponownie później
              </div>
            </>
          )}
        </div>

        {/* Centered Twitch Stream with 16:9 aspect ratio */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-4xl">
            {/* Live indicator and external link */}
            <div className="flex items-center justify-between mb-3 px-2">
              <div className="flex items-center gap-2 text-sm text-[#d4d4d4]">
                <motion.div
                  className="w-2.5 h-2.5 rounded-full bg-red-500"
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span className="font-medium">Transmisja Live</span>
              </div>
              <Link
                href={`https://www.twitch.tv/${channel}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#808090] hover:text-white transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>

            {/* 16:9 aspect ratio container */}
            <div className="relative w-full bg-[#0e0e10] rounded-lg overflow-hidden" style={{ paddingBottom: '56.25%' }}>
              {/* Loading placeholder */}
              {!isLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0e0e10]">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Radio className="h-8 w-8 text-[#6441a5]" />
                  </motion.div>
                  <p className="mt-3 text-sm text-[#808090]">Ładowanie...</p>
                </div>
              )}
              
              {/* Twitch Embed iframe */}
              <iframe
                src={`https://player.twitch.tv/?channel=${channel}&parent=${parentDomain}&muted=true`}
                className={cn(
                  "absolute inset-0 w-full h-full transition-opacity duration-500",
                  isLoaded ? "opacity-100" : "opacity-0"
                )}
                allowFullScreen
                onLoad={() => setIsLoaded(true)}
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
