// src/app/[tournamentSlug]/divisions/[divisionId]/page.tsx
// Ultra-Premium Division Page Layout

'use client';

import { useState, use, useRef, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { notFound } from 'next/navigation';
import { useTournament } from '@/context/TournamentContext';
import { useDivisionData } from '@/hooks/useDivisionData';
import { DivisionHero } from '@/components/divisions/DivisionHero';
import { DivisionStandingsTable } from '@/components/divisions/DivisionStandingsTable';
import { FixtureCrossbox } from '@/components/divisions/FixtureCrossbox';
import { UpcomingMatches } from '@/components/divisions/UpcomingMatches';
import { RecentResultsTimeline } from '@/components/divisions/RecentResultsTimeline';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Trophy, Calendar, TrendingUp, GitCompare, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

export default function DivisionPage({ params }: { params: Promise<{ tournamentSlug: string; divisionId: string }> }) {
  const unwrappedParams = use(params);
  const { tournament, isLoading: isTournamentLoading, getTournamentPath } = useTournament();
  const { divisionInfo, standings, matches, loading: isDivisionLoading, error } = useDivisionData(unwrappedParams.divisionId);
  const [activeTab, setActiveTab] = useState('overview');
  const [allDivisions, setAllDivisions] = useState<any[]>([]);

  // Load all divisions for navigation
  useEffect(() => {
    const loadDivisions = async () => {
      if (!tournament?.id) return;
      try {
        const divisionsRef = collection(db, 'tournaments', tournament.id, 'divisions');
        const snapshot = await getDocs(divisionsRef);
        const divs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Array<{ id: string; tier?: number; [key: string]: unknown }>;
        divs.sort((a, b) => (a.tier || 999) - (b.tier || 999));
        setAllDivisions(divs);
      } catch (err) {
        console.error('Error loading divisions:', err);
      }
    };
    loadDivisions();
  }, [tournament?.id]);

  // Theme check
  const theme = tournament?.theme || {
    primaryColor: '#3b82f6',
    secondaryColor: '#1e40af',
    accentColor: '#60a5fa',
    backgroundColor: '#0f172a',
    cardColor: '#1e293b',
    textColor: '#f8fafc',
  };

  if (isTournamentLoading || isDivisionLoading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-destructive">
        Error loading division: {error}
      </div>
    );
  }

  if (!divisionInfo) return null;

  const divisionName = divisionInfo.name;
  const divisionColor = divisionInfo.color || theme.primaryColor;
  const isElite = divisionInfo.tier === 1;
  const isLowest = divisionInfo.tier === (tournament?.divisions?.length || 3);

  const totalRounds = divisionInfo.totalRounds || 1;

  // Determine neighbors for navigation using loaded divisions
  // Logic: "Next" (Right Arrow) -> Higher Rank (Lower Tier Number) e.g. Challenger -> Elite
  // "Previous" (Left Arrow) -> Lower Rank (Higher Tier Number) e.g. Elite -> Challenger
  const currentDivIndex = allDivisions.findIndex(d => d.id === unwrappedParams.divisionId);

  // Previous (Right): Lower Rank (Higher Index in sorted array)
  const prevDivision = currentDivIndex !== -1 && currentDivIndex < allDivisions.length - 1
    ? allDivisions[currentDivIndex + 1]
    : null;

  // Next (Left): Higher Rank (Lower Index in sorted array)
  const nextDivision = currentDivIndex > 0
    ? allDivisions[currentDivIndex - 1]
    : null;

  // Tier styles map
  const tierStyles: Record<number, string> = {
    1: "text-shine-gold",
    2: "text-shine-silver",
    3: "text-shine-bronze",
  };

  return (
    <div className="text-foreground relative selection:bg-primary/30 font-sans overflow-x-hidden w-full h-full min-h-screen">
      {/* Global Atmosphere - Deep Void */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Vignette - restored as requested */}
        <div
          className="absolute inset-0 z-0 pointer-events-none opacity-80"
          style={{
            background: 'radial-gradient(circle at center, transparent 0%, #000000 100%)',
          }}
        />

        {/* Very subtle ambient glow - barely visible */}
        <div
          className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full opacity-[0.03] blur-[150px]"
          style={{ background: theme.primaryColor }}
        />
      </div>

      {/* Navigation - Left (Next/Better Tier - e.g. Challenger -> Elite) */}
      {nextDivision && (
        <a
          href={getTournamentPath(`/divisions/${nextDivision.id}`)}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-50 p-8 group flex items-center gap-6 transition-all duration-300 opacity-40 hover:opacity-100 hover:pl-10 cursor-pointer"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 h-full w-[300px]" />
          <motion.div
            whileHover={{ x: -5, scale: 1.15 }}
            className="relative z-10 p-6 rounded-full border border-white/10 bg-black/60 backdrop-blur-xl group-hover:border-white/40 shadow-2xl"
          >
            <ArrowLeft className="w-10 h-10 text-white" />
          </motion.div>
          <div className="hidden group-hover:block relative z-10 text-left">
            <span className="text-xs text-white/50 uppercase tracking-widest font-mono block mb-1">Wyższa Dywizja</span>
            <span
              className={cn(
                "text-4xl font-logik-extended-bold tracking-wide transition-all",
                tierStyles[nextDivision.tier] || "text-white"
              )}
              style={{ filter: `drop-shadow(0 0 15px ${nextDivision.color}60)` }}
            >
              {nextDivision.name}
            </span>
          </div>
        </a>
      )}

      {/* Navigation - Right (Previous/Lower Tier - e.g. Elite -> Challenger) */}
      {prevDivision && (
        <a
          href={getTournamentPath(`/divisions/${prevDivision.id}`)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-50 p-8 group flex flex-row-reverse items-center gap-6 transition-all duration-300 opacity-40 hover:opacity-100 hover:pr-10 cursor-pointer"
        >
          <div className="absolute inset-0 right-0 bg-gradient-to-l from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 h-full w-[300px]" />
          <motion.div
            whileHover={{ x: 5, scale: 1.15 }}
            className="relative z-10 p-6 rounded-full border border-white/10 bg-black/60 backdrop-blur-xl group-hover:border-white/40 shadow-2xl"
          >
            <ArrowRight className="w-10 h-10 text-white" />
          </motion.div>
          <div className="hidden group-hover:block relative z-10 text-right">
            <span className="text-xs text-white/50 uppercase tracking-widest font-mono block mb-1">Niższa Dywizja</span>
            <span
              className={cn(
                "text-4xl font-logik-extended-bold tracking-wide transition-all",
                tierStyles[prevDivision.tier] || "text-white"
              )}
              style={{ filter: `drop-shadow(0 0 15px ${prevDivision.color}60)` }}
            >
              {prevDivision.name}
            </span>
          </div>
        </a>
      )}

      {/* Main Content with Slide Transition */}
      <DivisionTransition key={divisionName} divisionTier={divisionInfo.tier}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 max-w-[1800px]">
          <DivisionHero
            divisionName={divisionName}
            divisionTier={divisionInfo.tier}
            divisionColor={divisionColor}
            matchday={divisionInfo.matchday}
            currentRound={divisionInfo.currentRound}
            totalRounds={totalRounds}
            teamsCount={standings.length}
            theme={theme}
            divisionTheme={divisionInfo.theme}
            medalUrl={divisionInfo.medalUrl}
          />

          {/* Floating Dock Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-12">
            <div className="sticky top-4 z-40 flex justify-center mb-10 pointer-events-none">
              <motion.div
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="glass-panel-premium px-2 py-1.5 rounded-full inline-flex shadow-2xl backdrop-blur-xl pointer-events-auto border border-white/5"
              >
                <TabsList className="bg-transparent border-0 h-auto p-0 gap-1">
                  {[
                    { id: 'overview', label: 'Przegląd', icon: Trophy },
                    { id: 'matches', label: 'Mecze', icon: Calendar },
                    { id: 'stats', label: 'Statystyki', icon: BarChart3 },
                    { id: 'comparison', label: 'Porównanie', icon: GitCompare },
                  ].map((tab) => (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="rounded-full px-6 py-2.5 data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/40 hover:text-white/80 transition-all duration-300 font-logik"
                    >
                      <div className="flex items-center gap-2">
                        <tab.icon className="w-4 h-4" />
                        <span className="font-semibold hidden sm:inline">{tab.label}</span>
                        <span className="sm:hidden">{tab.icon && <tab.icon className="w-5 h-5" />}</span>
                      </div>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </motion.div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10, filter: 'blur(5px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -10, filter: 'blur(5px)' }}
                transition={{ duration: 0.2 }}
              >
                <TabsContent value="overview" className="space-y-8 m-0 focus-visible:ring-0">
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-12 items-start">
                    <div className="xl:col-span-1 space-y-8">
                      {/* Standings take prominent spot */}
                      <DivisionStandingsTable
                        standings={standings}
                        divisionColor={divisionColor}
                        divisionName={divisionName}
                        currentRound={divisionInfo.currentRound}
                        matchday={divisionInfo.matchday}
                        isElite={isElite}
                        isLowest={isLowest}
                        theme={theme}
                      />
                    </div>
                    <div className="xl:col-span-1 space-y-8">
                      {/* Crossbox next to standings on large screens */}
                      <FixtureCrossbox
                        matches={matches}
                        standings={standings}
                        divisionColor={divisionColor}
                        divisionTier={divisionInfo.tier}
                        theme={theme}
                        divisionTheme={divisionInfo.theme}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="matches" className="m-0 focus-visible:ring-0">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    <UpcomingMatches
                      matches={matches}
                      divisionColor={divisionColor}
                      theme={theme}
                    />
                    <RecentResultsTimeline
                      matches={matches}
                      divisionColor={divisionColor}
                      theme={theme}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="stats" className="m-0 focus-visible:ring-0">
                  <div className="flex items-center justify-center min-h-[300px] rounded-2xl border border-white/5 bg-white/[0.02]">
                    <div className="text-center">
                      <BarChart3 className="w-12 h-12 text-white/10 mx-auto mb-4" />
                      <p className="text-white/30 font-mono">Panel statystyk dostępny wkrótce</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="comparison" className="m-0 focus-visible:ring-0">
                  <div className="flex items-center justify-center min-h-[300px] rounded-2xl border border-white/5 bg-white/[0.02]">
                    <div className="text-center">
                      <GitCompare className="w-12 h-12 text-white/10 mx-auto mb-4" />
                      <p className="text-white/30 font-mono">Panel porównania drużyn dostępny wkrótce</p>
                    </div>
                  </div>
                </TabsContent>
              </motion.div>
            </AnimatePresence>
          </Tabs>
        </div>
      </DivisionTransition>
    </div>
  );
}

// Sub-component for handling direction-aware transitions
function DivisionTransition({ children, divisionTier }: { children: React.ReactNode, divisionTier: number }) {
  // We use a ref to track the previous tier to determine direction
  // If undefined (first load), default to standard fade
  const prevTier = usePrevious(divisionTier);

  // Logic:
  // Target < Prev (2 -> 1, Elite): Moving "Left" in carousel. New content enters from Left (-100%) to Center. Old content exits Center to Right (100%).
  // Target > Prev (1 -> 2, Challenger): Moving "Right" in carousel. New content enters from Right (100%) to Center. Old content exits Center to Left (-100%).

  const slideDirection = prevTier === undefined ? 0 : divisionTier < prevTier ? -1 : 1;

  return (
    <AnimatePresence mode="popLayout" initial={false} custom={slideDirection}>
      <motion.div
        key={divisionTier}
        custom={slideDirection}
        initial={{ x: slideDirection * 100 + '%', opacity: 0, scale: 0.9 }}
        animate={{ x: 0, opacity: 1, scale: 1 }}
        exit={{ x: slideDirection * -100 + '%', opacity: 0, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 300, damping: 30, mass: 1 }}
        className="w-full h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// Hook to track previous value
function usePrevious(value: number) {
  const ref = useRef<number>();

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}
