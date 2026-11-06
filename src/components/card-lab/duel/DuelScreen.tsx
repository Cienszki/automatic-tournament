'use client';

// A duel's page (/[slug]/cards/duel/[id]): one screen whatever the moment —
//   anyone with the link    who challenges, and "Przyjmij" (signing in only then)
//   the host, waiting       the link to pass on; the lobby lives while this page is open
//   the guest, getting ready packs → deck (or "Szybka talia") → "Zaczynamy", on a 5-minute hold
//   both, playing           the match (OutpostsGame against a person)

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTournament } from '@/context/TournamentContext';
import { C, ink, mix, useHeaderFont } from '@/components/stats-lab/kit';
import { deckProblem, type GCard } from '@/lib/card-lab/cards';
import { thawCard, type DeckSlots, type FrozenCard } from '@/lib/card-lab/frozen';
import { LOBBY, type Person } from '@/lib/card-lab/pvp';
import { OUTPOSTS_RULE, OutpostsGame } from '../OutpostsGame';
import { CardFace } from '../ui';
import { NameStep } from '../NameStep';
import { duelPost, useDuel } from './useDuel';

const TAKE_KEY = (id: string) => `duel-take:${id}`;

function Face({ p, size, ring }: { p: Person | null; size: number; ring?: string }) {
  const font = useHeaderFont();
  const style = { width: size, height: size, boxShadow: ring ? `0 0 0 4px ${ring}` : undefined };
  if (!p) return <motion.span className="rounded-full flex items-center justify-center font-logik-extended-bold" style={{ ...style, background: ink(6), color: ink(30), fontSize: size * 0.4, ...font }} animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }}>?</motion.span>;
  return p.avatar
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={p.avatar} alt="" referrerPolicy="no-referrer" className="rounded-full object-cover" style={style} />
    : <span className="rounded-full flex items-center justify-center font-logik-extended-bold" style={{ ...style, background: mix(C.primary, 25), color: C.heading, fontSize: size * 0.4, ...font }}>{p.name.slice(0, 1).toUpperCase()}</span>;
}

/** mm:ss to a moment, ticking */
function useLeft(until: number | null, offset = 0) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!until) return; const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, [until]);
  if (!until) return null;
  const sec = Math.max(0, Math.ceil((until - now - offset) / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

function Big({ children, onClick, disabled, busy }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; busy?: boolean }) {
  const font = useHeaderFont();
  return (
    <motion.button type="button" onClick={onClick} disabled={disabled || busy} whileHover={disabled ? undefined : { filter: 'brightness(1.15)' }} whileTap={{ scale: 0.98 }}
      className="h-[76px] px-14 rounded-[6px] font-logik-extended-bold uppercase text-[28px] tracking-wider text-white disabled:opacity-40 flex items-center gap-3"
      style={{ background: `linear-gradient(180deg, ${mix(C.primary, 100)}, ${mix(C.primary, 62)})`, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.3), 0 12px 40px ${mix(C.primary, 40)}`, ...font }}>
      {busy && <Loader2 className="w-6 h-6 animate-spin" />}{children}
    </motion.button>
  );
}
const Quiet = ({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) => (
  <button type="button" onClick={onClick} className="text-[13px] font-bold uppercase tracking-widest underline-offset-4 hover:underline" style={{ color: danger ? C.loss : C.muted }}>{children}</button>
);

/** The two sides of a lobby: you (or the challenger) and the other seat */
function Faceoff({ left, right, title, kicker, children }: { left: Person | null; right: Person | null; title: React.ReactNode; kicker: string; children?: React.ReactNode }) {
  const font = useHeaderFont();
  return (
    <div className="h-full flex flex-col items-center justify-center gap-10" style={{ color: C.text }}>
      <div className="flex items-center gap-16">
        <div className="flex flex-col items-center gap-4 w-[300px]">
          <Face p={left} size={190} ring={C.primary} />
          <span className="font-logik-extended-bold uppercase text-[26px] text-center leading-tight" style={{ color: C.heading, ...font }}>{left?.name}</span>
          {left?.rating != null && <span className="text-[14px] tabular-nums -mt-3" style={{ color: C.muted }}>{left.rating}</span>}
        </div>
        <span className="font-logik-extended-bold uppercase text-[40px]" style={{ color: ink(25), ...font }}>vs</span>
        <div className="flex flex-col items-center gap-4 w-[300px]">
          <Face p={right} size={190} ring={right ? C.loss : undefined} />
          <span className="font-logik-extended-bold uppercase text-[26px] text-center leading-tight" style={{ color: right ? C.heading : C.muted, ...font }}>{right?.name ?? '…'}</span>
        </div>
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="text-[12px] uppercase tracking-[0.3em]" style={{ color: C.muted }}>{kicker}</span>
        <span className="font-logik-extended-bold uppercase text-[44px] leading-none" style={{ color: C.heading, ...font }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

// ── The guest gets ready: packs, deck, go ───────────────────────────────────

function GetReady({ duelKey, onStart, user }: { duelKey: string; onStart: () => Promise<string | null>; user: NonNullable<ReturnType<typeof useAuth>['user']> }) {
  const font = useHeaderFont();
  const [col, setCol] = useState<{ packs: number; cards: GCard[]; slots: DeckSlots } | null>(null);
  const [fresh, setFresh] = useState<GCard[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { getTournamentPath } = useTournament();

  const cards = useCallback(async (method: 'GET' | 'POST', body?: object) => {
    const r = await fetch(method === 'GET' ? `/api/cards?t=${encodeURIComponent(duelKey)}` : '/api/cards', {
      method, headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify({ t: duelKey, ...body }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || 'Coś poszło nie tak'), { need: j.need as string | undefined });
    return j;
  }, [duelKey, user]);
  // No nick and no Discord yet: a name first
  const [needName, setNeedName] = useState(false);
  const load = useCallback(() => cards('GET').then(v => { setNeedName(false); setCol({ packs: v.packs, cards: (v.cards as FrozenCard[]).map(thawCard), slots: v.slots }); })
    .catch(e => { if (e.need === 'name') setNeedName(true); else setError(e.message); }), [cards]);
  useEffect(() => { load(); }, [load]);

  const deck = useMemo(() => { if (!col) return []; const by = new Map(col.cards.map(c => [c.id, c])); return Object.values(col.slots).map(id => by.get(id)).filter((c): c is GCard => !!c); }, [col]);
  const problem = col ? deckProblem(deck, OUTPOSTS_RULE) : 'Wczytuję';

  const openAll = async () => {
    setBusy('packs'); setError(null);
    try {
      let left = col?.packs ?? 0;
      while (left > 0) {
        const r = await cards('POST', { action: 'open' });
        const got = (r.opened as FrozenCard[]).map(thawCard);
        setFresh(f => [...f, ...got]); left = r.packs;
        setCol(c => (c ? { ...c, packs: r.packs, cards: [...c.cards, ...got] } : c));
      }
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };
  const quick = async () => {
    setBusy('deck'); setError(null);
    try { const r = await cards('POST', { action: 'quick' }); setCol(c => (c ? { ...c, slots: r.slots } : c)); }
    catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };
  const start = async () => { setBusy('start'); setError(await onStart()); setBusy(null); };

  if (needName) return <div className="w-[760px]"><NameStep compact onDone={load} /></div>;
  if (!col) return <div className="flex items-center gap-2" style={{ color: C.muted }}><Loader2 className="w-5 h-5 animate-spin" />Wczytuję twoje karty</div>;
  const step = (n: number, done: boolean, title: string, body: React.ReactNode) => (
    <div className="flex items-start gap-5 py-4 border-b" style={{ borderColor: ink(10) }}>
      <span className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center font-logik-extended-bold text-[16px]" style={{ background: done ? C.win : ink(10), color: done ? '#06150b' : C.heading, ...font }}>{done ? <Check className="w-5 h-5" /> : n}</span>
      <div className="flex-1 min-w-0">
        <div className="font-logik-extended-bold uppercase text-[18px]" style={{ color: C.heading, ...font }}>{title}</div>
        <div className="mt-1.5 text-[15px]" style={{ color: C.text }}>{body}</div>
      </div>
    </div>
  );
  return (
    <div className="w-[760px] flex flex-col">
      {step(1, col.packs === 0 && col.cards.length > 0, 'Karty',
        col.packs > 0 ? (
          <div className="flex items-center gap-4">
            <span>Masz {col.packs} paczek z kartami graczy tego turnieju.</span>
            <button type="button" disabled={!!busy} onClick={openAll} className="font-bold uppercase tracking-widest text-[13px] hover:underline underline-offset-4 disabled:opacity-50 flex items-center gap-2" style={{ color: C.primary }}>
              {busy === 'packs' && <Loader2 className="w-4 h-4 animate-spin" />}Otwórz wszystkie
            </button>
          </div>
        ) : `${col.cards.length} kart w kolekcji.`)}
      {fresh.length > 0 && (
        <div className="flex flex-wrap gap-1.5 py-3 max-h-[200px] overflow-hidden">
          {fresh.slice(-30).map(c => <motion.div key={c.id} initial={{ scale: 0.6, opacity: 0, rotateY: 90 }} animate={{ scale: 1, opacity: 1, rotateY: 0 }}><CardFace c={c} w={52} tip={false} /></motion.div>)}
        </div>
      )}
      {step(2, !problem, 'Talia',
        !problem ? 'Gotowa: 20 kart.' : (
          <div className="flex items-center gap-5 flex-wrap">
            <span style={{ color: C.muted }}>{problem}</span>
            <button type="button" disabled={!!busy || !col.cards.length} onClick={quick} className="font-bold uppercase tracking-widest text-[13px] hover:underline underline-offset-4 disabled:opacity-40 flex items-center gap-2" style={{ color: C.primary }}>
              {busy === 'deck' && <Loader2 className="w-4 h-4 animate-spin" />}Szybka talia
            </button>
            <a href={getTournamentPath('/cards')} target="_blank" rel="noreferrer" className="font-bold uppercase tracking-widest text-[13px] hover:underline underline-offset-4" style={{ color: C.muted }}>Ułóż sam</a>
            {!problem ? null : <button type="button" onClick={load} className="text-[12px] underline underline-offset-4" style={{ color: C.muted }}>Odśwież</button>}
          </div>
        ))}
      <div className="flex items-center gap-6 pt-7">
        <Big onClick={start} disabled={!!problem} busy={busy === 'start'}>Zaczynamy</Big>
        {error && <span className="text-[14px] font-bold" style={{ color: C.loss }}>{error}</span>}
      </div>
    </div>
  );
}

// ── The page ────────────────────────────────────────────────────────────────

export function DuelScreen({ id }: { id: string }) {
  const { user, loading, signIn } = useAuth();
  const { getTournamentPath } = useTournament();
  const router = useRouter();
  const font = useHeaderFont();
  const { view, lobby, missing, offset, post, send, reloadLobby } = useDuel(id, user);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const seatLeft = useLeft(view?.status === 'seated' ? view.seatUntil : null, offset);
  const lobbyLeft = useLeft(view?.status === 'open' ? view.expiresAt : null, offset);

  const take = useCallback(async () => {
    if (!user) { try { sessionStorage.setItem(TAKE_KEY(id), '1'); } catch { /* private mode */ } signIn(); return; }
    setBusy(true); setError(await post({ action: 'take' })); setBusy(false); reloadLobby();
  }, [user, id, post, signIn, reloadLobby]);
  // Back from signing in: take the seat that was asked for
  useEffect(() => {
    if (!user) return;
    let want = false; try { want = sessionStorage.getItem(TAKE_KEY(id)) === '1'; sessionStorage.removeItem(TAKE_KEY(id)); } catch { /* ignore */ }
    if (want) take();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const toCards = () => router.push(getTournamentPath('/cards'));
  const rematch = async () => {
    if (!user || !view?.players) return;
    const r = await duelPost<{ id: string }>(user, { action: 'create', t: view.key, to: view.players[1].uid });
    if (r.error) setError(r.error); else router.push(getTournamentPath(`/cards/duel/${r.data!.id}`));
  };
  const link = typeof window !== 'undefined' ? `${window.location.origin}${getTournamentPath(`/cards/duel/${id}`)}` : '';
  const copy = () => { navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };

  // The match (and its end screen)
  if (view?.game && view.players && (view.status === 'play' || view.status === 'done')) {
    return (
      <OutpostsGame key={id} deck={[]} all={[]} onBack={toCards}
        net={{ game: view.game, players: view.players, result: view.result, offset, send, onRematch: rematch }} />
    );
  }
  if (missing) return <Faceoff left={null} right={null} kicker="Pojedynek" title="Nie ma takiego wyzwania"><Quiet onClick={toCards}>Rzuć własne wyzwanie</Quiet></Faceoff>;
  if (loading || (!view && !lobby)) return <div className="h-full flex items-center justify-center" style={{ color: C.muted }}><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const status = view?.status ?? lobby!.status;
  const host = view?.host ?? lobby!.host;
  const invited = view?.invited ?? lobby!.invited;
  const guest = view?.guest ?? lobby?.guest ?? null;
  const err = error && <span className="text-[14px] font-bold" style={{ color: C.loss }}>{error}</span>;

  if (status === 'expired' || status === 'cancelled') {
    return <Faceoff left={host} right={null} kicker="Pojedynek" title={status === 'expired' ? 'Wyzwanie wygasło' : 'Wyzwanie zamknięte'}><Quiet onClick={toCards}>Rzuć własne wyzwanie</Quiet></Faceoff>;
  }

  // The host waits
  if (view?.me === 'host') {
    return (
      <Faceoff left={host} right={status === 'seated' ? guest : invited} kicker={status === 'seated' ? 'Rywal przyjął wyzwanie' : 'Twoje wyzwanie'}
        title={status === 'seated' ? `${guest?.name} szykuje talię` : invited ? `Czekasz na: ${invited.name}` : 'Czekasz na rywala'}>
        <AnimatePresence mode="wait">
          {status === 'open' ? (
            <motion.div key="open" className="flex flex-col items-center gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {!invited && (
                <button type="button" onClick={copy} className="group flex items-center gap-4 h-[56px] pl-6 pr-5 rounded-full text-[17px]" style={{ background: ink(6), color: C.heading }}>
                  <span className="tabular-nums">{link.replace(/^https?:\/\//, '')}</span>
                  <span className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-widest" style={{ color: copied ? C.win : C.primary }}>{copied ? <><Check className="w-4 h-4" />Skopiowany</> : <><Copy className="w-4 h-4" />Kopiuj</>}</span>
                </button>
              )}
              <span className="text-[14px]" style={{ color: C.muted }}>{invited ? 'Powiadomienie wysłane.' : 'Wyślij link rywalowi albo wrzuć go na kanał.'} Wyzwanie czeka, dopóki jesteś na tej stronie (najdłużej {lobbyLeft}).</span>
            </motion.div>
          ) : (
            <motion.span key="seated" className="text-[15px] tabular-nums" style={{ color: C.muted }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Mecz zacznie się, gdy będzie gotowy (najdłużej {seatLeft}).</motion.span>
          )}
        </AnimatePresence>
        <Quiet danger onClick={async () => { await post({ action: 'leave' }); toCards(); }}>Zamknij wyzwanie</Quiet>
        {err}
      </Faceoff>
    );
  }

  // The guest holds the seat: get ready
  if (view?.me === 'guest' && status === 'seated' && guest?.uid === user?.uid && user) {
    return (
      <Faceoff left={host} right={guest} kicker={`Miejsce czeka na ciebie jeszcze ${seatLeft}`} title="Przygotuj się">
        <GetReady duelKey={view.key} user={user} onStart={() => post({ action: 'start' })} />
        <Quiet onClick={async () => { await post({ action: 'leave' }); toCards(); }}>Rezygnuję</Quiet>
      </Faceoff>
    );
  }

  // Anyone else with the link
  const forSomeoneElse = invited && user && invited.uid !== user.uid;
  const taken = status === 'seated' || status === 'play' || status === 'done';
  return (
    <Faceoff left={host} right={invited ?? null} kicker="Pojedynek w karty"
      title={taken ? 'Ktoś był szybszy' : forSomeoneElse ? `To wyzwanie dla: ${invited!.name}` : `${host.name} wyzywa cię`}>
      {!taken && !forSomeoneElse && (
        <>
          <p className="max-w-[640px] text-center text-[16px] leading-relaxed" style={{ color: C.text }}>
            Kontrola mapy: talia 20 kart z graczami tego turnieju przeciw talii rywala. Mecz trwa kilka minut.
            {!user && ' Konto założysz albo zalogujesz się po kliknięciu.'}
          </p>
          <Big onClick={take} busy={busy}>Przyjmij</Big>
        </>
      )}
      {(taken || forSomeoneElse) && <Quiet onClick={toCards}>Rzuć własne wyzwanie</Quiet>}
      {err}
      {!taken && !forSomeoneElse && <span className="text-[13px]" style={{ color: C.muted }}>Po przyjęciu masz {LOBBY.seat / 60_000} minut na przygotowanie talii.</span>}
    </Faceoff>
  );
}
