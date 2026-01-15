// src/components/letnia/HeroSection.tsx
// Hero section for Letnia home page with cyberpunk neon aesthetic

'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Users, Trophy, LayoutGrid, GitFork } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { useTournament } from '@/context/TournamentContext';

interface HeroSectionProps {
  isTeamCaptain?: boolean;
  groupsCount: number;
  teamsPerGroup: number;
  mmrCap: number;
  playoffsTeams: number;
}

export function LetniaHeroSection({ 
  isTeamCaptain = false, 
  groupsCount,
  teamsPerGroup,
  mmrCap,
  playoffsTeams
}: HeroSectionProps) {
  const t = useTranslations('letniaHome');
  const { getTournamentPath, theme } = useTournament();

  return (
    <motion.div
      className="relative overflow-hidden rounded-xl border border-border/50 bg-card/30 h-full"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {/* Letnia Logo Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute right-[-120px] top-1/2 -translate-y-1/2 opacity-25"
          style={{
            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 35%, black 100%)',
            maskImage: 'linear-gradient(to right, transparent 0%, black 35%, black 100%)',
          }}
        >
          <img
            src="/logos/letnia/letnia-logo-transparent.png"
            alt="Letnia"
            className="w-[600px] h-[600px] object-contain"
          />
        </div>
      </div>

      {/* Animated neon grid background */}
      <div className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(${theme.primaryColor} 1px, transparent 1px),
            linear-gradient(90deg, ${theme.secondaryColor} 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Gradient overlay */}
      <div 
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${theme.primaryColor}15 0%, transparent 50%, ${theme.secondaryColor}10 100%)`
        }}
      />

      <div className="relative p-6 md:p-8 h-full flex flex-col">
        <motion.div variants={fadeInUp} className="max-w-3xl flex-grow">
          {/* Headline */}
          <div className="mb-6">
            <h1 
              className="text-3xl md:text-4xl font-bold mb-4 leading-tight"
              style={{
                background: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: `0 0 40px ${theme.primaryColor}40`
              }}
            >
              {t('hero.title')}
            </h1>

            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
              {t('hero.subtitle')}
            </p>
          </div>

          {/* CTA Button */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="mb-6"
          >
            <Link
              href={getTournamentPath(isTeamCaptain ? '/my-team' : '/register')}
              className={cn(
                "inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold",
                "text-white shadow-lg transition-all duration-300"
              )}
              style={{
                background: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
                boxShadow: `0 0 20px ${theme.primaryColor}60, 0 0 40px ${theme.secondaryColor}30`
              }}
            >
              {isTeamCaptain ? (
                <>
                  <Trophy className="h-5 w-5" />
                  {t('hero.ctaMyTeam')}
                </>
              ) : (
                <>
                  <Users className="h-5 w-5" />
                  {t('hero.ctaRegister')}
                </>
              )}
            </Link>
          </motion.div>
        </motion.div>

        {/* Stats Bar */}
        <motion.div 
          variants={fadeInUp}
          className="grid grid-cols-4 gap-3 pt-4 border-t border-border/30"
        >
          <StatItem 
            icon={<LayoutGrid className="h-4 w-4" />} 
            value={groupsCount.toString()} 
            label={t('hero.statsGroups')}
            color={theme.primaryColor}
          />
          <StatItem 
            icon={<Users className="h-4 w-4" />} 
            value={teamsPerGroup.toString()} 
            label={t('hero.statsTeamsPerGroup')}
            color={theme.secondaryColor}
          />
          <StatItem 
            icon={<Trophy className="h-4 w-4" />} 
            value={`${(mmrCap / 1000).toFixed(0)}k`} 
            label={t('hero.statsMmrCap')}
            color={theme.accentColor}
          />
          <StatItem 
            icon={<GitFork className="h-4 w-4" />} 
            value={playoffsTeams.toString()} 
            label={t('hero.statsPlayoffs')}
            color={theme.primaryColor}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}

function StatItem({ 
  icon, 
  value, 
  label, 
  color 
}: { 
  icon: React.ReactNode; 
  value: string; 
  label: string;
  color: string;
}) {
  return (
    <div className="text-center">
      <div 
        className="flex items-center justify-center gap-1.5 mb-1"
        style={{ color }}
      >
        {icon}
        <span 
          className="text-lg font-bold"
          style={{ textShadow: `0 0 10px ${color}60` }}
        >
          {value}
        </span>
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
