// src/components/format-preview/LanQualifierSection.tsx
// The home page's Tabela section for Swiss tournaments in the LAN-qualifier format: the Swiss /
// Tabela / LAN views built from the real matches (rounds not created yet are drawn as TBD).
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTournament } from '@/context/TournamentContext';
import type { PlayoffMatch } from '@/lib/definitions';
import { SWISS_DIVISION_ID, loadSwissMatches, loadSwissTeams, type SwissRoundMatch, type SwissTeam } from '@/lib/swiss/actions';
import { lanConfig, lanDecisions, seedOrder, toLQMatches } from '@/lib/lan-qualifier/mapping';
import { FormatViews, type FormatView } from './FormatViews';
import { realFormat, type FPTeam } from './model';

const REFRESH_MS = 60_000;

export function LanQualifierSection() {
  const { tournament, theme } = useTournament();
  const [teams, setTeams] = useState<SwissTeam[] | null>(null);
  const [matches, setMatches] = useState<SwissRoundMatch[]>([]);
  const [playoffs, setPlayoffs] = useState<PlayoffMatch[]>([]);
  const [view, setView] = useState<FormatView>('swiss');
  const divisionId = tournament?.swiss?.divisionId ?? SWISS_DIVISION_ID;
  const lq = tournament?.swiss?.lanQualifier ?? null;

  const load = useCallback(async () => {
    if (!tournament?.id) return;
    const [t, m, p] = await Promise.all([
      loadSwissTeams(tournament.id),
      loadSwissMatches(tournament.id, divisionId),
      getDocs(collection(db, 'tournaments', tournament.id, 'playoff_matches')).then(s => s.docs.map(d => ({ ...(d.data() as PlayoffMatch), id: d.id }))),
    ]);
    setTeams(t);
    setMatches(m);
    setPlayoffs(p);
  }, [tournament?.id, divisionId]);

  // Results come in from the lobby bot while people watch: refresh now and then, and on return.
  useEffect(() => {
    load().catch(err => console.error('[LanQualifierSection] load failed', err));
    const t = setInterval(() => { if (document.visibilityState === 'visible') load().catch(() => {}); }, REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') load().catch(() => {}); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  const built = useMemo(() => {
    if (!teams) return null;
    const field = seedOrder(teams, divisionId);
    if (field.length < 6) return null;
    const list: FPTeam[] = field.map((t, i) => ({ id: t.id, name: t.name, logoUrl: t.logoUrl, seed: i + 1, seedMmr: t.seedMmr }));
    return realFormat(list, lanConfig(teams, lq, divisionId).groupA, toLQMatches(matches), lanDecisions(lq));
  }, [teams, matches, lq, divisionId]);

  if (!teams) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderColor: theme?.primaryColor }} />
      </div>
    );
  }
  if (!built) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="font-logik text-lg text-center" style={{ color: 'var(--tournament-heading)' }}>
          Tabela pojawi się po rozpoczęciu turnieju.
        </p>
      </div>
    );
  }
  return <FormatViews sim={built.sim} after={built.after} view={view} setView={setView} playoffMatches={playoffs} embedded />;
}
