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
  Layers,
  ArrowUpDown
} from 'lucide-react';

/**
 * Home page for Professional League tournaments (e.g., PDL)
 */
export function LeagueHomePage() {
  const { tournament, getTournamentPath, theme } = useTournament();

  if (!tournament) return null;

  const divisions = tournament.divisions || [];

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-lg border" style={{ borderColor: theme.borderColor }}>
        <div 
          className="absolute inset-0 opacity-20"
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
                width={120}
                height={120}
                className="object-contain"
              />
            )}
            <div className="text-center md:text-left">
              <h1 
                className="text-3xl md:text-4xl font-bold mb-2"
                style={{ color: theme.primaryColor }}
              >
                {tournament.name}
              </h1>
              <p className="text-muted-foreground text-lg max-w-2xl">
                {tournament.description}
              </p>
              {tournament.status === 'registration' && (
                <Button asChild className="mt-4" size="lg">
                  <Link href={getTournamentPath('/my-team')}>
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
          icon={<Layers className="h-5 w-5" />}
          label="Dywizje"
          value={divisions.length.toString()}
          color={theme.primaryColor}
        />
        <QuickStatCard
          icon={<Users className="h-5 w-5" />}
          label="Drużyny"
          value={tournament.teamSize?.toString() || "5"}
          color={theme.secondaryColor}
        />
        <QuickStatCard
          icon={<ArrowUpDown className="h-5 w-5" />}
          label="Format"
          value="BO2"
          color={theme.accentColor}
        />
        <QuickStatCard
          icon={<Trophy className="h-5 w-5" />}
          label="Sezon"
          value="1"
          color={theme.primaryColor}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Divisions Overview */}
        <Card className="col-span-full lg:col-span-2" style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" style={{ color: theme.primaryColor }} />
              Dywizje
            </CardTitle>
          </CardHeader>
          <CardContent>
            {divisions.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-3">
                {divisions.map((division) => (
                  <Link 
                    key={division.id} 
                    href={getTournamentPath(`/divisions/${division.id}`)}
                    className="block group"
                  >
                    <div 
                      className="p-4 rounded-lg border transition-all hover:shadow-md"
                      style={{ 
                        borderColor: division.color || theme.borderColor,
                        backgroundColor: `${division.color}10` || 'transparent'
                      }}
                    >
                      <h3 
                        className="font-bold text-lg mb-1 group-hover:underline"
                        style={{ color: division.color || theme.textColor }}
                      >
                        {division.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Tier {division.tier}
                      </p>
                      {division.matchday && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {division.matchday}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Dywizje zostaną ogłoszone wkrótce
              </p>
            )}
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

        {/* Fantasy */}
        {tournament.fantasy?.enabled && (
          <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5" style={{ color: theme.secondaryColor }} />
                Fantasy League
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                {tournament.fantasy.type === 'season-long' 
                  ? 'Zbuduj swój wymarzony skład na cały sezon!'
                  : 'Wybierz graczy przed każdą kolejką!'}
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href={getTournamentPath('/fantasy')}>
                  Zobacz ranking
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
                {tournament.pickem.standingsPredictions 
                  ? 'Wytypuj końcowe tabele dywizji!'
                  : 'Typuj wyniki meczów!'}
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href={getTournamentPath('/pickem')}>
                  Typuj teraz
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Schedule */}
        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" style={{ color: theme.primaryColor }} />
              Nadchodzące mecze
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-4">
              Terminarz zostanie ogłoszony wkrótce
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href={getTournamentPath('/schedule')}>
                Zobacz terminarz
                <ChevronRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Rules Section */}
      <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-lg mb-1">Regulamin ligi</h3>
              <p className="text-muted-foreground">
                Zapoznaj się z zasadami przed rejestracją drużyny
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href={getTournamentPath('/rules')}>
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
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
