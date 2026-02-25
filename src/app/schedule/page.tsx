'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { getAllMatches } from "@/lib/firestore";
import { Match } from "@/lib/definitions";
import { RoundSelector } from '@/components/schedule/RoundSelector';
import { MatchdayCarousel } from '@/components/schedule/MatchdayCarousel';
import { Card } from "@/components/ui/card";
import { motion } from 'framer-motion';

export default function SchedulePage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(1); // Dynamic later?

  useEffect(() => {
    const loadMatches = async () => {
      try {
        const allMatches = await getAllMatches();
        // Filter for valid matches that are scheduled or active/completed
        // For now, we are treating EVERYTHING as "Round 1" because the data model doesn't support rounds yet.
        // We will pass ALL matches to the carousel for now.

        // Exclude invalid
        const validMatches = allMatches.filter(m => m.scheduledFor);

        setMatches(validMatches);
      } catch (error) {
        console.error("Failed to load matches:", error);
      } finally {
        setLoading(false);
      }
    };

    loadMatches();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050508]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-pdl-gold border-t-transparent rounded-full animate-spin" />
          <span className="text-pdl-gold font-logik-extended-bold tracking-widest animate-pulse">LOADING SCHEDULE...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      {/* Hero Section / Header */}
      <div className="relative h-[300px] w-full overflow-hidden flex items-center justify-center">
        {/* Background */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-color-dodge"
          style={{ backgroundImage: `url(/backgrounds/schedule.png)` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050508]/80 to-[#050508]" />

        <div className="relative z-10 text-center space-y-4">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-logik-extended-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50 uppercase tracking-tighter"
            style={{ filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.1))' }}
          >
            Season Schedule
          </motion.h1>
          <div className="w-24 h-1 bg-pdl-gold mx-auto rounded-full box-shadow-[0_0_10px_var(--pdl-gold)]" />
        </div>
      </div>

      <div className="container mx-auto px-4 pb-20 -mt-10 relative z-20">

        {/* Round Selector */}
        <div className="mb-8">
          <RoundSelector
            currentRound={currentRound}
            totalRounds={totalRounds}
            onRoundChange={setCurrentRound}
          />
        </div>

        {/* Carousel */}
        <MatchdayCarousel matches={matches} />

      </div>
    </div>
  );
}
