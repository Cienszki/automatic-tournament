"use client";

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { useTournament } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Megaphone, 
  Crown, 
  ClipboardCheck,
  ChevronRight
} from 'lucide-react';
import { staggerContainer, fadeInUp } from '@/lib/animations';
import {
  LetniaHeroSection,
  FeaturedMatchCard,
  LetniaQuickLinksSection,
  TournamentFormatCard,
  LetniaSocialLinksCard,
  LetniaRecentResultsCard,
  LetniaUpcomingMatchesCard
} from '@/components/letnia';

/**
 * Home page for MMR-limited tournaments (e.g., Letnia Batalia)
 * Uses 2/3 + 1/3 layout with i18n support
 */
export function MmrTournamentHomePage() {
  const { tournament, getTournamentPath, theme, isLegacyTournament } = useTournament();
  const t = useTranslations('letniaHome');

  if (!tournament) return null;

  const getPath = (path: string) => {
    if (isLegacyTournament) {
      return `/${tournament.slug}${path}`;
    }
    return getTournamentPath(path);
  };

  // Mock data for demo - in production, fetch from Firebase
  const mockRecentResults = [
    { id: '1', team1: 'Neon Knights', team2: 'Cyber Wolves', score1: 2, score2: 1, playedAtLabel: '2 dni temu' },
    { id: '2', team1: 'Digital Storm', team2: 'Pixel Raiders', score1: 0, score2: 2, playedAtLabel: '3 dni temu' }
  ];

  const mockUpcomingMatches = [
    { id: '1', team1: 'Neon Knights', team2: 'Digital Storm', whenLabel: 'Dzisiaj 20:00' },
    { id: '2', team1: 'Cyber Wolves', team2: 'Pixel Raiders', whenLabel: 'Jutro 19:00' }
  ];

  return (
    <motion.div
      className="space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {/* Main Grid: 2/3 Hero + 1/3 Quick Links */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column (2/3) - Hero Section */}
        <motion.div variants={fadeInUp} className="lg:col-span-2">
          <LetniaHeroSection
            groupsCount={tournament.groupsCount || 4}
            teamsPerGroup={tournament.teamsPerGroup || 4}
            mmrCap={tournament.mmrCap || 24000}
            playoffsTeams={tournament.playoffs?.teamsCount || 8}
            isTeamCaptain={false} // TODO: Check from auth context
          />
        </motion.div>

        {/* Right Column (1/3) - Quick Links */}
        <motion.div variants={fadeInUp}>
          <LetniaQuickLinksSection />
        </motion.div>
      </div>

      {/* Secondary Grid: Featured Match + Recent Results + Upcoming */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Featured Match */}
        <FeaturedMatchCard
          team1={mockUpcomingMatches[0]?.team1}
          team2={mockUpcomingMatches[0]?.team2}
          matchLabel={t('mock.groupStage')}
          date={mockUpcomingMatches[0]?.whenLabel}
        />

        {/* Recent Results */}
        <LetniaRecentResultsCard
          items={mockRecentResults}
          hrefAll={getPath('/matches')}
        />

        {/* Upcoming Matches */}
        <LetniaUpcomingMatchesCard
          items={mockUpcomingMatches}
          hrefAll={getPath('/schedule')}
        />
      </div>

      {/* Tertiary Grid: Format + Social + Announcements/Fantasy/Pickem */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Tournament Format */}
        <TournamentFormatCard
          groupsLabel={t('mock.groupsLabel', { count: tournament.groupsCount || 4 })}
          teamsPerGroupLabel={t('mock.teamsPerGroupLabel', { count: tournament.teamsPerGroup || 4 })}
          playoffsTeamsLabel={t('mock.playoffsTeamsLabel', { count: tournament.playoffs?.teamsCount || 8 })}
          playoffsFormatLabel={
            tournament.playoffs?.format === 'double-elimination'
              ? t('format.doubleElimination')
              : t('format.singleElimination')
          }
        />

        {/* Social Links */}
        <LetniaSocialLinksCard
          discordUrl="https://discord.gg/pd2ih"
          twitchUrl="https://twitch.tv/pd2ih"
        />

        {/* Announcements */}
        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-bold">
              <Megaphone className="h-4 w-4" style={{ color: theme.primaryColor }} />
              {t('sections.announcements')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-4 text-sm">
              {t('sections.noAnnouncements')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Fantasy & Pick'em Row */}
      {(tournament.fantasy?.enabled || tournament.pickem?.enabled) && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Fantasy */}
          {tournament.fantasy?.enabled && (
            <motion.div variants={fadeInUp}>
              <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="h-5 w-5" style={{ color: theme.secondaryColor }} />
                    {t('sections.fantasy')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    {tournament.fantasy.type === 'round-based' 
                      ? t('sections.fantasyRoundBased')
                      : t('sections.fantasySeasonLong')}
                  </p>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={getPath('/fantasy')}>
                      {t('sections.playFantasy')}
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Pick'em */}
          {tournament.pickem?.enabled && (
            <motion.div variants={fadeInUp}>
              <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5" style={{ color: theme.accentColor }} />
                    {t('sections.pickem')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    {t('sections.pickemDescription')}
                  </p>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={getPath('/pickem')}>
                      {t('sections.pickNow')}
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// Remove the old QuickStatCard - no longer needed
// The stats are now in LetniaHeroSection

