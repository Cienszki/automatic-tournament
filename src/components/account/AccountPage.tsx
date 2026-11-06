'use client';

// The account page (/[slug]/account), in the teams section's language: a banner with the person's
// picture and name, then three plain columns under rules — profile, linked accounts,
// roles and cards. No cards, no boxes. Everything is read and written through /api/account.

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, ExternalLink, ImageIcon, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTournament } from '@/context/TournamentContext';
import { C, TeamLogo, ink, mix, useHeaderFont } from '@/components/stats-lab/kit';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { count } from '@/lib/plural';

type Source = 'google' | 'discord' | 'steam' | 'url';
interface Account {
  uid: string; nickname: string;
  avatar: { source: Source; url: string | null };
  pictures: Partial<Record<Source, string>>;
  discord: { id: string; username: string; name: string; avatar: string | null } | null;
  steam: Array<{ id: string; source: 'discord' | 'inhouse' | 'steam'; avatar: string | null }>;
  google: { email: string | null } | null;
  superAdmin: boolean;
  tournaments: Array<{ id: string; name: string; slug: string; admin: boolean; teams: Array<{ id: string; name: string; tag?: string; logoUrl?: string }> }>;
  cards: Array<{ tournament: string; name: string; slug: string; cards: number; packs: number }>;
}

const SOURCE_NAME: Record<Source, string> = { google: 'Google', discord: 'Discord', steam: 'Steam', url: 'Link' };
const STEAM_FROM: Record<string, string> = { discord: 'z Twojego Discorda', inhouse: 'z dota2inhouse.pl', steam: 'zalogowano na Steam' };
const DISCORD = '#5865F2';

/** Column heading on a rule that starts in the tournament colour (as in Herby) */
function Label({ children }: { children: React.ReactNode }) {
  const font = useHeaderFont();
  return (
    <div className="shrink-0 mb-4">
      <h2 className="text-[11px] font-logik-extended-bold uppercase tracking-[0.22em]" style={{ color: C.primary, ...font }}>
        {children}
      </h2>
      <div className="relative h-px mt-1.5" style={{ background: ink(12) }}>
        <span className="absolute left-0 top-0 h-px w-10" style={{ background: C.primary }} />
      </div>
    </div>
  );
}
const Sub = ({ children }: { children: React.ReactNode }) => <div className="text-[10px] uppercase tracking-[0.2em] mb-2" style={{ color: C.muted }}>{children}</div>;
/** A text action, like the links in the teams section */
function Act({ children, onClick, danger, disabled }: { children: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="text-[12px] font-bold uppercase tracking-widest underline-offset-4 hover:underline disabled:opacity-40 disabled:no-underline whitespace-nowrap"
      style={{ color: danger ? C.loss : C.primary }}>{children}</button>
  );
}
function Pic({ src, size, name }: { src: string | null | undefined; size: number; name?: string }) {
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt="" referrerPolicy="no-referrer" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
    : <span className="rounded-full shrink-0 flex items-center justify-center font-bold" style={{ width: size, height: size, background: ink(10), color: C.muted, fontSize: size * 0.4 }}>{(name ?? '?').slice(0, 1).toUpperCase()}</span>;
}
/** One row of a list: rules between rows, nothing around them */
const Row = ({ children }: { children: React.ReactNode }) => <div className="flex items-center gap-3 py-3 border-b last:border-b-0" style={{ borderColor: ink(8) }}>{children}</div>;

export default function AccountPage() {
  const { user, loading, signIn, linkDiscord, connectSteam, signOut } = useAuth();
  const { getTournamentPath } = useTournament();
  const font = useHeaderFont();
  const [acc, setAcc] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nick, setNick] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const call = useCallback(async (method: 'GET' | 'PUT' | 'DELETE', body?: object) => {
    const token = await user!.getIdToken();
    const r = await fetch('/api/account', { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Coś poszło nie tak');
    return j;
  }, [user]);
  const load = useCallback(() => { call('GET').then((a: Account) => { setAcc(a); setNick(a.nickname); setLink(a.pictures.url ?? ''); }).catch(e => setError(e.message)); }, [call]);
  useEffect(() => { if (user) load(); }, [user, load]);
  const save = async (body: object) => {
    setBusy(true); setError(null);
    try { const a = await call('PUT', body) as Account; setAcc(a); setNick(a.nickname); } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };

  if (loading) return null;
  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-5" style={{ color: C.text }}>
        <h1 className="font-logik-extended-bold uppercase text-[44px] leading-none" style={{ color: C.heading, ...font }}>Konto</h1>
        <button type="button" onClick={signIn} className="rounded-full px-9 py-3.5 font-logik-extended-bold uppercase tracking-widest text-white" style={{ background: C.primary, ...font }}>Zaloguj się</button>
      </div>
    );
  }
  if (!acc) return <div className="min-h-[60vh] flex items-center justify-center" style={{ color: C.muted }}>{error ?? 'Wczytuję konto…'}</div>;

  const picture = acc.avatar.url ?? user.photoURL;
  const roles = acc.tournaments.flatMap(t => [
    ...(t.admin ? [{ key: `a${t.id}`, icon: <ShieldCheck className="h-5 w-5" />, what: 'Admin', where: t.name, href: `/${t.slug}/admin` }] : []),
    ...t.teams.map(team => ({ key: `c${team.id}`, icon: <TeamLogo team={team} size={22} />, what: `Kapitan · ${team.name}`, where: t.name, href: `/${t.slug}/my-team` })),
  ]);

  return (
    <div className="w-full" style={{ color: C.text }}>
      {/* Banner: the picture, blurred behind, and the name */}
      <div className="relative overflow-hidden text-white" style={{ background: '#0b0b10' }}>
        {picture && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={picture} alt="" aria-hidden referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover scale-150" style={{ filter: 'blur(48px) brightness(0.5) saturate(1.5)' }} />
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.78), rgba(0,0,0,0.45))' }} />
        <div className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: C.primary }} />
        <div className="relative max-w-[1680px] mx-auto px-4 lg:px-14 py-10 flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-10">
          <Pic src={picture} size={150} name={acc.nickname} />
          <div className="min-w-0">
            <h1 className="font-logik-extended-bold uppercase leading-[0.95] break-words" style={{ fontSize: 'clamp(34px, 4.5vw, 64px)', ...font }}>{acc.nickname || 'Bez nicku'}</h1>
          </div>
        </div>
      </div>

      <div className="max-w-[1680px] mx-auto px-4 lg:px-14 py-8 grid gap-10 lg:grid-cols-3">
        {/* 1 · Profile */}
        <section>
          <Label>Profil</Label>
          <Sub>Nick</Sub>
          <div className="flex items-end gap-3">
            <input value={nick} onChange={e => setNick(e.target.value)} maxLength={32} onKeyDown={e => { if (e.key === 'Enter' && nick !== acc.nickname) save({ nickname: nick }); }}
              className="flex-1 min-w-0 bg-transparent border-b-2 py-1.5 text-[20px] font-bold outline-none focus:border-[var(--tournament-primary)]" style={{ borderColor: ink(20), color: C.heading }} />
            {nick !== acc.nickname && <Act onClick={() => save({ nickname: nick })} disabled={busy}>Zapisz</Act>}
          </div>
          <div className="mt-7"><Sub>Zdjęcie</Sub></div>
          <div className="flex flex-wrap gap-5">
            {(['discord', 'steam', 'google', 'url'] as Source[]).filter(s => s === 'url' || acc.pictures[s]).map(s => {
              const on = acc.avatar.source === s;
              return (
                <button key={s} type="button" disabled={busy || (s === 'url' && !acc.pictures.url)} onClick={() => save({ avatar: { source: s, ...(s === 'url' ? { url: acc.pictures.url } : {}) } })}
                  className="flex flex-col items-center gap-1.5 disabled:cursor-default">
                  <span className="relative rounded-full" style={{ boxShadow: on ? `0 0 0 3px ${C.primary}` : `0 0 0 1px ${ink(15)}` }}>
                    {s === 'url' && !acc.pictures.url
                      ? <span className="w-14 h-14 rounded-full flex items-center justify-center" style={{ color: C.muted }}><ImageIcon className="h-6 w-6" /></span>
                      : <Pic src={acc.pictures[s]} size={56} />}
                    {on && <span className="absolute -right-1 -bottom-1 w-5 h-5 rounded-full flex items-center justify-center text-white" style={{ background: C.primary }}><Check className="h-3 w-3" /></span>}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: on ? C.heading : C.muted }}>{SOURCE_NAME[s]}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex items-end gap-3">
            <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://… link do obrazka"
              className="flex-1 min-w-0 bg-transparent border-b py-1.5 text-[14px] outline-none focus:border-[var(--tournament-primary)]" style={{ borderColor: ink(20), color: C.text }} />
            {link && link !== acc.pictures.url && <Act onClick={() => save({ avatar: { source: 'url', url: link } })} disabled={busy}>Użyj</Act>}
          </div>
          {error && <div className="mt-3 text-[13px] font-bold" style={{ color: C.loss }}>{error}</div>}
        </section>

        {/* 2 · Linked accounts */}
        <section>
          <Label>Połączone konta</Label>
          <Row>
            <span className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: DISCORD }}>D</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold" style={{ color: C.heading }}>Discord</div>
              <div className="text-[13px] truncate" style={{ color: C.muted }}>{acc.discord ? `@${acc.discord.username}` : 'Logowanie jednym kliknięciem, wiadomości od bota'}</div>
            </div>
            {acc.discord
              ? (acc.google && <Act onClick={() => save({ unlink: 'discord' })} danger disabled={busy}>Odłącz</Act>)
              : <Act onClick={linkDiscord}>Połącz</Act>}
          </Row>
          {acc.steam.map(st => (
            <Row key={st.id}>
              <Pic src={st.avatar} size={40} name="S" />
              <div className="flex-1 min-w-0">
                <div className="font-bold flex items-center gap-2" style={{ color: C.heading }}>Steam
                  <a href={`https://steamcommunity.com/profiles/${st.id}`} target="_blank" rel="noreferrer" className="opacity-60 hover:opacity-100"><ExternalLink className="h-3.5 w-3.5" /></a>
                </div>
                <div className="text-[13px] truncate" style={{ color: C.muted }}>{STEAM_FROM[st.source]}</div>
              </div>
              <Act onClick={() => save({ unlink: st.id })} danger disabled={busy}>Odłącz</Act>
            </Row>
          ))}
          <Row>
            <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: ink(10), color: C.muted }}>S</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold" style={{ color: C.heading }}>{acc.steam.length ? 'Kolejne konto Steam' : 'Steam'}</div>
              <div className="text-[13px]" style={{ color: C.muted }}>Opcjonalnie. Logujesz się na stronie steamcommunity.com, my nie widzimy hasła.</div>
            </div>
            <Act onClick={connectSteam}>Połącz</Act>
          </Row>
          <Row>
            <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold" style={{ background: ink(10), color: C.muted }}>G</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold" style={{ color: C.heading }}>Google</div>
              <div className="text-[13px] truncate" style={{ color: C.muted }}>{acc.google?.email ?? 'Nie połączono'}</div>
            </div>
          </Row>
        </section>

        {/* 3 · Roles and cards */}
        <section>
          <Label>Role</Label>
          {acc.superAdmin && <Row><ShieldCheck className="h-5 w-5" style={{ color: C.primary }} /><span className="font-bold" style={{ color: C.heading }}>Super admin</span></Row>}
          {roles.map(r => (
            <Row key={r.key}>
              <span className="w-6 flex justify-center" style={{ color: C.primary }}>{r.icon}</span>
              <div className="flex-1 min-w-0"><div className="font-bold truncate" style={{ color: C.heading }}>{r.what}</div><div className="text-[13px] truncate" style={{ color: C.muted }}>{r.where}</div></div>
              <Link href={r.href} className="text-[12px] font-bold uppercase tracking-widest hover:underline underline-offset-4" style={{ color: C.primary }}>Otwórz</Link>
            </Row>
          ))}
          {!acc.superAdmin && !roles.length && <div className="text-[14px] py-3 flex items-center gap-2" style={{ color: C.muted }}><Users className="h-4 w-4" />Brak ról. Kapitanem zostajesz, rejestrując drużynę.</div>}

          <div className="mt-8"><Label>Karty</Label></div>
          {acc.cards.map(c => (
            <Row key={c.tournament}>
              <div className="flex-1 min-w-0"><div className="font-bold truncate" style={{ color: C.heading }}>{c.name}</div>
                <div className="text-[13px]" style={{ color: C.muted }}>{count(c.cards, 'karta', 'karty', 'kart')}{c.packs ? ` · ${count(c.packs, 'paczka', 'paczki', 'paczek')} do otwarcia` : ''}</div></div>
              <Link href={`/${c.slug}/cards`} className="text-[12px] font-bold uppercase tracking-widest hover:underline underline-offset-4" style={{ color: C.primary }}>Otwórz</Link>
            </Row>
          ))}
          {!acc.cards.length && <div className="text-[14px] py-3" style={{ color: C.muted }}>Jeszcze nie zbierasz kart. <Link href={getTournamentPath('/cards')} className="font-bold underline underline-offset-4" style={{ color: C.primary }}>Zacznij</Link></div>}
        </section>
      </div>

      <div className="max-w-[1680px] mx-auto px-4 lg:px-14 pb-12 flex items-center gap-6 border-t pt-5" style={{ borderColor: ink(8) }}>
        <Act onClick={signOut}>Wyloguj się</Act>
        <span className="flex-1" />
        <Act onClick={() => setConfirmDelete(true)} danger>Usuń konto</Act>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć konto?</AlertDialogTitle>
            <AlertDialogDescription>Znikną połączenia z Discordem i Steamem oraz Twoje karty. Drużyny i wyniki turniejów zostają. Tego nie da się cofnąć.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction style={{ background: C.loss }} onClick={async () => { try { await call('DELETE'); await signOut(); } catch (e) { setError((e as Error).message); } }}>Usuń konto</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
