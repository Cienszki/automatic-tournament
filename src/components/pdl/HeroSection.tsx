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
import { organizationConfig } from '@/config/organization';

interface HeroSectionProps {
  isTeamCaptain?: boolean;
}

export function HeroSection({
  isTeamCaptain = false
}: HeroSectionProps) {
  const t = useTranslations('pdlHome');
  const { getTournamentPath, tournament } = useTournament();

  return (
    <motion.div
      className="relative h-full min-h-[400px] lg:min-h-[500px] 2xl:min-h-[700px] flex items-center"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <div className="relative z-10 w-full max-w-4xl">
        <motion.div variants={fadeInUp}>
          {/* Headline and Promotional Text */}
          <div className="mb-6">
            <motion.h1
              className="text-3xl md:text-5xl lg:text-6xl font-logik-extended-bold mb-4 leading-[0.9] tracking-tight"
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
              className="text-base md:text-lg text-white/60 leading-relaxed max-w-lg font-medium border-l-4 border-[#8B1538] pl-6 ml-1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              {t('hero.subtitle')}
            </motion.p>
          </div>

          {/* CTA Buttons - Freestanding */}
          <motion.div
            className="flex flex-col sm:flex-row gap-4 mt-8"
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
                  "inline-flex items-center justify-center gap-3 px-8 py-4 rounded-none font-logik-extended-bold text-lg uppercase tracking-widest",
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
                    <Trophy className="h-5 w-5 relative z-10" />
                    <span className="relative z-10">{t('hero.ctaMyTeam')}</span>
                  </>
                ) : (
                  <>
                    <Users className="h-5 w-5 relative z-10" />
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
                href={tournament?.discordUrl || organizationConfig.defaults.discord}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex items-center justify-center gap-3 px-8 py-4 font-logik-extended-bold text-lg uppercase tracking-widest",
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
                  width={20}
                  height={20}
                  priority
                  className="relative z-10 w-5 h-5 object-contain opacity-60 group-hover:opacity-100 transition-opacity"
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
