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

interface NextMatchCardProps {
  channel: string;
  className?: string;
}

export function NextMatchCard({
  channel,
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

      <div className="relative h-full flex flex-col">
        {/* Two column layout: Match Info + Twitch */}
        <div className="grid grid-cols-2 gap-4 p-4 flex-1">
          {/* Left: Next Match Info */}
          <div className="flex flex-col justify-center gap-6">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Calendar className="h-5 w-5 text-[#8B1538]" />
                <h3 className="text-xl font-bold text-white">{t('nextMatch.title')}</h3>
              </div>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-base text-[#a0a0a0]">
                  <Clock className="h-4 w-4" />
                  <span>25.01.2026 • 19:00 CET</span>
                </div>
                <div className="text-base text-[#808090]">
                  BO3, Captains Mode
                </div>
              </div>

              <div className="text-lg font-medium text-white/90">
                <div className="flex items-center gap-3">
                  <span className="text-white font-bold">Team Alpha</span>
                  <span className="text-[#8B1538] text-xl">vs</span>
                  <span className="text-white font-bold">Team Beta</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Twitch Stream */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-3">
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
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="relative flex-1 bg-[#0e0e10] rounded-lg overflow-hidden">
              {/* Loading placeholder */}
              {!isLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0e0e10]">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Radio className="h-6 w-6 text-[#6441a5]" />
                  </motion.div>
                  <p className="mt-2 text-xs text-[#808090]">Ładowanie...</p>
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
