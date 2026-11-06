'use client';

// After an admin sets match times: "tell the teams and casters?" The admin decides each time (a
// typo fixed a minute later shouldn't ping anyone). Yes → /api/notify 'match_time'; captains and
// the match's casters hear the time, and with `fresh` (new matches) all the tournament's casters
// get one message with the matches they can pick.
//
//   const notifyPrompt = useNotifyPrompt();
//   …after saving: await notifyPrompt.ask({ ids, fresh: true });
//   …in the JSX:   {notifyPrompt.dialog}

import React, { useCallback, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTournament } from '@/context/TournamentContext';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { count } from '@/lib/plural';

interface Ask { ids: string[]; fresh: boolean }

export function useNotifyPrompt() {
  const { user } = useAuth();
  const { tournament } = useTournament();
  const { toast } = useToast();
  const [open, setOpen] = useState<Ask | null>(null);
  const done = useRef<(() => void) | null>(null);
  /** The question being answered: a button click and the dialog's own close both arrive — only the first counts */
  const pending = useRef<Ask | null>(null);

  /** Resolves once the admin answered (and the notifications were sent, when they said yes) */
  const ask = useCallback((a: Ask) => new Promise<void>(resolve => {
    if (!a.ids.length) { resolve(); return; }
    done.current = resolve;
    pending.current = a;
    setOpen(a);
  }), []);

  const answer = async (yes: boolean) => {
    const a = pending.current;
    if (!a) return;
    pending.current = null;
    setOpen(null);
    if (yes && user && tournament?.id) {
      try {
        const r = await fetch('/api/notify', {
          method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ t: tournament.id, event: 'match_time', ids: a.ids, fresh: a.fresh }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error);
        toast({ title: 'Powiadomienia wysłane', description: j.sent ? `Wysłano do ${count(j.sent, 'osoby', 'osób', 'osób')}.` : 'Nikt z odbiorców nie ma jeszcze konta na stronie.' });
      } catch (e) {
        toast({ title: 'Nie udało się wysłać powiadomień', description: (e as Error).message || undefined, variant: 'destructive' });
      }
    }
    done.current?.();
    done.current = null;
  };

  const dialog = (
    <AlertDialog open={!!open} onOpenChange={o => { if (!o) answer(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Powiadomić o {open && open.ids.length > 1 ? 'nowych terminach' : 'nowym terminie'}?</AlertDialogTitle>
          <AlertDialogDescription>
            {open?.fresh
              ? 'Kapitanowie dostaną termin swojego meczu, a casterzy turnieju listę meczów do wzięcia (na stronie i na Discordzie, jeśli to wybrali).'
              : 'Kapitanowie obu drużyn i casterzy tego meczu dostaną nowy termin (na stronie i na Discordzie, jeśli to wybrali).'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => answer(false)}>Nie</AlertDialogCancel>
          <AlertDialogAction onClick={() => answer(true)}>Powiadom</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { ask, dialog };
}
