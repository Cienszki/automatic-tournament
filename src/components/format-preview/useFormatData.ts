// src/components/format-preview/useFormatData.ts
// TEMPORARY — loads the tournament's teams for the LAN-format preview and pads the field
// with stand-ins up to the chosen size. Settings live in the URL (?v=, ?n=, ?seed=, ?r=) so a
// link reproduces exactly the same simulated tournament.
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTournament } from '@/context/TournamentContext';
import { simulateFormat, type FPTeam, type FormatSim, type LanConfig } from './model';

export const DEFAULT_TEAM_COUNT = 12;
export const TEAM_COUNT_OPTIONS = [8, 10, 12, 14, 16, 20, 24, 28, 32];

import type { FormatView } from './FormatViews';
export type { FormatView };
const VIEWS: FormatView[] = ['swiss', 'tabela', 'lan'];

interface RawTeam { id: string; name: string; logoUrl?: string; seedMmr?: number }

export interface FormatData {
  sim: FormatSim | null;
  view: FormatView;
  teamCount: number;
  /** Show the tournament as it looks after this round (0 = before the start). */
  after: number;
  setView: (v: FormatView) => void;
  setTeamCount: (n: number) => void;
  reroll: () => void;
  setAfter: (r: number) => void;
}

const bestOf = (f: unknown, fallback: 3 | 5): 3 | 5 => (f === 'bo5' ? 5 : f === 'bo3' ? 3 : fallback);

export function useFormatData(): FormatData {
  const { tournament } = useTournament();
  const params = useSearchParams();
  const [raw, setRaw] = useState<RawTeam[] | null>(null);
  const [view, setView] = useState<FormatView>(() => (VIEWS.includes(params.get('v') as FormatView) ? (params.get('v') as FormatView) : 'swiss'));
  const [teamCount, setTeamCountState] = useState(() => Number(params.get('n')) || DEFAULT_TEAM_COUNT);
  const [seed, setSeed] = useState(() => Number(params.get('seed')) || 7);
  const [after, setAfterState] = useState<number | null>(() => (params.has('r') ? Number(params.get('r')) : null));

  useEffect(() => {
    if (!tournament?.id) return;
    let alive = true;
    getDocs(collection(db, 'tournaments', tournament.id, 'teams')).then(snap => {
      if (!alive) return;
      setRaw(
        snap.docs
          .map(d => ({ id: d.id, data: d.data() as { name?: string; logoUrl?: string; seedMmr?: unknown; isSwissBye?: boolean } }))
          .filter(({ data }) => !data.isSwissBye)
          .map(({ id, data }) => ({
            id,
            name: String(data.name ?? id),
            logoUrl: data.logoUrl,
            seedMmr: typeof data.seedMmr === 'number' ? data.seedMmr : undefined,
          })),
      );
    }).catch(() => alive && setRaw([]));
    return () => { alive = false; };
  }, [tournament?.id]);

  // The LAN bracket uses the formats the organiser set for this tournament's playoffs.
  const playoffs = (tournament as { playoffs?: Record<string, unknown> } | null)?.playoffs;
  const lanConfig: LanConfig = useMemo(() => ({
    semis: bestOf(playoffs?.semifinalFormat, 3),
    final: bestOf(playoffs?.grandFinalFormat, 5),
  }), [playoffs?.semifinalFormat, playoffs?.grandFinalFormat]);

  const sim = useMemo(() => {
    if (!raw) return null;
    const real = [...raw].sort((a, b) => (b.seedMmr ?? -1) - (a.seedMmr ?? -1)).slice(0, teamCount);
    const list: FPTeam[] = real.map((t, i) => ({ ...t, seed: i + 1 }));
    for (let i = list.length; i < teamCount; i++) {
      list.push({ id: `placeholder-${i + 1}`, name: `Nowa drużyna ${i + 1 - real.length}`, seed: i + 1, placeholder: true });
    }
    return simulateFormat(list, seed, lanConfig);
  }, [raw, teamCount, seed, lanConfig]);

  const effectiveAfter = Math.min(after ?? sim?.totalRounds ?? 0, sim?.lastRound ?? 0);

  useEffect(() => {
    if (!sim) return;
    window.history.replaceState(null, '', `${window.location.pathname}?v=${view}&n=${teamCount}&seed=${seed}&r=${effectiveAfter}`);
  }, [view, teamCount, seed, effectiveAfter, sim]);

  const setTeamCount = useCallback((n: number) => { setTeamCountState(n); setAfterState(null); }, []);
  const reroll = useCallback(() => setSeed(s => (s * 48271 + 11) % 2147483647 || 1), []);
  const setAfter = useCallback((r: number) => setAfterState(r), []);

  return { sim, view, teamCount, after: effectiveAfter, setView, setTeamCount, reroll, setAfter };
}
