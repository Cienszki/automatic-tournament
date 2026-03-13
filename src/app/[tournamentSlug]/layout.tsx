"use client";

import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { TournamentNavbar } from '@/components/layout/TournamentNavbar';
import { Footer } from '@/components/layout/Footer';
import { DynamicFontLoader } from '@/components/DynamicFontLoader';
import { ThemeFontApplier } from '@/components/ThemeFontApplier';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorBoundary } from '@/components/ErrorBoundary';

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

  // Apply theme data attribute to document for CSS variable switching
  useEffect(() => {
    if (tournamentSlug) {
      // Set data-tournament attribute on html element for theme switching
      document.documentElement.setAttribute('data-tournament', tournamentSlug);
      
      // Also set a class for additional styling hooks
      document.documentElement.classList.add(`theme-${tournamentSlug}`);
    }
    
    return () => {
      // Clean up theme attributes on unmount
      document.documentElement.removeAttribute('data-tournament');
      document.documentElement.classList.remove(`theme-${tournamentSlug}`);
    };
  }, [tournamentSlug]);

  // Update browser tab title and favicon when tournament data loads
  useEffect(() => {
    if (!tournament) return;

    document.title = `${tournament.name} | dota2inhouse.pl`;

    const faviconUrl = theme?.faviconUrl ?? '/icon.png';
    // Next.js App Router renders icon links with rel containing "icon"
    let link = document.querySelector<HTMLLinkElement>('link[rel*="icon"]:not([rel*="apple"])');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = faviconUrl;

    return () => {
      document.title = 'dota2inhouse.pl - Polskie Turnieje Dota 2';
      const defaultLink = document.querySelector<HTMLLinkElement>('link[rel*="icon"]:not([rel*="apple"])');
      if (defaultLink) defaultLink.href = '/icon.png';
    };
  }, [tournament, theme?.faviconUrl]);

  // Loading state
  if (isLoading) {
    return <LoadingScreen />;
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
      <DynamicFontLoader />
      <ThemeFontApplier />
      <TournamentNavbar />
      <main className="flex-grow container mx-auto px-4 py-8">
        <ErrorBoundary section="tournament">
          {children}
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}
