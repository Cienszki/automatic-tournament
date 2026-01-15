// src/components/pdl/TwitchEmbed.tsx
// Embedded Twitch stream player

'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Tv, ExternalLink, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fadeInUp } from '@/lib/animations';
import Link from 'next/link';

interface TwitchEmbedProps {
  channel: string;
  className?: string;
}

export function TwitchEmbed({ channel, className }: TwitchEmbedProps) {
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
      initial="hidden"
      animate="visible"
      className={cn(
        "relative rounded-2xl overflow-hidden",
        "bg-gradient-to-br from-[#1a1a1f] via-[#1e1e24] to-[#16161a]",
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

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a32] bg-gradient-to-r from-[#6441a5]/20 to-transparent">
          <div className="flex items-center gap-3">
            <motion.div
              className="p-2 rounded-lg bg-[#6441a5]/30"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Tv className="h-5 w-5 text-[#9146FF]" />
            </motion.div>
            <div>
              <h3 className="font-bold text-white">Transmisja Live</h3>
              <div className="flex items-center gap-2 text-sm text-[#808090]">
                <motion.div
                  className="w-2 h-2 rounded-full bg-red-500"
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span>polishdota2inhouse</span>
              </div>
            </div>
          </div>
          <Link
            href={`https://www.twitch.tv/${channel}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#6441a5] hover:bg-[#7B52D5] transition-colors text-sm font-medium text-white"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline">Otwórz na Twitchu</span>
          </Link>
        </div>

        {/* Stream Container */}
        <div className="relative aspect-video bg-[#0e0e10]">
          {/* Loading placeholder */}
          {!isLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0e0e10]">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Radio className="h-12 w-12 text-[#6441a5]" />
              </motion.div>
              <p className="mt-4 text-[#808090]">Ładowanie transmisji...</p>
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

        {/* Footer with chat link */}
        <div className="p-3 bg-gradient-to-r from-[#1a1a1f] to-[#1e1e24] border-t border-[#2a2a32]">
          <div className="flex items-center justify-between text-sm text-[#808090]">
            <span>Oglądaj mecze Polish Dota League na żywo!</span>
            <Link
              href={`https://www.twitch.tv/popout/${channel}/chat`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Otwórz chat →
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
