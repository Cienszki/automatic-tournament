import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AccountMergeDialog } from '@/components/auth/AccountMergeDialog';

vi.mock('@/lib/firebase', () => ({ auth: { currentUser: { getIdToken: async () => 'token' } }, db: {}, storage: {} }));
const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

const preview = {
  discord: { username: 'emsababnur', name: 'Maruda' },
  tournaments: [
    { key: 'pdl-s2', name: 'Polish Dota League Sezon 2', other: { cards: 50, packs: 0, games: 3 }, mine: null },
    { key: 'wiosenna', name: 'Wiosenna Furia', other: { cards: 12, packs: 1, games: 0 }, mine: { cards: 0, packs: 10, games: 0 } },
  ],
  steam: 'moves',
};

describe('AccountMergeDialog', () => {
  let posted: unknown = null;
  beforeEach(() => {
    posted = null;
    Object.defineProperty(window, 'location', { value: { ...window.location, reload: vi.fn() }, writable: true });
    global.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') { posted = JSON.parse(String(init.body)); return new Response(JSON.stringify({ ok: true })); }
      return new Response(JSON.stringify(preview));
    }) as unknown as typeof fetch;
  });

  it('lists what moves and waits for the choice where both accounts have cards', async () => {
    render(<AccountMergeDialog id="ticket123456" onClose={() => {}} />);
    expect(await screen.findByText('@emsababnur')).toBeTruthy();
    expect(screen.getByText('Karty · Polish Dota League Sezon 2')).toBeTruthy();
    expect(screen.getByText('50 kart · 0 paczek · 3 mecze w rankingu')).toBeTruthy();
    expect(screen.getByText('Wiosenna Furia: zostaw jedną kolekcję kart')).toBeTruthy();
    expect(screen.getByText('przejdzie tutaj')).toBeTruthy();

    const go = screen.getByRole('button', { name: 'Połącz konta' }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Z Discorda/ }));
    expect(go.disabled).toBe(false);

    fireEvent.click(go);
    await waitFor(() => expect(posted).toEqual({ id: 'ticket123456', keep: { wiosenna: 'other' } }));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Konta połączone' }));
  });
});
