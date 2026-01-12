"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useTournament } from '@/context/TournamentContext';
import { TournamentSummary } from '@/types/tournament';
import { cn } from '@/lib/utils';
import { Trophy, Users, Calendar, ChevronRight, Archive, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Landing page for dota2inhouse.pl
 * Displays available tournaments in a split-screen design (inspired by pkp.pl)
 */
export default function LandingPage() {
  const { activeTournaments, archivedTournaments, isLoading } = useTournament();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-16 w-16 bg-primary/20 rounded-full" />
          <div className="h-4 w-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/pd2ih-logo.png"
              alt="PD2IH Logo"
              width={40}
              height={40}
              className="rounded-full"
              onError={(e) => {
                // Fallback to text if logo doesn't exist
                e.currentTarget.style.display = 'none';
              }}
            />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              dota2inhouse.pl
            </span>
          </div>
          <nav className="flex items-center gap-4">
            <Link 
              href="https://discord.gg/pd2ih" 
              target="_blank"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Discord
            </Link>
            <Link 
              href="https://twitch.tv/pd2ih" 
              target="_blank"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Twitch
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
              Polskie Turnieje Dota 2
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Platforma dla polskiej społeczności Dota 2 - organizujemy turnieje, ligi 
            i wydarzenia esportowe dla graczy na każdym poziomie zaawansowania.
          </p>
        </section>

        {/* Tournaments Grid */}
        <section className="container mx-auto px-4 pb-16">
          {activeTournaments.length > 0 ? (
            <>
              <h2 className="text-2xl font-bold mb-8 flex items-center gap-2">
                <Trophy className="h-6 w-6 text-primary" />
                Aktywne turnieje
              </h2>
              <div className={cn(
                "grid gap-6",
                activeTournaments.length === 1 
                  ? "grid-cols-1 max-w-2xl mx-auto" 
                  : "grid-cols-1 md:grid-cols-2"
              )}>
                {activeTournaments.map((tournament) => (
                  <TournamentCard key={tournament.id} tournament={tournament} featured />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-16 border border-border rounded-lg bg-card">
              <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Brak aktywnych turniejów</h3>
              <p className="text-muted-foreground mb-6">
                Obecnie nie prowadzimy żadnych turniejów. Śledź nas na Discordzie, 
                aby nie przegapić kolejnych wydarzeń!
              </p>
              <Button asChild>
                <Link href="https://discord.gg/pd2ih" target="_blank">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Dołącz do Discorda
                </Link>
              </Button>
            </div>
          )}

          {/* Archived Tournaments */}
          {archivedTournaments.length > 0 && (
            <div className="mt-16">
              <h2 className="text-2xl font-bold mb-8 flex items-center gap-2">
                <Archive className="h-6 w-6 text-muted-foreground" />
                Archiwum turniejów
              </h2>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {archivedTournaments.map((tournament) => (
                  <TournamentCard key={tournament.id} tournament={tournament} />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Features Section */}
        <section className="border-t border-border bg-card/50">
          <div className="container mx-auto px-4 py-16">
            <h2 className="text-2xl font-bold text-center mb-12">
              Co oferujemy?
            </h2>
            <div className="grid gap-8 md:grid-cols-3">
              <FeatureCard
                icon={<Trophy className="h-8 w-8" />}
                title="Turnieje MMR"
                description="Turnieje z limitami MMR dla graczy na podobnym poziomie umiejętności. Idealne dla amatorów i średnio-zaawansowanych."
              />
              <FeatureCard
                icon={<Users className="h-8 w-8" />}
                title="Ligi profesjonalne"
                description="Wielodywizyjne ligi sezonowe z systemem promocji i spadków. Dla tych, którzy chcą się sprawdzić z najlepszymi."
              />
              <FeatureCard
                icon={<Calendar className="h-8 w-8" />}
                title="Fantasy & Pick'em"
                description="Buduj swój wymarzony skład i typuj wyniki meczy. Rywalizuj z innymi kibicami o miano najlepszego analityka."
              />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                © 2025 PD2IH - Polish Dota 2 Inhouse
              </span>
            </div>
            <div className="flex items-center gap-6">
              <Link 
                href="https://discord.gg/pd2ih" 
                target="_blank"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Discord
              </Link>
              <Link 
                href="https://twitch.tv/pd2ih" 
                target="_blank"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Twitch
              </Link>
              <Link 
                href="https://twitter.com/pd2ih" 
                target="_blank"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Twitter/X
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

interface TournamentCardProps {
  tournament: TournamentSummary;
  featured?: boolean;
}

function TournamentCard({ tournament, featured = false }: TournamentCardProps) {
  const statusLabels: Record<string, string> = {
    'registration': 'Rejestracja otwarta',
    'active': 'W trakcie',
    'completed': 'Zakończony',
  };

  const typeLabels: Record<string, string> = {
    'mmr-limited': 'Turniej MMR',
    'league': 'Liga',
  };

  return (
    <Link href={`/${tournament.slug}`} className="block group">
      <div 
        className={cn(
          "relative overflow-hidden rounded-lg border transition-all duration-300",
          "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10",
          featured 
            ? "bg-gradient-to-br from-card to-card/50 border-primary/20 p-8" 
            : "bg-card border-border p-6"
        )}
      >
        {/* Background Decoration */}
        {featured && (
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              background: `radial-gradient(circle at top right, ${tournament.primaryColor} 0%, transparent 60%)`,
            }}
          />
        )}

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start gap-4 mb-4">
            {tournament.logoUrl && (
              <div 
                className={cn(
                  "shrink-0 rounded-lg overflow-hidden bg-background/50",
                  featured ? "w-20 h-20" : "w-14 h-14"
                )}
              >
                <Image
                  src={tournament.logoUrl}
                  alt={tournament.name}
                  width={featured ? 80 : 56}
                  height={featured ? 80 : 56}
                  className="object-contain w-full h-full"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className={cn(
                "font-bold truncate group-hover:text-primary transition-colors",
                featured ? "text-2xl" : "text-lg"
              )}>
                {tournament.name}
              </h3>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span 
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ 
                    backgroundColor: `${tournament.primaryColor}20`,
                    color: tournament.primaryColor,
                  }}
                >
                  {typeLabels[tournament.type] || tournament.type}
                </span>
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full",
                  tournament.status === 'registration' && "bg-green-500/20 text-green-400",
                  tournament.status === 'active' && "bg-primary/20 text-primary",
                  tournament.status === 'completed' && "bg-muted text-muted-foreground",
                )}>
                  {statusLabels[tournament.status] || tournament.status}
                </span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
            {tournament.teamsCount > 0 && (
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {tournament.teamsCount} drużyn
              </span>
            )}
            {tournament.startDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(tournament.startDate).toLocaleDateString('pl-PL', {
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            )}
          </div>

          {/* CTA */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-primary group-hover:underline flex items-center gap-1">
              {tournament.status === 'registration' 
                ? 'Zarejestruj drużynę' 
                : 'Zobacz szczegóły'}
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="text-center p-6">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
