'use client';

// The account page (/[slug]/account): one full-width banner with everything about the person — click
// the picture to change it, click the name to rename, linked Discord / Steam / Google and their role
// in this tournament — and under it the captain's team (MyTeamView, which replaced the my-team page).
// Everything about the person is read and written through /api/account.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Camera, Check, ExternalLink, ImageIcon, Pencil, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTournament } from '@/context/TournamentContext';
import { C, ink, useHeaderFont } from '@/components/stats-lab/kit';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import MyTeamView from '@/components/team/MyTeamView';

type Source = 'google' | 'discord' | 'steam' | 'url';
interface Account {
  uid: string; nickname: string;
  avatar: { source: Source; url: string | null };
  pictures: Partial<Record<Source, string>>;
  discord: { id: string; username: string; name: string; avatar: string | null } | null;
  steam: { id: string; source: 'discord' | 'inhouse' | 'steam'; avatar: string | null } | null;
  google: { email: string | null } | null;
  admin: boolean;
}

const SOURCE_NAME: Record<Source, string> = { google: 'Google', discord: 'Discord', steam: 'Steam', url: 'Link' };

function Pic({ src, size, name }: { src: string | null | undefined; size: number; name?: string }) {
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt="" referrerPolicy="no-referrer" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
    : <span className="rounded-full shrink-0 flex items-center justify-center font-bold bg-white/10 text-white/60" style={{ width: size, height: size, fontSize: size * 0.4 }}>{(name ?? '?').slice(0, 1).toUpperCase()}</span>;
}

/** One linked account on the banner: what it is above, who you are there below */
function Linked({ k, children, onUnlink }: { k: string; children: React.ReactNode; onUnlink?: () => void }) {
  return (
    <div className="group flex flex-col px-5 first:pl-0 border-l first:border-l-0 border-white/15 min-w-0">
      <span className="text-[9px] uppercase tracking-[0.2em] text-white/55 flex items-center gap-2">
        {k}
        {onUnlink && (
          <button type="button" onClick={onUnlink} aria-label={`Odłącz ${k}`} title={`Odłącz ${k}`} className="opacity-0 group-hover:opacity-70 focus:opacity-100 hover:!opacity-100 transition-opacity">
            <X className="w-3 h-3" />
          </button>
        )}
      </span>
      <span className="mt-1 text-[15px] font-bold truncate flex items-center gap-2">{children}</span>
    </div>
  );
}
const Connect = ({ onClick }: { onClick: () => void }) => (
  <button type="button" onClick={onClick} className="underline-offset-4 hover:underline" style={{ color: 'color-mix(in srgb, var(--tournament-primary) 65%, #fff)' }}>Połącz</button>
);

export default function AccountPage() {
  const { user, loading, signIn, linkDiscord, connectSteam, signOut } = useAuth();
  const { tournament, getTournamentPath } = useTournament();
  const font = useHeaderFont();
  const [acc, setAcc] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [naming, setNaming] = useState(false);
  const [nick, setNick] = useState('');
  const [link, setLink] = useState('');
  const [picking, setPicking] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const call = useCallback(async (method: 'GET' | 'PUT', body?: object) => {
    const token = await user!.getIdToken();
    const r = await fetch(`/api/account${tournament?.id ? `?t=${encodeURIComponent(tournament.id)}` : ''}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Coś poszło nie tak');
    return j;
  }, [user, tournament?.id]);
  useEffect(() => {
    if (!user) return;
    call('GET').then((a: Account) => { setAcc(a); setLink(a.pictures.url ?? ''); }).catch(e => setError(e.message));
  }, [user, call]);
  useEffect(() => { if (naming) nameRef.current?.select(); }, [naming]);

  const save = async (body: object) => {
    setBusy(true); setError(null);
    try { setAcc(await call('PUT', body) as Account); return true; } catch (e) { setError((e as Error).message); return false; } finally { setBusy(false); }
  };
  const saveName = async () => {
    const v = nick.trim();
    if (!acc || v === acc.nickname || !v) { setNaming(false); return; }
    if (await save({ nickname: v })) setNaming(false);
  };

  if (loading) return null;
  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <button type="button" onClick={signIn} className="rounded-full px-10 py-4 font-logik-extended-bold uppercase tracking-widest text-white text-[15px]" style={{ background: C.primary, ...font }}>Zaloguj się</button>
      </div>
    );
  }
  if (!acc) return <div className="min-h-[60vh] flex items-center justify-center" style={{ color: C.muted }}>{error ?? 'Wczytuję konto…'}</div>;

  const picture = acc.avatar.url ?? user.photoURL;
  const choices = (['discord', 'steam', 'google'] as Source[]).filter(s => acc.pictures[s]);

  return (
    <div className="w-full" style={{ color: C.text }}>
      <div className="relative overflow-hidden text-white" style={{ background: '#0b0b10' }}>
        {picture && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={picture} alt="" aria-hidden referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover scale-150" style={{ filter: 'blur(48px) brightness(0.5) saturate(1.5)' }} />
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.8), rgba(0,0,0,0.45))' }} />
        <div className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: C.primary }} />

        <div className="relative max-w-[1680px] mx-auto px-4 lg:px-14 py-8 sm:py-10 flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-10">
          {/* The picture: click to choose another */}
          <Popover open={picking} onOpenChange={setPicking}>
            <PopoverTrigger asChild>
              <button type="button" aria-label="Zmień zdjęcie" className="group relative self-start sm:self-auto rounded-full shrink-0 outline-none focus-visible:ring-2 ring-white/70">
                <Pic src={picture} size={150} name={acc.nickname} />
                <span className="absolute inset-0 rounded-full flex items-center justify-center bg-black/55 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                  <Camera className="w-8 h-8" />
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[340px] p-5">
              <div className="flex flex-wrap gap-5">
                {[...choices, ...(acc.pictures.url ? ['url' as Source] : [])].map(s => {
                  const on = acc.avatar.source === s;
                  return (
                    <button key={s} type="button" disabled={busy} onClick={async () => { if (await save({ avatar: { source: s, ...(s === 'url' ? { url: acc.pictures.url } : {}) } })) setPicking(false); }}
                      className="flex flex-col items-center gap-1.5">
                      <span className="relative rounded-full" style={{ boxShadow: on ? `0 0 0 3px ${C.primary}` : `0 0 0 1px ${ink(15)}` }}>
                        <Pic src={acc.pictures[s]} size={56} />
                        {on && <span className="absolute -right-1 -bottom-1 w-5 h-5 rounded-full flex items-center justify-center text-white" style={{ background: C.primary }}><Check className="h-3 w-3" /></span>}
                      </span>
                      <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: on ? C.heading : C.muted }}>{SOURCE_NAME[s]}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-5 flex items-end gap-3">
                <ImageIcon className="w-4 h-4 mb-2 shrink-0" style={{ color: C.muted }} />
                <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://… link do obrazka"
                  onKeyDown={async e => { if (e.key === 'Enter' && link) { if (await save({ avatar: { source: 'url', url: link } })) setPicking(false); } }}
                  className="flex-1 min-w-0 bg-transparent border-b py-1.5 text-[14px] outline-none focus:border-[var(--tournament-primary)]" style={{ borderColor: ink(20), color: C.text }} />
                {link && link !== acc.pictures.url && (
                  <button type="button" disabled={busy} onClick={async () => { if (await save({ avatar: { source: 'url', url: link } })) setPicking(false); }}
                    className="text-[12px] font-bold uppercase tracking-widest hover:underline underline-offset-4" style={{ color: C.primary }}>Użyj</button>
                )}
              </div>
              {error && <div className="mt-3 text-[13px] font-bold" style={{ color: C.loss }}>{error}</div>}
            </PopoverContent>
          </Popover>

          <div className="flex-1 min-w-0">
            {/* The name: click to rename */}
            {naming ? (
              <input ref={nameRef} value={nick} maxLength={32} onChange={e => setNick(e.target.value)} onBlur={saveName}
                onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setNaming(false); }}
                className="w-full bg-transparent outline-none border-b-2 border-white/40 focus:border-white font-logik-extended-bold uppercase leading-[0.95]"
                style={{ fontSize: 'clamp(34px, 4.5vw, 64px)', ...font }} aria-label="Nick" />
            ) : (
              <button type="button" onClick={() => { setNick(acc.nickname); setNaming(true); }} className="group flex items-center gap-4 text-left max-w-full" aria-label="Zmień nick">
                <h1 className="font-logik-extended-bold uppercase leading-[0.95] break-words min-w-0" style={{ fontSize: 'clamp(34px, 4.5vw, 64px)', ...font }}>{acc.nickname || 'Bez nicku'}</h1>
                <Pencil className="w-6 h-6 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
              </button>
            )}
            {error && !picking && <div className="mt-2 text-[13px] font-bold text-[#ff8a80]">{error}</div>}

            <div className="flex flex-wrap items-end gap-y-4 mt-6">
              <Linked k="Discord" onUnlink={acc.discord && acc.google ? () => save({ unlink: 'discord' }) : undefined}>
                {acc.discord ? <span className="truncate">@{acc.discord.username}</span> : <Connect onClick={linkDiscord} />}
              </Linked>
              <Linked k="Steam" onUnlink={acc.steam ? () => save({ unlink: acc.steam!.id }) : undefined}>
                {acc.steam ? (
                  <a href={`https://steamcommunity.com/profiles/${acc.steam.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:underline underline-offset-4">
                    <Pic src={acc.steam.avatar} size={20} name="S" />Profil<ExternalLink className="w-3.5 h-3.5 opacity-60" />
                  </a>
                ) : <Connect onClick={connectSteam} />}
              </Linked>
              {acc.google && <Linked k="Google"><span className="truncate">{acc.google.email ?? 'połączony'}</span></Linked>}
              {acc.admin && (
                <Linked k="Rola">
                  <Link href={getTournamentPath('/admin')} className="hover:underline underline-offset-4">Admin</Link>
                </Linked>
              )}
            </div>
          </div>

          <button type="button" onClick={signOut} className="self-start sm:self-center text-[12px] font-bold uppercase tracking-widest text-white/70 hover:text-white hover:underline underline-offset-4">
            Wyloguj się
          </button>
        </div>
      </div>

      <MyTeamView embedded />
    </div>
  );
}
