"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useTournament } from '@/context/TournamentContext';
import { HeroSection } from '@/components/pdl/HeroSection';
import { NextMatchCard } from '@/components/pdl/NextMatchCard';
import { DivisionTable } from '@/components/pdl/DivisionTable';
import { QuickLinksSection } from '@/components/pdl/QuickLinksSection';
import { staggerContainer, fadeInUp } from '@/lib/animations';
import { ArrowRight, Trophy, Link as LinkIcon, Loader2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePDLData } from '@/hooks/usePDLData';
import { useAuth } from '@/context/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Home page for Professional League tournaments (e.g., PDL)
 * Complete redesign with Ultra Premium "Deep Void" aesthetic
 * V2: Frameless, "Painted On" Look, Full Width
 */
export function LeagueHomePage() {
  const { tournament, getTournamentPath, theme } = useTournament();
  const { user } = useAuth();
  const t = useTranslations('pdlHome');
  const { divisions, nextMatch, loading, error } = usePDLData();
  const [hasTeam, setHasTeam] = useState(false);

  // Check if user has a registered team
  useEffect(() => {
    const checkUserTeam = async () => {
      if (!user?.uid || !tournament?.id) {
        setHasTeam(false);
        return;
      }
      try {
        const teamsRef = collection(db, 'tournaments', tournament.id, 'teams');
        const captainQuery = query(teamsRef, where('captainId', '==', user.uid));
        const snapshot = await getDocs(captainQuery);
        setHasTeam(!snapshot.empty);
      } catch (err) {
        console.error('Error checking user team:', err);
        setHasTeam(false);
      }
    };
    checkUserTeam();
  }, [user?.uid, tournament?.id]);

  if (!tournament) return null;

  // Check if user is team captain (same as hasTeam)
  const isTeamCaptain = hasTeam;

  // Theme support
  const primaryColor = theme?.primaryColor || '#8B1538';

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050508]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Ładowanie danych...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050508]">
        <div className="text-center">
          <p className="text-destructive mb-2 font-bold text-xl">Błąd ładowania danych</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden text-foreground font-logik selection:bg-primary/30 min-h-screen">
      {/* Global Atmosphere - Copied from Division Page */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Vignette */}
        <div
          className="absolute inset-0 z-0 pointer-events-none opacity-80"
          style={{
            background: 'radial-gradient(circle at center, transparent 0%, #000000 100%)',
          }}
        />

        {/* Very subtle ambient glow */}
        <div
          className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full opacity-[0.03] blur-[150px]"
          style={{ background: primaryColor }}
        />

        {/* Floating particles - subtle dust (kept from original) */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white/5"
            style={{
              width: Math.random() * 2 + 1 + 'px',
              height: Math.random() * 2 + 1 + 'px',
              left: Math.random() * 100 + '%',
              top: Math.random() * 100 + '%',
            }}
            animate={{
              y: [0, -100],
              opacity: [0, 0.3, 0],
            }}
            transition={{
              duration: 10 + Math.random() * 20,
              repeat: Infinity,
              ease: "linear",
              delay: Math.random() * 10,
            }}
          />
        ))}
      </div>



      <div className="relative z-10 w-full max-w-[1920px] mx-auto px-4 sm:px-8 py-8 space-y-16">
        {/* Hero Section + Next Match */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
          {/* Left: Hero Section (7 cols) */}
          <div className="lg:col-span-7 xl:col-span-8 h-full">
            <HeroSection isTeamCaptain={isTeamCaptain} />
          </div>

          {/* Right: Next Match (5 cols) */}
          <div className="lg:col-span-5 xl:col-span-4 h-full pt-8 lg:pt-0">
            <NextMatchCard
              channel={tournament.twitchChannel || 'polishdota2inhouse'}
              nextMatch={nextMatch}
            />
          </div>
        </section>

        {/* Quick Links and Division Tables Section */}
        <section className="grid grid-cols-1 xl:grid-cols-12 gap-12 lg:gap-16">
          {/* Left: Quick Links (2 cols) - Sticky Sidebar */}
          <div className="xl:col-span-2 hidden xl:block">
            <div className="sticky top-24 space-y-8">
              <div>
                <h3 className="text-xs font-mono uppercase tracking-widest text-white/30 mb-6 pl-1">
                  Menu
                </h3>
                <QuickLinksSection />
              </div>
            </div>
          </div>

          {/* Mobile/Tablet Quick Links (Horizontal) */}
          <div className="xl:hidden col-span-1">
            <QuickLinksSection />
          </div>

          {/* Right: Division Tables (10 cols) */}
          <div className="xl:col-span-10">


            {/* Division Tables Grid */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 lg:gap-12 scale-85 origin-top-left"
            >
              {divisions.map((division, index) => (
                <motion.div
                  key={division.id || division.name}
                  variants={fadeInUp}
                  className="relative group h-full"
                >
                  <DivisionTable
                    divisionName={division.name}
                    divisionColor={division.color}
                    teams={division.teams}
                    divisionId={division.id}
                    divisionTheme={division.theme}
                    medalUrl={division.medalUrl}
                  />
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Bottom CTA Section */}
        <section className="py-12 lg:py-24">
          <motion.div
            className="relative rounded-none overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="relative text-center max-w-4xl mx-auto">
              <motion.h2
                className="text-4xl md:text-6xl lg:text-7xl font-logik-extended-bold mb-8 text-white tracking-tight"
                style={{
                  filter: `drop-shadow(0 0 30px ${primaryColor}30)`
                }}
              >
                GOTOWY NA WYZWANIE?
              </motion.h2>
              <p className="text-white/60 mb-12 text-xl leading-relaxed max-w-2xl mx-auto">
                Dołącz do Polish Dota League i sprawdź się z najlepszymi graczami w Polsce.
                Cotygodniowe mecze, profesjonalna organizacja i szansa na awans do najwyższej dywizji!
              </p>

              <Link
                href={getTournamentPath(hasTeam ? '/my-team' : '/register')}
                className={cn(
                  "inline-flex items-center gap-4 px-12 py-6 font-logik-extended-bold text-xl uppercase tracking-widest",
                  "bg-white text-black hover:bg-gray-200",
                  "shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:shadow-[0_0_50px_rgba(255,255,255,0.4)]",
                  "transition-all duration-300 transform hover:-translate-y-1"
                )}
                style={{
                  clipPath: 'polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)'
                }}
              >
                <span>{hasTeam ? 'Moja Drużyna' : 'Zarejestruj się'}</span>
                {hasTeam ? <Users className="h-6 w-6" /> : <ArrowRight className="h-6 w-6" />}
              </Link>
            </div>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
