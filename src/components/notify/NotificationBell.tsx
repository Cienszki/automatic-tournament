'use client';

// The bell in the navbar: the account's notifications (/api/inbox), newest first. Opening it marks
// everything read (what was new stays highlighted until it closes). The Discord view chooses which
// kinds also come as a DM, says why DMs don't arrive when Discord refuses them, and sends a test.

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bell, ChevronLeft } from 'lucide-react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { NavLogin } from '@/components/auth/NavLogin';
import { useTournament } from '@/context/TournamentContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { C, ink } from '@/components/stats-lab/kit';
import { count } from '@/lib/plural';
import { NOTIFY_ORDER, NOTIFY_TYPES, type InboxItem, type NotifyType } from '@/lib/notify-types';

interface Inbox {
  items: InboxItem[];
  unread: number;
  discord: { linked: boolean; problem: string | null; on: Record<NotifyType, boolean> };
  test?: 'sent' | 'blocked' | 'failed' | 'off';
}

const POLL_MS = 90_000;

function DiscordMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.4 18.4 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.4C.6 9 0 13.6.3 18.1a19.9 19.9 0 0 0 6 3l1.3-2.1a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.8 19.8 0 0 0 6-3c.5-5.2-.8-9.7-3.6-13.7ZM8.5 15.4c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4Zm7 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4Z" />
    </svg>
  );
}

/** "**bold**" in the text (the same text goes to Discord, which renders it itself) */
function Rich({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*)/).map((p, i) => p.startsWith('**') && p.endsWith('**') ? <b key={i} style={{ color: C.heading }}>{p.slice(2, -2)}</b> : <React.Fragment key={i}>{p}</React.Fragment>)}</>;
}

function ago(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return 'przed chwilą';
  if (min < 60) return `${count(min, 'minutę', 'minuty', 'minut')} temu`;
  const h = Math.round(min / 60);
  if (h < 24) return `${count(h, 'godzinę', 'godziny', 'godzin')} temu`;
  if (h < 48) return 'wczoraj';
  return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' });
}

export function NotificationBell({ color }: { color?: string }) {
  const { user, loading } = useAuth();
  const { tournament, getTournamentPath } = useTournament();
  const router = useRouter();
  const [box, setBox] = useState<Inbox | null>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'list' | 'discord'>('list');
  /** Items that were unread when the bell opened: they stay highlighted while it's open */
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const call = useCallback(async (method: 'GET' | 'POST' | 'PUT', body?: object): Promise<Inbox> => {
    const token = await user!.getIdToken();
    const r = await fetch('/api/inbox', { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Coś poszło nie tak');
    return j;
  }, [user]);

  // Poll while the tab is visible
  useEffect(() => {
    if (!user) { setBox(null); return; }
    let stop = false;
    const load = () => { if (document.visibilityState === 'visible') call('GET').then(b => { if (!stop) setBox(b); }).catch(() => {}); };
    load();
    const t = setInterval(load, POLL_MS);
    document.addEventListener('visibilitychange', load);
    // Something new arrives → at once (the poll above is only the fallback). Others on the page hear
    // about it too: the card game refreshes its challenges on a 'duel' one.
    let first = true;
    const unsub = onSnapshot(query(collection(db, 'accounts', user.uid, 'inbox'), orderBy('createdAt', 'desc'), limit(1)), snap => {
      if (first) { first = false; return; }
      const d = snap.docs[0]?.data();
      if (!d) return;
      call('GET').then(b => { if (!stop) setBox(b); }).catch(() => {});
      window.dispatchEvent(new CustomEvent('inbox:new', { detail: { type: d.type, href: d.href } }));
    }, () => { /* rules not deployed yet, or offline: the poll still works */ });
    return () => { stop = true; clearInterval(t); document.removeEventListener('visibilitychange', load); unsub(); };
  }, [user, call]);

  const onOpen = (o: boolean) => {
    setOpen(o); setError(null);
    if (!o) { setView('list'); setFresh(new Set()); return; }
    const unread = box?.items.filter(i => !i.read).map(i => i.id) ?? [];
    setFresh(new Set(unread));
    if (box?.unread) call('POST', { read: 'all' }).then(setBox).catch(() => {});
    else call('GET').then(setBox).catch(() => {});
  };

  const toggle = async (t: NotifyType, on: boolean) => {
    if (!box) return;
    setBox({ ...box, discord: { ...box.discord, on: { ...box.discord.on, [t]: on } } });
    try { setBox(await call('PUT', { discord: { [t]: on } })); } catch (e) { setError((e as Error).message); }
  };
  const test = async () => {
    setTesting(true); setError(null);
    try {
      const b = await call('POST', { test: true });
      setBox(b);
      if (b.test === 'failed' || b.test === 'off') setError('Nie udało się wysłać wiadomości. Spróbuj później.');
    } catch (e) { setError((e as Error).message); } finally { setTesting(false); }
  };

  // Visitors get the way in instead
  if (!user) return loading ? null : <NavLogin color={color} />;
  const unread = box?.unread ?? 0;
  const dmOn = box ? NOTIFY_ORDER.filter(t => box.discord.on[t]).length : 0;

  return (
    <Popover open={open} onOpenChange={onOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={unread ? `Powiadomienia: ${unread} nowych` : 'Powiadomienia'}
          className="relative self-stretch px-3 flex items-center hover:opacity-80 transition-opacity" style={{ color }}>
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute top-1/2 left-1/2 -translate-y-[calc(50%+9px)] translate-x-[2px] min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold leading-4 text-center text-white" style={{ background: C.primary }}>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-[400px] max-w-[calc(100vw-16px)] p-0 overflow-hidden">
        {view === 'list' ? (
          <>
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <span className="text-[15px] font-bold" style={{ color: C.heading }}>Powiadomienia</span>
              <button type="button" onClick={() => setView('discord')} className="flex items-center gap-1.5 text-[12px] font-bold hover:underline underline-offset-4" style={{ color: C.muted }}
                title="Wybierz, co ma przychodzić na Discordzie">
                <DiscordMark className="w-4 h-4" />
                {box?.discord.linked ? (dmOn ? `${dmOn} z ${NOTIFY_ORDER.length} na Discordzie` : 'Discord wyłączony') : 'Discord'}
              </button>
            </div>
            <div className="max-h-[min(70vh,560px)] overflow-y-auto border-t" style={{ borderColor: ink(10) }}>
              {!box ? (
                <div className="px-5 py-8 text-[13px]" style={{ color: C.muted }}>Wczytuję…</div>
              ) : box.items.length === 0 ? (
                <div className="px-5 py-8 text-[13px]" style={{ color: C.muted }}>
                  Tu pojawią się propozycje terminów, prośby o standina, przypomnienia o meczach i wiadomości od organizatorów.
                </div>
              ) : box.items.map(i => {
                const row = (
                  <div className="relative px-5 py-3.5 border-b last:border-b-0" style={{ borderColor: ink(8), background: fresh.has(i.id) ? `color-mix(in srgb, ${C.primary} 9%, transparent)` : undefined }}>
                    {fresh.has(i.id) && <span className="absolute left-2 top-[22px] w-1.5 h-1.5 rounded-full" style={{ background: C.primary }} />}
                    <div className="text-[14px] font-bold leading-snug" style={{ color: C.heading }}>{i.title}</div>
                    <div className="mt-1 text-[13px] leading-snug whitespace-pre-line" style={{ color: C.text }}><Rich text={i.body} /></div>
                    <div className="mt-1.5 text-[11px]" style={{ color: C.muted }}>{[i.tournament, ago(i.at)].filter(Boolean).join(' · ')}</div>
                  </div>
                );
                return i.href
                  ? <button key={i.id} type="button" className="block w-full text-left hover:brightness-125" onClick={() => { setOpen(false); router.push(i.href!); }}>{row}</button>
                  : <div key={i.id}>{row}</div>;
              })}
            </div>
          </>
        ) : (
          <div className="pb-4">
            <button type="button" onClick={() => { setView('list'); setError(null); }} className="flex items-center gap-1 px-4 pt-4 pb-3 text-[15px] font-bold" style={{ color: C.heading }}>
              <ChevronLeft className="w-4 h-4" />Na Discordzie
            </button>
            {!box?.discord.linked ? (
              <div className="px-5 py-3 text-[13px] border-t" style={{ borderColor: ink(10), color: C.text }}>
                <Link href={getTournamentPath('/account')} onClick={() => setOpen(false)} className="font-bold hover:underline underline-offset-4" style={{ color: C.primary }}>Połącz konto z Discordem</Link>,
                {' '}a bot napisze do ciebie, gdy coś się wydarzy.
              </div>
            ) : (
              <>
                {box.discord.problem === 'blocked' && (
                  <div className="px-5 py-3 text-[13px] border-t" style={{ borderColor: ink(10), color: C.loss }}>
                    Discord nie pozwala botowi do ciebie napisać. Dołącz do
                    {tournament?.discordUrl ? <> <a href={tournament.discordUrl} target="_blank" rel="noreferrer" className="font-bold underline underline-offset-4">serwera turnieju</a></> : ' serwera turnieju'}
                    {' '}i włącz wiadomości prywatne od jego członków.
                  </div>
                )}
                <div className="border-t" style={{ borderColor: ink(10) }}>
                  {NOTIFY_ORDER.map(t => (
                    <label key={t} className="flex items-center gap-4 px-5 py-3 border-b cursor-pointer" style={{ borderColor: ink(8) }}>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14px] font-bold" style={{ color: C.heading }}>{NOTIFY_TYPES[t].label}</span>
                        <span className="block text-[12px]" style={{ color: C.muted }}>{NOTIFY_TYPES[t].hint}</span>
                      </span>
                      <Switch checked={box.discord.on[t]} onCheckedChange={v => toggle(t, v)} />
                    </label>
                  ))}
                </div>
                <div className="px-5 pt-3 flex items-center gap-3 text-[12px]">
                  <button type="button" disabled={testing} onClick={test} className="font-bold uppercase tracking-widest hover:underline underline-offset-4 disabled:opacity-50" style={{ color: C.primary }}>
                    {testing ? 'Wysyłam…' : 'Wyślij próbną wiadomość'}
                  </button>
                  {box.test === 'sent' && <span style={{ color: C.win }}>Wysłana, sprawdź Discord.</span>}
                </div>
              </>
            )}
            {error && <div className="px-5 pt-3 text-[13px] font-bold" style={{ color: C.loss }}>{error}</div>}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
