// src/components/pdl/HeroSection.tsx
// Hero section for PDL home page with promotional content and CTA buttons

'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Users, Trophy, MessageCircle } from 'lucide-react';
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
      className="relative overflow-hidden rounded-2xl border border-[#8B1538]/30 bg-gradient-to-br from-[#1a1a1f] via-[#1e1e24] to-[#16161a] shadow-2xl shadow-black/50 h-full"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {/* Animated glow effect */}
      <motion.div
        className="absolute -inset-1 bg-gradient-to-r from-[#8B1538]/20 via-[#d4d4d4]/10 to-[#8B1538]/20 rounded-2xl blur-xl opacity-50"
        animate={{
          opacity: [0.3, 0.5, 0.3],
          scale: [1, 1.02, 1],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      {/* PDL Logo Background - moved to right, 1.5x bigger */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-end pr-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <img
            src="/logos/pdl/pdl-s1-logo-transparent.png"
            alt="PDL"
            className="w-[450px] h-[450px] md:w-[570px] md:h-[570px] object-contain"
          />
        </motion.div>
      </div>

      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#1a1a1f] via-[#1a1a1f]/95 to-transparent" />
      
      {/* Animated particles effect */}f
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-[#8B1538]/40 rounded-full"
            style={{
              left: `${20 + i * 15}%`,
              top: `${30 + (i % 3) * 20}%`,
            }}
            animate={{
              y: [-20, 20, -20],
              opacity: [0.2, 0.6, 0.2],
            }}
            transition={{
              duration: 3 + i * 0.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.2,
            }}
          />
        ))}
      </div>

      <div className="relative p-8 md:p-10 max-w-2xl">
        <motion.div variants={fadeInUp}>
          {/* Headline and Promotional Text */}
          <div className="mb-8">
            <motion.h1 
              className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight font-logik"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="bg-gradient-to-br from-white via-[#d4d4d4] to-[#8B1538] bg-clip-text text-transparent">
                {t('hero.title')}
              </span>
            </motion.h1>

            {/* Promotional text */}
            <motion.p 
              className="text-base md:text-lg text-[#a0a0a0] leading-relaxed max-w-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              {t('hero.subtitle')}
            </motion.p>
          </div>

          {/* CTA Buttons - side by side, bigger */}
          <motion.div
            className="flex flex-col sm:flex-row gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {/* Register Team Button */}
            <motion.div
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                href={getTournamentPath(isTeamCaptain ? '/my-team' : '/register')}
                className={cn(
                  "inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-bold text-lg",
                  "bg-gradient-to-r from-[#8B1538] via-[#A91D45] to-[#8B1538] text-white",
                  "shadow-lg shadow-[#8B1538]/40 hover:shadow-xl hover:shadow-[#8B1538]/50",
                  "transition-all duration-300 relative overflow-hidden group"
                )}
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
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                href="https://discord.gg/pd2ih"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-bold text-lg",
                  "text-white relative overflow-hidden group"
                )}
                style={{
                  background: '#7289da',
                  boxShadow: '0 8px 32px rgba(114, 137, 218, 0.4)',
                }}
              >
                {/* Shine effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                />
                <Image
                  src="/logos/pd2ih/dc-icon.png"
                  alt="Discord"
                  width={24}
                  height={24}
                  className="relative z-10"
                />
                <span className="relative z-10">{t('hero.ctaDiscord')}</span>
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}


