"use client";

import { useTournament, useTournamentType } from '@/context/TournamentContext';
import { usePDLData } from '@/hooks/usePDLData';
import { DivisionTable } from '@/components/pdl/DivisionTable';
import { AlertTriangle } from 'lucide-react';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

/**
 * Groups page - shows group stage standings (MMR tournaments only)
 */
export default function GroupsPage() {
  const { tournament, theme } = useTournament();
  const { isMmrLimited } = useTournamentType();
  const { divisions, loading } = usePDLData();

  if (!tournament) return null;

  // This page is only for MMR-limited tournaments
  if (!isMmrLimited) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold mb-4">Strona niedostępna</h1>
        <p className="text-muted-foreground">
          Ten turniej nie posiada fazy grupowej.
        </p>
      </div>
    );
  }

  if (loading) {
    return <LoadingScreen />;
  }

  const sortedDivisions = [...divisions].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="relative text-white overflow-x-hidden min-h-screen">
      {/* Premium Atmosphere Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Subtle vignette */}
        <div
          className="absolute inset-0 z-0 pointer-events-none opacity-60"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 0%, transparent 40%, #000000 100%)',
          }}
        />
        {/* Ambient glow - top right */}
        <div
          className="absolute top-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full opacity-[0.04] blur-[200px]"
          style={{ background: theme?.primaryColor || '#3b82f6' }}
        />
        {/* Ambient glow - bottom left */}
        <div
          className="absolute bottom-[-20%] left-[-10%] w-[40vw] h-[40vw] rounded-full opacity-[0.03] blur-[150px]"
          style={{ background: theme?.secondaryColor || '#6366f1' }}
        />
      </div>

      <div className="relative z-10 max-w-[1800px] mx-auto px-6 lg:px-12 py-8 space-y-12">
        {/* Header */}
        <div className="text-center space-y-4 py-8 relative">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/3 h-32 blur-[100px] rounded-full pointer-events-none opacity-5"
            style={{ background: theme.primaryColor }}
          />
          <h1 className="text-6xl md:text-7xl 2xl:text-9xl font-logik-wide-black text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/50 tracking-tighter uppercase relative z-10 drop-shadow-2xl">
            Faza grupowa
          </h1>
          <div className="flex items-center justify-center gap-4 opacity-60">
            <div
              className="h-[1px] w-12"
              style={{ background: `linear-gradient(to right, transparent, ${theme.primaryColor})` }}
            />
            <div
              className="w-2 h-2 rotate-45 border"
              style={{ borderColor: theme.primaryColor }}
            />
            <div
              className="h-[1px] w-12"
              style={{ background: `linear-gradient(to left, transparent, ${theme.primaryColor})` }}
            />
          </div>
        </div>

        {/* Groups */}
        {sortedDivisions.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm p-12 text-center relative overflow-hidden group">
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{ background: `linear-gradient(135deg, ${theme.primaryColor}08, transparent, transparent)` }}
            />
            <div className="relative z-10 space-y-4">
              <AlertTriangle className="w-16 h-16 mx-auto mb-2 text-yellow-400/60" />
              <h2 className="text-2xl font-logik-extended-bold text-white">Grupy nie zostały jeszcze utworzone</h2>
              <p className="text-white/50 font-logik">
                Sprawdź ponownie po zakończeniu rejestracji.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {sortedDivisions.map((division) => (
              <DivisionTable
                key={division.id}
                divisionName={division.name}
                divisionColor={division.color}
                teams={division.teams}
                divisionId={division.id}
                divisionTheme={division.theme}
                medalUrl={division.medalUrl}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
