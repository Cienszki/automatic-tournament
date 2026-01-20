"use client";

import { use } from 'react';
import { useTournament, useTournamentType } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layers, Loader2, ArrowLeft, Trophy, TrendingUp, Users } from 'lucide-react';
import { useDivisionData } from '@/hooks/useDivisionData';
import { DivisionStandingsTable } from '@/components/divisions/DivisionStandingsTable';
import { FixtureCrossbox } from '@/components/divisions/FixtureCrossbox';
import { TeamComparisonTool } from '@/components/divisions/TeamComparisonTool';
import { DivisionStatsDashboard } from '@/components/divisions/DivisionStatsDashboard';
import { DivisionRecords } from '@/components/divisions/DivisionRecords';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { fadeInUp, staggerContainer } from '@/lib/animations';

interface PageProps {
  params: Promise<{
    tournamentSlug: string;
    divisionId: string;
  }>;
}

/**
 * Individual division page - shows detailed standings and crossbox
 * Works dynamically for any division that exists or gets created
 */
export default function DivisionDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const { tournament, theme, getTournamentPath } = useTournament();
  const { isLeague } = useTournamentType();
  const { 
    standings, 
    matches, 
    divisionInfo, 
    loading, 
    error 
  } = useDivisionData(resolvedParams.divisionId);

  if (!tournament) return null;

  // This page is only for league tournaments
  if (!isLeague) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold mb-4">Strona niedostępna</h1>
        <p className="text-muted-foreground">
          Ten turniej nie posiada systemu dywizji.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Layers className="h-8 w-8" style={{ color: theme.primaryColor }} />
          <h1 className="text-3xl font-bold">Dywizja</h1>
        </div>
        <div className="text-center py-16">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground mt-4">Ładowanie danych dywizji...</p>
        </div>
      </div>
    );
  }

  if (error || !divisionInfo) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Layers className="h-8 w-8" style={{ color: theme.primaryColor }} />
          <h1 className="text-3xl font-bold">Błąd</h1>
        </div>
        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardContent className="py-8 text-center text-red-500">
            <p>{error || 'Dywizja nie istnieje'}</p>
          </CardContent>
        </Card>
        <div className="flex justify-center">
          <Link href={getTournamentPath('/divisions')}>
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Powrót do dywizji
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const isElite = divisionInfo.tier === 1;
  const isLowest = divisionInfo.tier === (tournament.divisions?.length || 3);

  return (
    <motion.div 
      className="space-y-3"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.15,
            delayChildren: 0.1,
            duration: 0.4
          }
        }
      }}
      initial="hidden"
      animate="visible"
    >
      {/* Two-column layout: Table left, Crossbox right */}
      <div className="grid grid-cols-2 gap-3">
        {/* Division Standings Table */}
        <motion.div 
          variants={fadeInUp}
          whileHover={{ scale: 1.005 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <DivisionStandingsTable
            standings={standings}
            divisionColor={divisionInfo.color || theme.primaryColor}
            divisionName={divisionInfo.name}
            currentRound={divisionInfo.currentRound}
            matchday={divisionInfo.matchday}
            isElite={isElite}
            isLowest={isLowest}
            theme={theme}
          />
        </motion.div>

        {/* Fixture Crossbox */}
        <motion.div 
          variants={fadeInUp}
          whileHover={{ scale: 1.005 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <FixtureCrossbox
            matches={matches}
            standings={standings}
            divisionColor={divisionInfo.color || theme.primaryColor}
            theme={theme}
          />
        </motion.div>
      </div>

      {/* Three-column layout: Team Comparison, Stats Dashboard, and Records */}
      <div className="grid grid-cols-3 gap-3">
        {/* Team Comparison Tool */}
        <motion.div 
          variants={fadeInUp}
          whileHover={{ scale: 1.005, y: -2 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <TeamComparisonTool
            standings={standings}
            matches={matches}
            divisionColor={divisionInfo.color || theme.primaryColor}
            theme={theme}
          />
        </motion.div>

        {/* Division Statistics Dashboard */}
        <motion.div 
          variants={fadeInUp}
          whileHover={{ scale: 1.005, y: -2 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <DivisionStatsDashboard
            matches={matches}
            divisionColor={divisionInfo.color || theme.primaryColor}
            theme={theme}
          />
        </motion.div>

        {/* Division Records */}
        <motion.div 
          variants={fadeInUp}
          whileHover={{ scale: 1.005, y: -2 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <DivisionRecords
            matches={matches}
            divisionColor={divisionInfo.color || theme.primaryColor}
            theme={theme}
          />
        </motion.div>
      </div>

      {/* Legend */}
      <motion.div variants={fadeInUp}>
        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardHeader>
            <CardTitle className="text-lg">Legenda</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2">Tabela</h4>
                <div className="space-y-1 text-muted-foreground">
                  <p><strong>M</strong> - Mecze rozegrane (series BO2)</p>
                  <p><strong>W</strong> - Wygrane</p>
                  <p><strong>R</strong> - Remisy</p>
                  <p><strong>P</strong> - Przegrane</p>
                  <p><strong>Gry W-P</strong> - Wygrane gry - Przegrane gry</p>
                  <p><strong>Neustadtl</strong> - Wynik Sonnenborn-Berger (tiebreaker)</p>
                  <p><strong>PKT</strong> - Punkty (2 za wygraną, 1 za remis, 0 za przegraną)</p>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Strefy</h4>
                <div className="space-y-2">
                  {isElite && (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-yellow-500/20 border border-yellow-500 rounded" />
                      <span className="text-muted-foreground">Top 4 - Kwalifikacja do turnieju finałowego</span>
                    </div>
                  )}
                  {!isElite && (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-500/20 border border-green-500 rounded" />
                      <span className="text-muted-foreground">1. miejsce - Baraż o awans</span>
                    </div>
                  )}
                  {!isLowest && (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-500/20 border border-red-500 rounded" />
                      <span className="text-muted-foreground">Ostatnie miejsce - Baraż o spadek</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
