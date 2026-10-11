import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PDLTeamCoachCard } from '@/components/pdl/my-team/PDLTeamCoachCard';

vi.mock('@/context/TournamentContext', () => ({ useTournament: () => ({ theme: { primaryColor: '#8B1538' } }) }));

const open = { locked: false, reason: null };
const locked = { locked: true, reason: 'Do meczu zostało mniej niż 24 h — trenera zmienisz po jego rozegraniu.' };

function setup(props: Partial<React.ComponentProps<typeof PDLTeamCoachCard>> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(<PDLTeamCoachCard coachNickname={null} isCaptain lock={open} ruleSummary="reguła" onSave={onSave} {...props} />);
  return { onSave };
}

describe('PDLTeamCoachCard', () => {
  it('lets the captain add a coach by nickname only', async () => {
    const { onSave } = setup();
    expect(screen.getByText(/Brak trenera/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Dodaj trenera/ }));
    fireEvent.change(screen.getByLabelText('Nick trenera'), { target: { value: '  White Dance ' } });
    fireEvent.keyDown(screen.getByLabelText('Nick trenera'), { key: 'Enter' });
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('White Dance'));
  });

  it('changes and removes an existing coach', async () => {
    const { onSave } = setup({ coachNickname: 'Kubox' });
    fireEvent.click(screen.getByRole('button', { name: /Zmień/ }));
    fireEvent.change(screen.getByLabelText('Nick trenera'), { target: { value: 'Ducho' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz trenera' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('Ducho'));
    fireEvent.click(screen.getByRole('button', { name: /Usuń/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(null));
  });

  it('blocks changes while locked and says why', () => {
    setup({ coachNickname: 'Kubox', lock: locked });
    expect(screen.queryByRole('button', { name: /Zmień|Usuń|Dodaj/ })).toBeNull();
    expect(screen.getByText(/mniej niż 24 h/)).toBeTruthy();
  });

  it('is read-only for players who are not the captain', () => {
    setup({ coachNickname: 'Kubox', isCaptain: false });
    expect(screen.getByText('Kubox')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
