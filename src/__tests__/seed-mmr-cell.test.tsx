import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SeedMmrCell, type Team } from '@/app/[tournamentSlug]/admin/tabs/TeamsTab';

vi.mock('@/lib/firebase', () => ({ db: {}, auth: {} }));

const team: Team = {
  id: 't1', name: 'Gofry u Ireny', tag: 'GUI', divisionId: 'swiss', divisionName: 'Swiss',
  status: 'pending', playersCount: 5, captainDiscord: 'x', seedMmr: 3200, seedPosition: 4,
};

function setup(overrides: Partial<Team> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(<SeedMmrCell team={{ ...team, ...overrides }} onSave={onSave} accentColor="#8B1538" />);
  return { onSave };
}

const openEditor = () => fireEvent.click(screen.getByRole('button', { name: /Zmień średnie MMR/ }));
const input = () => screen.getByRole('spinbutton', { name: /Średnie MMR drużyny/ }) as HTMLInputElement;

describe('SeedMmrCell', () => {
  it('shows the value with its seed number', () => {
    setup();
    // Thousands separator depends on the locale ("3,200" / "3 200")
    expect(document.body.textContent).toMatch(/3\D?200\s*#4/);
  });

  it('saves a corrected value with Enter', async () => {
    const { onSave } = setup();
    openEditor();
    expect(input().value).toBe('3200');
    fireEvent.change(input(), { target: { value: '2750' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(2750));
    await waitFor(() => expect(screen.queryByRole('spinbutton')).toBeNull());
  });

  it('rejects values outside 1–12000 without saving', () => {
    const { onSave } = setup();
    openEditor();
    fireEvent.change(input(), { target: { value: '15000' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(screen.getByText(/1–12000/)).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('clears the value when emptied, and lets a missing value be added', async () => {
    const { onSave } = setup();
    openEditor();
    fireEvent.change(input(), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz średnie MMR' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(null));
  });

  it('cancels with Escape and skips saving an unchanged value', () => {
    const { onSave } = setup();
    openEditor();
    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(screen.queryByRole('spinbutton')).toBeNull();
    openEditor();
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows "nie podano" for teams without a value', () => {
    setup({ seedMmr: undefined, seedPosition: undefined });
    expect(screen.getByText('nie podano')).toBeTruthy();
  });
});
