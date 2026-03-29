'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Users, Trophy } from 'lucide-react';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { useTournament } from '@/context/TournamentContext';
import { organizationConfig } from '@/config/organization';

interface HeroSectionProps {
  isTeamCaptain?: boolean;
  groupsCount: number;
  teamsPerGroup: number;
  mmrCap: number;
  playoffsTeams: number;
}

export function MmrHeroSection({
  isTeamCaptain = false,
  groupsCount,
  teamsPerGroup,
  mmrCap,
  playoffsTeams
}: HeroSectionProps) {
  const { getTournamentPath, theme, tournament } = useTournament();
  const primaryColor = theme?.primaryColor || '#8B1538';
  const discordUrl = tournament?.discordUrl || organizationConfig.defaults.discord;

  return (
    <motion.div
      className="relative h-full min-h-[400px] lg:min-h-[500px] 2xl:min-h-[700px] flex flex-col"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {/* Faded logo watermark */}
      {theme?.logoUrl && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute right-[-80px] top-1/2 -translate-y-1/2"
            style={{
              WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 40%, black 100%)',
              maskImage: 'linear-gradient(to right, transparent 0%, black 40%, black 100%)',
              opacity: 0.06,
            }}
          >
            <img
              src={theme.logoUrl}
              alt={tournament?.name || ''}
              className="w-[500px] h-[500px] object-contain"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex-grow flex flex-col justify-center w-full max-w-4xl">
        <motion.div variants={fadeInUp}>
          {/* Tournament name headline */}
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-logik-extended-bold mb-4 leading-[0.9] tracking-tight text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]">
            {tournament?.name}
          </h1>

          {/* Subtitle with theme-colored left border */}
          <p
            className="text-base md:text-lg text-white/60 leading-relaxed max-w-lg font-medium border-l-4 pl-6 ml-1 mb-8"
            style={{ borderColor: primaryColor }}
          >
            Faza grupowa → Playoffs. Limit MMR {(mmrCap / 1000).toFixed(0)}k wyrównuje szanse. Pokaż swoje umiejętności!
          </p>

          {/* CTA Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row gap-4 mt-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link
                href={getTournamentPath(isTeamCaptain ? '/my-team' : '/register')}
                className="inline-flex items-center justify-center gap-3 px-8 py-4 font-logik-extended-bold text-lg uppercase tracking-widest text-white transition-all duration-300 relative overflow-hidden group"
                style={{
                  backgroundColor: primaryColor,
                  clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'
                }}
              >
                <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                {isTeamCaptain ? (
                  <><Trophy className="h-5 w-5 relative z-10" /><span className="relative z-10">Moja Drużyna</span></>
                ) : (
                  <><Users className="h-5 w-5 relative z-10" /><span className="relative z-10">Zarejestruj Drużynę</span></>
                )}
              </Link>
            </motion.div>

            {discordUrl && (
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link
                  href={discordUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-3 px-8 py-4 font-logik-extended-bold text-lg uppercase tracking-widest text-white border border-white/10 hover:border-[#5865F2] hover:text-[#5865F2] hover:bg-[#5865F2]/5 transition-all duration-300"
                  style={{
                    clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'
                  }}
                >
                  <span>Discord</span>
                </Link>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
