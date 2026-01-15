"use client";

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useTournament } from '@/context/TournamentContext';
import { HeroSection } from '@/components/pdl/HeroSection';
import { NextMatchCard } from '@/components/pdl/NextMatchCard';
import { DivisionTable } from '@/components/pdl/DivisionTable';
import { QuickLinksSection } from '@/components/pdl/QuickLinksSection';
import { staggerContainer, fadeInUp } from '@/lib/animations';
import { ArrowRight, Trophy, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Home page for Professional League tournaments (e.g., PDL)
 * Complete redesign with WOW factor, better color contrast, and animations
 */
export function LeagueHomePage() {
  const { tournament, getTournamentPath, theme } = useTournament();
  const t = useTranslations('pdlHome');

  if (!tournament) return null;

  // TODO: Replace with real data from database
  const MOCK_DATA = {
    isTeamCaptain: false, // TODO: Get from auth context
    divisions: [
      {
        name: 'Elite',
        color: '#FFD700',
        teams: [
          { position: 1, teamId: '1', teamName: 'Team Alpha', gamesPlayed: 6, points: 12 },
          { position: 2, teamId: '2', teamName: 'Team Beta', gamesPlayed: 6, points: 10 },
          { position: 3, teamId: '3', teamName: 'Team Gamma', gamesPlayed: 6, points: 8 },
          { position: 4, teamId: '4', teamName: 'Team Delta', gamesPlayed: 6, points: 6 },
          { position: 5, teamId: '5', teamName: 'Team Epsilon', gamesPlayed: 6, points: 4 },
          { position: 6, teamId: '6', teamName: 'Team Zeta', gamesPlayed: 6, points: 2 },
        ]
      },
      {
        name: 'Challenger',
        color: '#C0C0C0',
        teams: [
          { position: 1, teamId: '7', teamName: 'Team Eta', gamesPlayed: 6, points: 11 },
          { position: 2, teamId: '8', teamName: 'Team Theta', gamesPlayed: 6, points: 9 },
          { position: 3, teamId: '9', teamName: 'Team Iota', gamesPlayed: 6, points: 8 },
          { position: 4, teamId: '10', teamName: 'Team Kappa', gamesPlayed: 6, points: 7 },
          { position: 5, teamId: '11', teamName: 'Team Lambda', gamesPlayed: 6, points: 5 },
          { position: 6, teamId: '12', teamName: 'Team Mu', gamesPlayed: 6, points: 3 },
        ]
      },
      {
        name: 'Adept',
        color: '#CD7F32',
        teams: [
          { position: 1, teamId: '13', teamName: 'Team Nu', gamesPlayed: 6, points: 10 },
          { position: 2, teamId: '14', teamName: 'Team Xi', gamesPlayed: 6, points: 9 },
          { position: 3, teamId: '15', teamName: 'Team Omicron', gamesPlayed: 6, points: 7 },
          { position: 4, teamId: '16', teamName: 'Team Pi', gamesPlayed: 6, points: 6 },
          { position: 5, teamId: '17', teamName: 'Team Rho', gamesPlayed: 6, points: 4 },
          { position: 6, teamId: '18', teamName: 'Team Sigma', gamesPlayed: 6, points: 2 },
        ]
      }
    ]
  };


  return (
    <div className="min-h-screen relative">
      {/* Animated background gradient */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d0d0f] via-[#121215] to-[#0d0d0f]" />
        <motion.div
          className="absolute inset-0 opacity-30"
          style={{
            background: 'radial-gradient(ellipse at 50% 0%, rgba(139, 21, 56, 0.15) 0%, transparent 50%)',
          }}
          animate={{
            opacity: [0.2, 0.3, 0.2],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        {/* Floating particles */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-[#8B1538]/30 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [-30, 30, -30],
              x: [-10, 10, -10],
              opacity: [0, 0.5, 0],
            }}
            transition={{
              duration: 10 + Math.random() * 10,
              repeat: Infinity,
              ease: "easeInOut",
              delay: Math.random() * 5,
            }}
          />
        ))}
      </div>

      {/* Hero Section + Next Match */}
      <section className="relative">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2/3: Hero Section */}
            <div className="lg:col-span-2">
              <HeroSection isTeamCaptain={MOCK_DATA.isTeamCaptain} />
            </div>

            {/* Right 1/3: Next Match with Twitch */}
            <div>
              <NextMatchCard channel="polishdota2inhouse" />
            </div>
          </div>
        </div>
      </section>

      {/* Quick Links and Division Tables Section */}
      <section className="relative py-8">
        {/* Section background with gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#1a1a1f]/50 to-transparent" />
        
        <div className="container mx-auto px-4 relative">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 1/3: Quick Links */}
            <div>
              <QuickLinksSection />
            </div>

            {/* Right 2/3: Division Tables */}
            <div className="lg:col-span-2">
              {/* Division Tables Grid */}
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
              >
                {MOCK_DATA.divisions.map((division, index) => (
                  <motion.div
                    key={division.name}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="relative group"
                  >
                    {/* Hover glow effect */}
                    <motion.div
                      className="absolute -inset-1 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{
                        background: `radial-gradient(circle at center, ${division.color}20 0%, transparent 70%)`,
                      }}
                    />
                    <div className="relative">
                      <DivisionTable
                        divisionName={division.name}
                        divisionColor={division.color}
                        teams={division.teams}
                      />
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </div>
      </section>



      {/* Bottom CTA Section */}
      <section className="relative py-12">
        <div className="container mx-auto px-4">
          <motion.div
            className="relative rounded-2xl overflow-hidden"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {/* Background with gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#8B1538]/20 via-[#1a1a1f] to-[#8B1538]/20" />
            <div className="absolute inset-0 bg-[url('/logos/pdl/pdl-pattern.png')] opacity-5" />
            
            {/* Animated border */}
            <motion.div
              className="absolute inset-0 rounded-2xl"
              style={{
                background: 'linear-gradient(90deg, #8B1538, #d4d4d4, #8B1538)',
                padding: '1px',
                WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
              }}
              animate={{
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "linear"
              }}
            />

            <div className="relative p-8 md:p-12 text-center">
              <motion.h2 
                className="text-2xl md:text-3xl font-bold mb-4 text-white"
                animate={{ 
                  textShadow: [
                    '0 0 20px rgba(139, 21, 56, 0)',
                    '0 0 40px rgba(139, 21, 56, 0.5)',
                    '0 0 20px rgba(139, 21, 56, 0)',
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                Gotowy na wyzwanie?
              </motion.h2>
              <p className="text-[#a0a0a0] mb-8 max-w-2xl mx-auto">
                Dołącz do Polish Dota League i sprawdź się z najlepszymi graczami w Polsce.
                Cotygodniowe mecze, profesjonalna organizacja i szansa na awans do najwyższej dywizji!
              </p>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link
                  href={getTournamentPath('/register')}
                  className={cn(
                    "inline-flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-lg",
                    "bg-gradient-to-r from-[#8B1538] via-[#A91D45] to-[#8B1538] text-white",
                    "shadow-lg shadow-[#8B1538]/40 hover:shadow-xl hover:shadow-[#8B1538]/50",
                    "transition-all duration-300 relative overflow-hidden group"
                  )}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                  />
                  <Trophy className="h-6 w-6 relative z-10" />
                  <span className="relative z-10">Zarejestruj swoją drużynę</span>
                  <ArrowRight className="h-5 w-5 relative z-10" />
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
