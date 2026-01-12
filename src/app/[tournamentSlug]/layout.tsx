"use client";

import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { TournamentNavbar } from '@/components/layout/TournamentNavbar';
import { Footer } from '@/components/layout/Footer';

interface TournamentLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout for tournament-specific pages
 * Handles loading tournament config and applying theme
 */
export default function TournamentLayout({ children }: TournamentLayoutProps) {
  const params = useParams();
  const tournamentSlug = params.tournamentSlug as string;
  const { setTournamentSlug, tournament, isLoading, error, theme } = useTournament();

  // Set the tournament slug when route changes
  useEffect(() => {
    if (tournamentSlug) {
      setTournamentSlug(tournamentSlug);
    }
    
    // Cleanup on unmount
    return () => {
      setTournamentSlug(null);
    };
  }, [tournamentSlug, setTournamentSlug]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground">
        <div className="flex-grow flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center gap-4">
            <div className="h-12 w-12 bg-primary/20 rounded-full" />
            <div className="h-3 w-24 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !tournament) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground">
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4 text-destructive">404</h1>
            <p className="text-muted-foreground mb-4">
              {error || 'Nie znaleziono turnieju'}
            </p>
            <a 
              href="/" 
              className="text-primary hover:underline"
            >
              Wróć na stronę główną
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col min-h-screen text-foreground"
      style={{
        background: theme.backgroundGradient || theme.backgroundColor,
      }}
    >
      <TournamentNavbar />
      <main className="flex-grow container mx-auto px-4 py-8">
        {children}
      </main>
      <Footer />
    </div>
  );
}
