import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import type { SwissRound } from '@/types/tournament';

// The admin's per-match times in the Swiss round builder must reach commitRound as set:
// some pairs on one day via "Ustaw dla zaznaczonych", others changed one by one.

const commitRound = vi.fn(async () => ({ created: 5, byes: 0 }));
const saveDraftScheduling = vi.fn(async () => {});

const TEAMS = Array.from({ length: 10 }, (_, i) => ({
  id: `t${i}`, name: `Team ${i}`, logoUrl: '', divisionId: 'swiss', seedMmr: 5000 - i * 100, isSwissBye: false,
}));
const DRAFT: SwissRound = {
  round: 1, status: 'draft', matchFormat: 'bo2',
  scheduling: { mode: 'fixed', times: ['', '', '', '', ''], maxHoursLater: 4 },
  pairings: [0, 2, 4, 6, 8].map(k => ({ teamAId: `t${k}`, teamBId: `t${k + 1}`, matchId: '', isBye: false })),
  standingsSnapshot: [], generatedAt: '2026-10-19T20:02:21.118Z',
};

vi.mock('@/context/TournamentContext', () => ({
  useTournament: () => ({ tournament: { id: 'pdl', swiss: { divisionId: 'swiss' } }, theme: { primaryColor: '#8B1538' }, refetchTournament: vi.fn() }),
}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'admin' } }) }));
// Stable like the real module-level toast — a new function per render would make the tab reload
const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/lib/firebase', () => ({ db: {} }));
vi.mock('@/lib/swiss/actions', async importOriginal => {
  const real = await importOriginal<typeof import('@/lib/swiss/actions')>();
  return {
    ...real,
    SWISS_DIVISION_ID: 'swiss',
    loadSwissTeams: vi.fn(async () => TEAMS),
    loadSwissMatches: vi.fn(async () => []),
    loadSwissRounds: vi.fn(async () => [structuredClone(DRAFT)]),
    saveDraftScheduling,
    commitRound,
  };
});

const WED = '2026-10-21T20:00';
const THU = '2026-10-22T20:00';
const dayOf = (iso: string) => new Date(iso).getDate();

async function renderTab() {
  const { SwissTab } = await import('@/app/[tournamentSlug]/admin/tabs/SwissTab');
  render(<SwissTab />);
  await screen.findByText('Zaznacz wszystkie');
}
const rowCheckbox = (n: number) => screen.getByLabelText(`Zaznacz mecz ${n}`);
const rowTime = (n: number) => screen.getByLabelText(`Termin meczu ${n}`) as HTMLInputElement;
const bulkTime = () => screen.getByLabelText('Termin dla zaznaczonych');
const applyBulk = () => fireEvent.click(screen.getByRole('button', { name: 'Ustaw dla zaznaczonych' }));
const commit = async () => {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Zatwierdź rundę 1/ })); });
  await waitFor(() => expect(commitRound).toHaveBeenCalled());
  return (commitRound.mock.calls[0] as unknown as [{ scheduling: SwissRound['scheduling'] }])[0].scheduling;
};

describe('Swiss round builder — per-match times', () => {
  beforeEach(() => { cleanup(); commitRound.mockClear(); saveDraftScheduling.mockClear(); });

  it('bulk: three pairs on Wednesday, two on Thursday', async () => {
    await renderTab();
    [1, 2, 3].forEach(n => fireEvent.click(rowCheckbox(n)));
    fireEvent.change(bulkTime(), { target: { value: WED } });
    applyBulk();
    [4, 5].forEach(n => fireEvent.click(rowCheckbox(n)));
    fireEvent.change(bulkTime(), { target: { value: THU } });
    applyBulk();
    expect([1, 2, 3, 4, 5].map(n => rowTime(n).value)).toEqual([WED, WED, WED, THU, THU]);
    const s = await commit();
    expect(s.times!.map(dayOf)).toEqual([21, 21, 21, 22, 22]);
  });

  it('"Zaznacz wszystkie" for Wednesday, then single rows changed to Thursday', async () => {
    await renderTab();
    fireEvent.click(screen.getByLabelText('Zaznacz wszystkie'));
    fireEvent.change(bulkTime(), { target: { value: WED } });
    applyBulk();
    fireEvent.change(rowTime(4), { target: { value: THU } });
    fireEvent.change(rowTime(5), { target: { value: THU } });
    const s = await commit();
    expect(s.times!.map(dayOf)).toEqual([21, 21, 21, 22, 22]);
  });
});
