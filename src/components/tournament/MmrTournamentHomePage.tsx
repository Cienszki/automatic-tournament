"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useTournament } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Megaphone, 
  Trophy, 
  Users, 
  Calendar, 
  Crown, 
  ClipboardCheck,
  ChevronRight,
  LayoutGrid,
  GitFork,
  Flame
} from 'lucide-react';

/**
 * Home page for MMR-limited tournaments (e.g., Letnia Batalia)
 */
export function MmrTournamentHomePage() {
  const { tournament, getTournamentPath, theme, isLegacyTournament } = useTournament();

  if (!tournament) return null;

  // For legacy tournaments, use different paths
  const basePath = isLegacyTournament ? '' : getTournamentPath('');

  const getPath = (path: string) => {
    if (isLegacyTournament) {
      return `/${tournament.slug}${path}`;
    }
    return getTournamentPath(path);
  };

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-lg border" style={{ borderColor: theme.borderColor }}>
        {/* Background image or gradient */}
        <div 
          className="absolute inset-0"
          style={{
            background: theme.backgroundGradient || `linear-gradient(135deg, ${theme.primaryColor}20 0%, ${theme.accentColor}20 100%)`
          }}
        />
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            background: `radial-gradient(circle at top right, ${theme.primaryColor} 0%, transparent 60%)`
          }}
        />
        
        <div className="relative z-10 p-8 md:p-12">
          <div className="flex flex-col md:flex-row items-center gap-6">
            {tournament.theme?.logoUrl && (
              <Image
                src={tournament.theme.logoUrl}
                alt={tournament.name}
                width={160}
                height={160}
                className="object-contain drop-shadow-lg"
              />
            )}
            <div className="text-center md:text-left">
              <h1 
                className="text-3xl md:text-5xl font-bold mb-2"
                style={{ 
                  color: theme.primaryColor,
                  textShadow: `0 0 20px ${theme.primaryColor}40`
                }}
              >
                {tournament.name}
              </h1>
              <p className="text-muted-foreground text-lg max-w-2xl">
                {tournament.description}
              </p>
              {tournament.mmrCap && (
                <p 
                  className="mt-2 text-sm font-medium"
                  style={{ color: theme.accentColor }}
                >
                  Limit MMR: {tournament.mmrCap.toLocaleString('pl-PL')}
                </p>
              )}
              {tournament.status === 'registration' && (
                <Button asChild className="mt-4" size="lg">
                  <Link href={getPath('/my-team')}>
                    <Users className="h-5 w-5 mr-2" />
                    Zarejestruj drużynę
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickStatCard
          icon={<LayoutGrid className="h-5 w-5" />}
          label="Grupy"
          value={tournament.groupsCount?.toString() || "4"}
          color={theme.primaryColor}
        />
        <QuickStatCard
          icon={<Users className="h-5 w-5" />}
          label="Drużyn na grupę"
          value={tournament.teamsPerGroup?.toString() || "4"}
          color={theme.secondaryColor}
        />
        <QuickStatCard
          icon={<Trophy className="h-5 w-5" />}
          label="Limit MMR"
          value={tournament.mmrCap ? `${(tournament.mmrCap / 1000).toFixed(0)}k` : "24k"}
          color={theme.accentColor}
        />
        <QuickStatCard
          icon={<GitFork className="h-5 w-5" />}
          label="Playoffs"
          value={tournament.playoffs?.teamsCount?.toString() || "8"}
          color={theme.primaryColor}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Groups */}
        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5" style={{ color: theme.primaryColor }} />
              Faza grupowa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Sprawdź tabele grup i nadchodzące mecze
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href={getPath('/groups')}>
                Zobacz grupy
                <ChevronRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Playoffs */}
        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitFork className="h-5 w-5" style={{ color: theme.accentColor }} />
              Playoffs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              {tournament.playoffs?.format === 'double-elimination' 
                ? 'Drabinka double elimination'
                : 'Drabinka pucharowa'}
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href={getPath('/playoffs')}>
                Zobacz drabinkę
                <ChevronRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Announcements */}
        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5" style={{ color: theme.primaryColor }} />
              Ogłoszenia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-4">
              Brak nowych ogłoszeń
            </p>
          </CardContent>
        </Card>

        {/* Featured Match */}
        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5" style={{ color: theme.accentColor }} />
              Wyróżniony mecz
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-4">
              Brak zaplanowanych meczów
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href={getPath('/schedule')}>
                Zobacz terminarz
                <ChevronRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Fantasy */}
        {tournament.fantasy?.enabled && (
          <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5" style={{ color: theme.secondaryColor }} />
                Fantasy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                {tournament.fantasy.type === 'round-based' 
                  ? 'Wybierz graczy przed każdą kolejką!'
                  : 'Zbuduj swój wymarzony skład!'}
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href={getPath('/fantasy')}>
                  Graj w Fantasy
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Pick'em */}
        {tournament.pickem?.enabled && (
          <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" style={{ color: theme.accentColor }} />
                Pick'em
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Typuj wyniki meczów i playoff!
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href={getPath('/pickem')}>
                  Typuj teraz
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Teams Section */}
      <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-lg mb-1">Drużyny uczestniczące</h3>
              <p className="text-muted-foreground">
                Zobacz wszystkie zarejestrowane drużyny i ich składy
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href={getPath('/teams')}>
                Zobacz drużyny
                <ChevronRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Rules Section */}
      <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-lg mb-1">Regulamin turnieju</h3>
              <p className="text-muted-foreground">
                Zapoznaj się z zasadami przed rejestracją drużyny
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href={getPath('/rules')}>
                Czytaj regulamin
                <ChevronRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface QuickStatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}

function QuickStatCard({ icon, label, value, color }: QuickStatCardProps) {
  return (
    <div 
      className="p-4 rounded-lg border text-center"
      style={{ borderColor: `${color}30`, backgroundColor: `${color}10` }}
    >
      <div 
        className="inline-flex items-center justify-center w-10 h-10 rounded-full mb-2"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {icon}
      </div>
      <div 
        className="text-2xl font-bold"
        style={{ 
          color,
          textShadow: `0 0 10px ${color}40`
        }}
      >
        {value}
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
