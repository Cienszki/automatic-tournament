import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PDLTransferSection } from '@/components/pdl/my-team/PDLTransferSection';
import type { Team } from '@/lib/definitions';

vi.mock('@/lib/firebase', () => ({ db: {}, auth: {}, storage: {} }));
vi.mock('@/lib/storage', () => ({ uploadScreenshot: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/context/TournamentContext', () => ({ useTournament: () => ({ theme: { primaryColor: '#8B1538' }, tournament: { id: 't' } }) }));

const ROLES = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'];
const team = {
  id: 'team1', name: 'Gang sylwka', tag: 'GS', logoUrl: '', captainId: 'u1',
  players: ROLES.map((role, i) => ({ id: `p${i}`, nickname: `Gracz${i}`, role, steamId: `7656${i}`, steamProfileUrl: `https://steamcommunity.com/profiles/7656${i}` })),
} as unknown as Team;

function setup(coach: { nickname: string | null; locked?: boolean }) {
  const onSaveRoster = vi.fn().mockResolvedValue(undefined);
  const onSaveCoach = vi.fn().mockResolvedValue(undefined);
  render(
    <PDLTransferSection
      team={team}
      isCaptain
      isTransferWindowOpen
      isSeasonActive={false}
      previousRoundPlayers={[]}
      maxTransfers={2}
      autoEdit
      onSaveRoster={onSaveRoster}
      coach={{
        nickname: coach.nickname,
        lock: coach.locked ? { locked: true, reason: 'Do meczu zostało mniej niż 24 h' } : { locked: false, reason: null },
        ruleSummary: 'Jeden trener dla drużyny',
        onSave: onSaveCoach,
      }}
    />,
  );
  return { onSaveRoster, onSaveCoach };
}

async function saveAndConfirm() {
  fireEvent.click(screen.getByRole('button', { name: /Zapisz skład/ }));
  fireEvent.click(await screen.findByRole('button', { name: /Potwierdź i zapisz/ }));
}

describe('coach in the roster editor', () => {
  it('saves a new coach together with the roster', async () => {
    const { onSaveRoster, onSaveCoach } = setup({ nickname: null });
    fireEvent.change(screen.getByLabelText('Nick trenera'), { target: { value: ' White Dance ' } });
    await saveAndConfirm();
    await waitFor(() => expect(onSaveCoach).toHaveBeenCalledWith('White Dance'));
    expect(onSaveRoster).toHaveBeenCalled();
  });

  it('removes the coach when the field is cleared, and shows it in the confirmation', async () => {
    const { onSaveCoach } = setup({ nickname: 'Kubox' });
    expect((screen.getByLabelText('Nick trenera') as HTMLInputElement).value).toBe('Kubox');
    fireEvent.change(screen.getByLabelText('Nick trenera'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Zapisz skład/ }));
    expect(await screen.findByText(/bez trenera/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Potwierdź i zapisz/ }));
    await waitFor(() => expect(onSaveCoach).toHaveBeenCalledWith(null));
  });

  it('does not touch the coach when it was not changed', async () => {
    const { onSaveRoster, onSaveCoach } = setup({ nickname: 'Kubox' });
    await saveAndConfirm();
    await waitFor(() => expect(onSaveRoster).toHaveBeenCalled());
    expect(onSaveCoach).not.toHaveBeenCalled();
  });

  it('is read-only with the reason while locked', () => {
    setup({ nickname: 'Kubox', locked: true });
    expect(screen.queryByLabelText('Nick trenera')).toBeNull();
    expect(screen.getByText('Kubox')).toBeTruthy();
    expect(screen.getByText(/mniej niż 24 h/)).toBeTruthy();
  });
});
