// src/components/pdl/HeroSection.tsx
// Hero section for PDL home page with promotional content and CTA buttons

'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Users, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { useTournament } from '@/context/TournamentContext';

interface HeroSectionProps {
  isTeamCaptain?: boolean;
}

export function HeroSection({
  isTeamCaptain = false
}: HeroSectionProps) {
  const t = useTranslations('pdlHome');
  const { getTournamentPath } = useTournament();

  return (
    <motion.div
      className="relative h-full min-h-[600px] flex items-center"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <div className="relative z-10 w-full max-w-4xl">
        <motion.div variants={fadeInUp}>
          {/* Headline and Promotional Text */}
          <div className="mb-8">
            <motion.h1
              className="text-4xl md:text-6xl lg:text-7xl font-logik-extended-bold mb-6 leading-[0.9] tracking-tight"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <span className="text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                {t('hero.title')}
              </span>
            </motion.h1>

            {/* Promotional text */}
            <motion.p
              className="text-lg md:text-xl text-white/60 leading-relaxed max-w-lg font-medium border-l-4 border-[#8B1538] pl-6 ml-1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              {t('hero.subtitle')}
            </motion.p>
          </div>

          {/* CTA Buttons - Freestanding */}
          <motion.div
            className="flex flex-col sm:flex-row gap-6 mt-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            {/* Register Team Button */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link
                href={getTournamentPath(isTeamCaptain ? '/my-team' : '/register')}
                className={cn(
                  "inline-flex items-center justify-center gap-4 px-10 py-5 rounded-none font-logik-extended-bold text-xl uppercase tracking-widest",
                  "bg-[#8B1538] text-white",
                  "hover:bg-[#a01840]",
                  "transition-all duration-300 relative overflow-hidden group clip-path-slant"
                )}
                style={{
                  clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'
                }}
              >
                {/* Shine effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                />

                {isTeamCaptain ? (
                  <>
                    <Trophy className="h-6 w-6 relative z-10" />
                    <span className="relative z-10">{t('hero.ctaMyTeam')}</span>
                  </>
                ) : (
                  <>
                    <Users className="h-6 w-6 relative z-10" />
                    <span className="relative z-10">{t('hero.ctaRegister')}</span>
                  </>
                )}
              </Link>
            </motion.div>

            {/* Discord Button */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link
                href="https://discord.gg/pd2ih"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex items-center justify-center gap-4 px-10 py-5 font-logik-extended-bold text-xl uppercase tracking-widest",
                  "bg-transparent text-white border border-white/10",
                  "hover:border-[#5865F2] hover:text-[#5865F2] hover:bg-[#5865F2]/5",
                  "transition-all duration-300 relative overflow-hidden group"
                )}
                style={{
                  clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'
                }}
              >
                <Image
                  src="/logos/pd2ih/dc-icon.png"
                  alt="Discord"
                  width={24}
                  height={24}
                  className="relative z-10 w-6 h-6 object-contain opacity-60 group-hover:opacity-100 transition-opacity"
                />
                <span className="relative z-10">{t('hero.ctaDiscord')}</span>
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div >
  );
}
