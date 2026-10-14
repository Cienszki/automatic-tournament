'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTournament } from '@/context/TournamentContext';
import { PageAtmosphere } from '@/components/ui/PageAtmosphere';
import { C, ink, mix } from './kit';

export const REDESIGN_NAMES = [
  'Ściana rekordów',
  'Podium liderów',
  'Mozaika bohaterów',
  'Karty graczy',
  'Pojedynek',
  'Puls turnieju',
  'Odciski drużyn',
  'Osiągnięcia',
  'Laboratorium',
  'Historie',
  'Pokój draftu',
  'Konstelacja',
  'Wojna stron',
  'Zegar meczu',
  'Drużyna tygodnia',
  'Dossier gracza',
  'Wyścig',
  'Tabela krzyżowa',
  'Wyżej czy niżej',
  'Turniej w liczbach',
  'Giełda graczy',
  'Lista tierów',
  'Ranking Elo',
  'Archetypy',
  'Mapa złota',
  'Kronika rekordów',
  'Bingo turnieju',
  'Momentum',
  'Słońce bohaterów',
  'Turniej bohaterów',
  'Centrum statystyk',
  'Gazeta turniejowa',
  'Studio TV',
  'Mapa statystyk',
  'Tablica odlotów',
  'Galeria',
  'Sezon',
] as const;

/**
 * Preview wrapper for /stats-redesign-N: renders the view in a box exactly the size of a
 * home-page section (viewport minus the 3.5rem navbar), with page scrolling locked — the view
 * must work without scrolling. A small switcher jumps between the designs.
 */
export function StatsLabPreview({ n, children }: { n: number; children: React.ReactNode }) {
  const { tournament, theme, getTournamentPath } = useTournament();
  const qs = useSearchParams().toString();

  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => { html.style.overflow = prev; };
  }, []);

  if (!tournament) return null;

  return (
    <div
      className="fixed left-0 right-0 bottom-0 z-30"
      style={{ top: '3.5rem', background: theme.backgroundGradient || theme.backgroundColor }}
    >
      {theme.backgroundImageUrl && (
        <>
          <div className="absolute inset-0 bg-no-repeat pointer-events-none" style={{ backgroundImage: `url(${theme.backgroundImageUrl})`, backgroundSize: theme.backgroundSize || 'cover', backgroundPosition: theme.backgroundPosition || 'center', filter: theme.backgroundBlur ? `blur(${theme.backgroundBlur}px)` : undefined }} />
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: theme.backgroundOverlayColor || 'rgba(0,0,0,0.7)', opacity: (theme.backgroundOverlayOpacity ?? 90) / 100 }} />
        </>
      )}
      <PageAtmosphere primaryColor={theme.primaryColor} secondaryColor={theme.secondaryColor} variant={n} light={theme.themeStyle === 'light'} />
      <div className="relative z-10 h-full">{children}</div>

      {/* Design switcher (preview only) */}
      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20 hidden lg:grid grid-flow-col gap-[3px]" style={{ gridTemplateRows: 'repeat(19, auto)' }}>
        {REDESIGN_NAMES.map((name, i) => (
          <Link
            key={i}
            href={getTournamentPath(`/stats-redesign-${i + 1}`) + (qs ? `?${qs}` : '')}
            title={name}
            className="w-[20px] h-[20px] rounded-full flex items-center justify-center text-[8px] font-bold transition-all"
            style={i + 1 === n
              ? { background: C.primary, color: '#fff', boxShadow: `0 0 12px ${mix(C.primary, 60)}` }
              : { background: ink(8), color: C.muted }}
          >
            {i + 1}
          </Link>
        ))}
      </div>
    </div>
  );
}
