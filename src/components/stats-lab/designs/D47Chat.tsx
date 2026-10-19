'use client';

// #47 — Chat with the analyst. A scripted (not AI) conversation: pick a question from the quick
// replies and the analyst answers with a line of text plus a rich card, then offers follow-ups
// and a way into the full page. Older messages slide off the top; nothing scrolls.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTournament } from '@/context/TournamentContext';
import type { Model, PlayerX } from '@/lib/stats-lab/derive';
import { rankPlayers } from '@/lib/stats-lab/derive';
import { eloTable, type Fact } from '@/lib/stats-lab/teasers';
import { heroName } from '@/lib/stats-lab/heroes';
import { REDESIGN_NAMES } from '../preview';
import { Avatar, C, HeroImg, LabTitle, TeamLogo, ink, mix, useHeaderFont, wrColor } from '../kit';
import { FactCard, HubShell, useFacts } from '../hub';

const TYPING_MS = 750;
const KEEP = 6;

interface Chip { label: string; ask?: string; open?: number }
interface Msg { id: number; who: 'bot' | 'me'; text: React.ReactNode; att?: React.ReactNode; chips?: Chip[] }

const MAIN: Chip[] = [
  { label: 'Kto jest MVP?', ask: 'mvp' },
  { label: 'Jakie rekordy padły?', ask: 'rekord' },
  { label: 'Który bohater rządzi?', ask: 'hero' },
  { label: 'Najmocniejsza drużyna?', ask: 'elo' },
  { label: 'Kto zawalił?', ask: 'wpadka' },
  { label: 'Opowiedz o graczu', ask: 'gracze' },
  { label: 'Zaskocz mnie', ask: 'los' },
];

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

function Chat({ model, open }: { model: Model; open: (n: number) => void }) {
  const font = useHeaderFont();
  const { theme } = useTournament();
  const facts = useFacts(model);
  const rank = useMemo(() => rankPlayers(model, 'score', 'avg'), [model]);
  const elo = useMemo(() => eloTable(model), [model]);
  const [msgs, setMsgs] = useState<Msg[]>(() => [{ id: 0, who: 'bot', text: <>Cześć! W bazie mam {model.games.length} gier, {model.players.length} graczy i {model.teams.length} drużyn. O co zapytasz?</>, chips: MAIN }]);
  const [typing, setTyping] = useState(false);
  const seq = useRef(0);
  const shown = useRef(new Set<string>());

  const freshOf = (list: Fact[]) => { const f = list.find(x => !shown.current.has(x.id)) ?? pick(list); if (f) shown.current.add(f.id); return f; };
  const card = (f: Fact) => (
    <button type="button" onClick={() => open(f.page)} className="block rounded-2xl overflow-hidden text-left" style={{ width: 420, height: 190, boxShadow: '0 14px 30px rgba(0,0,0,0.35)' }}>
      <FactCard f={f} size="md" className="w-full h-full" />
    </button>
  );
  const playerCard = (p: PlayerX) => {
    const i = rank.findIndex(r => r.player.id === p.id);
    return (
      <button type="button" onClick={() => open(16)} className="flex items-center gap-4 rounded-2xl p-3 pr-6 text-left" style={{ background: '#0b0b10', color: '#fff', boxShadow: '0 14px 30px rgba(0,0,0,0.35)' }}>
        <Avatar player={p} size={96} className="!rounded-xl" />
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-xl font-bold" style={font}>{p.name}{p.team && <TeamLogo team={p.team} size={24} />}</div>
          <div className="flex gap-5 text-sm">
            <span><b className="text-lg" style={{ color: wrColor(p.wr) }}>{p.wins}–{p.losses}</b> <span className="text-white/60">bilans</span></span>
            <span><b className="text-lg">{p.agg.score.avg?.toFixed(2) ?? '–'}</b> <span className="text-white/60">pkt/grę</span></span>
            <span><b className="text-lg">{i >= 0 ? `#${i + 1}` : '–'}</b> <span className="text-white/60">ranking</span></span>
          </div>
          <div className="flex gap-1">{p.heroes.slice(0, 4).map(h => <HeroImg key={h.heroId} heroId={h.heroId} variant="icon" className="rounded" style={{ width: 48, height: 27 }} />)}</div>
        </div>
      </button>
    );
  };

  const reply = (ask: string): Omit<Msg, 'id' | 'who'> => {
    if (ask === 'mvp') {
      const [a, b, c] = rank;
      if (!a) return { text: 'Jeszcze nikt nie zagrał dość gier, żeby to ocenić.', chips: MAIN };
      const gap = b ? a.value - b.value : 0;
      return {
        text: <>Na dziś to <b>{a.player.name}</b> — średnio {a.value.toFixed(2)} pkt występu na grę.{b && <> {gap < 0.3 ? <>Ale <b>{b.player.name}</b> siedzi mu na ogonie.</> : <>Przewaga nad <b>{b.player.name}</b> jest wyraźna.</>}</>}</>,
        att: (
          <div className="flex items-end gap-4">
            {[b, a, c].map((r, k) => r && (
              <button key={r.player.id} type="button" onClick={() => open(2)} className="flex flex-col items-center gap-1">
                <Avatar player={r.player} size={k === 1 ? 104 : 72} ring={k === 1 ? '#f2c94c' : undefined} />
                <span className="text-sm font-bold" style={{ color: C.heading }}>{r.player.name}</span>
                <span className="text-xs tabular-nums" style={{ color: C.muted }}>{r.value.toFixed(2)}</span>
              </button>
            ))}
          </div>
        ),
        chips: [{ label: 'Kto go goni?', ask: 'goni' }, { label: 'Pokaż podium', open: 2 }, { label: 'Wyścig sezonu', open: 17 }],
      };
    }
    if (ask === 'goni') {
      const rest = rank.slice(1, 6);
      return {
        text: 'Pościg wygląda tak:',
        att: (
          <div className="flex flex-col gap-1.5 min-w-[360px]">
            {rest.map((r, i) => (
              <button key={r.player.id} type="button" onClick={() => send(`Opowiedz o ${r.player.name}`, `gracz:${r.player.id}`)} className="flex items-center gap-3 text-left">
                <span className="w-5 text-right text-sm" style={{ color: C.muted }}>{i + 2}</span><Avatar player={r.player} size={36} />
                <span className="flex-1 font-bold" style={{ color: C.text }}>{r.player.name}</span><span className="tabular-nums" style={{ color: C.heading }}>{r.value.toFixed(2)}</span>
              </button>
            ))}
          </div>
        ),
        chips: [{ label: 'Pełny ranking', open: 2 }, ...MAIN.filter(m => m.ask !== 'mvp').slice(0, 3)],
      };
    }
    if (ask === 'rekord') {
      const f = freshOf(facts.filter(x => x.id.startsWith('rec-')));
      if (!f) return { text: 'Rekordów jeszcze nie ma.', chips: MAIN };
      return { text: pick([<>Mój ulubiony: <b>{f.title}</b>, {f.kicker.replace(/^Rekord · /, '').toLowerCase()} — {f.big}.</>, <>Proszę bardzo — {f.big} ({f.kicker.replace(/^Rekord · /, '').toLowerCase()}). Autor: <b>{f.title}</b>.</>]), att: card(f), chips: [{ label: 'Inny rekord', ask: 'rekord' }, { label: 'Ściana rekordów', open: 1 }, { label: 'Kronika rekordów', open: 26 }] };
    }
    if (ask === 'hero') {
      const f = facts.find(x => x.id === 'hero');
      if (!f) return { text: 'Brak draftów w bazie.', chips: MAIN };
      return { text: <>Bez dwóch zdań <b>{f.title}</b> — był w drafcie {f.big}.</>, att: card(f), chips: [{ label: 'A najlepszy duet?', ask: 'duo' }, { label: 'Mozaika bohaterów', open: 3 }, { label: 'Pokój draftu', open: 11 }] };
    }
    if (ask === 'duo') {
      const f = facts.find(x => x.id === 'duo');
      if (!f) return { text: 'Za mało wspólnych gier, żeby wskazać duet.', chips: MAIN };
      return { text: <><b>{f.title}</b> — {f.big} {f.sub}.</>, att: card(f), chips: [{ label: 'Kto ma pierwszy pick?', ask: 'fp' }, { label: 'Pokój draftu', open: 11 }, ...MAIN.slice(0, 2)] };
    }
    if (ask === 'fp') {
      const f = facts.find(x => x.id === 'firstpick');
      return f ? { text: <>Drużyna z pierwszym pickiem wygrywa {f.big} gier.</>, att: card(f), chips: [{ label: 'Pokój draftu', open: 11 }, ...MAIN.slice(0, 3)] } : { text: 'Nie mam danych o kolejności draftu.', chips: MAIN };
    }
    if (ask === 'elo') {
      const top = elo.slice(0, 3);
      if (!top.length) return { text: 'Brak drużyn.', chips: MAIN };
      return {
        text: <>Według Elo — <b>{top[0].t.name}</b>.{top[1] && <> Dalej {top[1].t.name}{top[2] && <> i {top[2].t.name}</>}.</>}</>,
        att: (
          <div className="flex gap-3">
            {top.map((e, i) => (
              <button key={e.t.id} type="button" onClick={() => open(23)} className="flex flex-col items-center gap-2 rounded-2xl px-5 py-3" style={{ background: '#0b0b10', boxShadow: i === 0 ? '0 0 0 2px #f2c94c' : undefined }}>
                <TeamLogo team={e.t} size={i === 0 ? 84 : 64} />
                <span className="text-sm font-bold text-white max-w-[140px] truncate">{e.t.name}</span>
                <span className="text-lg font-bold tabular-nums" style={{ color: '#7CFFB2' }}>{Math.round(e.v)}</span>
              </button>
            ))}
          </div>
        ),
        chips: [{ label: 'Ranking Elo', open: 23 }, { label: 'Radiant czy Dire?', ask: 'side' }, { label: 'Odciski drużyn', open: 7 }],
      };
    }
    if (ask === 'side') {
      const f = facts.find(x => x.id === 'side');
      return f ? { text: <>Radiant wygrywa {f.big} gier. {parseInt(f.big, 10) > 55 ? 'Wybierajcie dolną stronę mapy.' : parseInt(f.big, 10) < 45 ? 'Dire ma się świetnie.' : 'Jest w miarę równo.'}</>, att: card(f), chips: [{ label: 'Wojna stron', open: 13 }, ...MAIN.slice(0, 3)] } : { text: 'Brak gier.', chips: MAIN };
    }
    if (ask === 'wpadka') {
      const f = freshOf(facts.filter(x => x.tone === 'roast'));
      if (!f) return { text: 'Żadnych wpadek. Podejrzanie czysto.', chips: MAIN };
      return { text: <>{pick(['Oj, jest kilka…', 'Tylko nie mów, że ode mnie.', 'Najlepsze zostawiłem na koniec.'])} {f.sub}</>, att: card(f), chips: [{ label: 'Jeszcze jedna', ask: 'wpadka' }, { label: 'Bingo turnieju', open: 27 }, ...MAIN.slice(0, 2)] };
    }
    if (ask === 'gracze') {
      const ps = [...model.players].sort((a, b) => b.games - a.games).slice(0, 8);
      return { text: 'O kim? Tu masz najaktywniejszych:', chips: ps.map(p => ({ label: p.name, ask: `gracz:${p.id}` })) };
    }
    if (ask.startsWith('gracz:')) {
      const p = model.playerById.get(ask.slice(6));
      if (!p) return { text: 'Nie znam go.', chips: MAIN };
      const fav = p.heroes[0];
      const own = facts.filter(f => f.player?.id === p.id);
      return {
        text: <><b>{p.name}</b>{p.team ? <> z {p.team.name}</> : null}: {p.games} gier, {Math.round(p.wr * 100)}% wygranych.{fav && <> Najczęściej {heroName(fav.heroId)} ({fav.games}×).</>}{own[0] && <> I ma na koncie: {own[0].kicker.toLowerCase()} — {own[0].big}.</>}</>,
        att: playerCard(p),
        chips: [{ label: 'Dossier gracza', open: 16 }, { label: 'Karta gracza', open: 4 }, { label: 'Inny gracz', ask: 'gracze' }, { label: 'Kto jest MVP?', ask: 'mvp' }],
      };
    }
    const f = freshOf(facts);
    return { text: pick(['Proszę bardzo:', 'Wiedziałeś o tym?', 'To mnie zaskoczyło:']), att: f && card(f), chips: [{ label: 'Jeszcze coś', ask: 'los' }, ...(f ? [{ label: REDESIGN_NAMES[f.page - 1], open: f.page }] : []), ...MAIN.slice(0, 2)] };
  };

  const push = (m: Omit<Msg, 'id'>) => setMsgs(l => [...l, { ...m, id: ++seq.current }].slice(-KEEP));
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const send = (label: string, ask: string) => {
    if (typing) return;
    push({ who: 'me', text: label });
    setTyping(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setTyping(false); push({ who: 'bot', ...reply(ask) }); }, TYPING_MS);
  };
  const chip = (c: Chip) => { if (c.open) open(c.open); else if (c.ask) send(c.label, c.ask); };

  useEffect(() => () => clearTimeout(timer.current), []);

  const last = msgs[msgs.length - 1];
  const chips = !typing && last?.who === 'bot' ? last.chips ?? MAIN : [];
  const botAvatar = (
    <span className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center overflow-hidden" style={{ background: mix(C.primary, 40), boxShadow: `0 0 0 2px ${mix(C.secondary, 60)}` }}>
      {theme.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={theme.logoUrl} alt="" className="w-8 h-8 object-contain" />
      ) : <span className="text-xs font-bold">A</span>}
    </span>
  );

  return (
    <>
      <LabTitle sub={<span>wybierz pytanie — analityk odpowie</span>}>Czat z analitykiem</LabTitle>
      <div className="flex-1 min-h-0 mt-3 rounded-3xl flex flex-col overflow-hidden" style={{ background: ink(3), border: `1px solid ${ink(8)}` }}>
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col justify-end gap-4 px-6 pt-6 pb-3" style={{ maskImage: 'linear-gradient(to bottom, transparent, #000 70px)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 70px)' }}>
          <AnimatePresence initial={false}>
            {msgs.map(m => (
              <motion.div key={m.id} layout className={`shrink-0 flex gap-3 ${m.who === 'me' ? 'justify-end' : 'items-start'}`}
                initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}>
                {m.who === 'bot' && botAvatar}
                <div className={`flex flex-col gap-2.5 max-w-[75%] ${m.who === 'me' ? 'items-end' : 'items-start'}`}>
                  <div className="rounded-2xl px-4 py-2.5 text-[17px] leading-snug" style={m.who === 'me'
                    ? { background: C.primary, color: '#fff', borderBottomRightRadius: 6 }
                    : { background: ink(8), color: C.text, borderTopLeftRadius: 6 }}>{m.text}</div>
                  {m.att}
                </div>
              </motion.div>
            ))}
            {typing && (
              <motion.div key="typing" className="shrink-0 flex gap-3 items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {botAvatar}
                <div className="rounded-2xl px-4 py-3 flex gap-1.5" style={{ background: ink(8) }}>
                  {[0, 1, 2].map(i => <motion.span key={i} className="w-2 h-2 rounded-full" style={{ background: C.muted }} animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }} />)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="shrink-0 px-6 py-4 flex flex-wrap gap-2.5 min-h-[76px] items-center" style={{ borderTop: `1px solid ${ink(8)}`, background: ink(4) }}>
          <AnimatePresence mode="popLayout">
            {chips.map((c, i) => (
              <motion.button key={`${last?.id}-${c.label}`} type="button" onClick={() => chip(c)} className="rounded-full px-5 py-2.5 text-[15px] font-bold"
                style={c.open
                  ? { background: C.primary, color: '#fff', boxShadow: `0 0 14px ${mix(C.primary, 40)}` }
                  : { background: 'color-mix(in srgb, var(--tournament-secondary) 16%, var(--tournament-background, #111))', color: C.heading, border: `1px solid ${mix(C.secondary, 45)}` }}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05 } }} exit={{ opacity: 0 }} whileHover={{ scale: 1.05 }}>
                {c.open ? `${c.label} ›` : c.label}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

export default function D47Chat() {
  return <HubShell render={(m, x) => <Chat model={m} open={x.open} />} />;
}
