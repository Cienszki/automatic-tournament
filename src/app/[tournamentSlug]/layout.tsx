"use client";

import { useParams, usePathname } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { TournamentNavbar } from '@/components/layout/TournamentNavbar';
import { Footer } from '@/components/layout/Footer';
import { DynamicFontLoader } from '@/components/DynamicFontLoader';
import { HomeNavigationProvider } from '@/context/HomeNavigationContext';
import { ThemeFontApplier } from '@/components/ThemeFontApplier';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface TournamentLayoutProps {
  children: React.ReactNode;
}

export default function TournamentLayout({ children }: TournamentLayoutProps) {
  const params = useParams();
  const pathname = usePathname();
  const tournamentSlug = params.tournamentSlug as string;
  const { setTournamentSlug, tournament, isLoading, error, theme } = useTournament();

  // Detect home page for fullscreen snap-scroll layout
  const isHomePage = pathname === `/${tournamentSlug}` || pathname === `/${tournamentSlug}/`;

  const [bgImageReady, setBgImageReady] = useState(true);
  const [pageReady, setPageReady] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const [loaderVisible, setLoaderVisible] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Stable callback — passed to ThemeFontApplier as a prop.
  // useCallback prevents ThemeFontApplier's effect from re-running on every render.
  const handleFontsReady = useCallback(() => setFontsReady(true), []);

  // Reset font-ready when navigating to a different tournament.
  useEffect(() => { setFontsReady(false); }, [tournamentSlug]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (tournamentSlug) {
      setTournamentSlug(tournamentSlug);
    }
    return () => { setTournamentSlug(null); };
  }, [tournamentSlug, setTournamentSlug]);

  useEffect(() => {
    if (tournamentSlug) {
      document.documentElement.setAttribute('data-tournament', tournamentSlug);
      document.documentElement.classList.add('theme-' + tournamentSlug);
    }
    return () => {
      document.documentElement.removeAttribute('data-tournament');
      document.documentElement.classList.remove('theme-' + tournamentSlug);
    };
  }, [tournamentSlug]);

  useEffect(() => {
    if (!tournament) return;
    document.title = tournament.name + ' | dota2inhouse.pl';
    const faviconUrl = theme?.faviconUrl ?? '/icon.png';
    let link = document.querySelector('link[rel*="icon"]:not([rel*="apple"])') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = faviconUrl;
    return () => {
      document.title = 'dota2inhouse.pl - Polskie Turnieje Dota 2';
      const defaultLink = document.querySelector('link[rel*="icon"]:not([rel*="apple"])') as HTMLLinkElement | null;
      if (defaultLink) defaultLink.href = '/icon.png';
    };
  }, [tournament, theme?.faviconUrl]);

  useEffect(() => {
    const url = tournament?.theme?.backgroundImageUrl;
    if (!url) {
      setBgImageReady(true);
      return;
    }
    setBgImageReady(false);
    const img = new Image();
    const timeout = setTimeout(() => setBgImageReady(true), 3000);
    img.onload = () => {
      clearTimeout(timeout);
      // img.decode() waits until the image is fully GPU-decoded and ready
      // to composite — more reliable than onload which only fires after
      // the data is downloaded (before GPU decode).
      if (typeof img.decode === 'function') {
        img.decode()
          .then(() => setBgImageReady(true))
          .catch(() => setBgImageReady(true));
      } else {
        setBgImageReady(true);
      }
    };
    img.onerror = () => { clearTimeout(timeout); setBgImageReady(true); };
    img.src = url;
    return () => { clearTimeout(timeout); };
  }, [tournament?.theme?.backgroundImageUrl]);

  useEffect(() => {
    if (isLoading || !tournament || !bgImageReady) {
      setPageReady(false);
      return;
    }
    let raf1: number, raf2: number;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setPageReady(true));
    });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [isLoading, tournament, bgImageReady]);

  const showLoading = isLoading || !tournament || !bgImageReady || !pageReady || !fontsReady;

  // Keep LoadingScreen mounted until the fade-out animation finishes.
  // setLoaderVisible(true) runs synchronously when loading restarts so there
  // is never a rendered frame without the overlay.
  useEffect(() => {
    if (showLoading) {
      setLoaderVisible(true);
      return;
    }
    const timer = setTimeout(() => setLoaderVisible(false), 420);
    return () => clearTimeout(timer);
  }, [showLoading]);

  if (error && !isLoading && !tournament) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground">
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4 text-destructive">404</h1>
            <p className="text-muted-foreground mb-4">{error || 'Nie znaleziono turnieju'}</p>
            <a href="/" className="text-primary hover:underline">Wróć na stronę główną</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <DynamicFontLoader />
      <ThemeFontApplier onReady={handleFontsReady} />
      <HomeNavigationProvider>
      <div
        className="flex flex-col min-h-screen text-foreground relative"
        // suppressHydrationWarning: the `background` style value differs between
        // server (DEFAULT_THEME) and first client render (cached pendingTheme).
        // This is intentional — the LoadingScreen covers the page during this
        // transient state, so the mismatch is never visible to the user.
        suppressHydrationWarning
        style={{
          background: mounted ? (theme.backgroundGradient || theme.backgroundColor) : undefined,
        }}
      >
        {/* Background image layers — client-only to avoid hydration mismatch */}
        {mounted && theme.backgroundImageUrl && (
          <>
            <div
              className="fixed inset-0 bg-no-repeat pointer-events-none z-0"
              style={{
                backgroundImage: 'url(' + theme.backgroundImageUrl + ')',
                backgroundSize: theme.backgroundSize || 'cover',
                backgroundPosition: theme.backgroundPosition || 'center center',
                filter: theme.backgroundBlur ? 'blur(' + theme.backgroundBlur + 'px)' : undefined,
              }}
              aria-hidden="true"
            />
            <div
              className="fixed inset-0 pointer-events-none z-0"
              style={{
                backgroundColor: theme.backgroundOverlayColor || 'rgba(0,0,0,0.7)',
                opacity: (theme.backgroundOverlayOpacity ?? 90) / 100,
              }}
              aria-hidden="true"
            />
          </>
        )}
        {tournament && (
          <>
            {isHomePage ? (
              /* On the home page the navbar floats over the snap-scroll content
                 so it does not offset the 100vh sections. */
              <div className="fixed top-0 left-0 right-0 z-50">
                <TournamentNavbar />
              </div>
            ) : (
              <TournamentNavbar />
            )}
            <main className={isHomePage ? 'relative z-10' : 'flex-grow container mx-auto px-4 py-8 relative z-10'}>
              <ErrorBoundary section="tournament">
                {children}
              </ErrorBoundary>
            </main>
            {!isHomePage && <Footer />}
          </>
        )}
      </div>
      {loaderVisible && (
        <LoadingScreen isLeaving={!showLoading} />
      )}
      </HomeNavigationProvider>
    </>
  );
}