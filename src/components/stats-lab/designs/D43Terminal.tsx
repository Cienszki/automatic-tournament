'use client';

// #43 — Terminal. Ask the stats with commands: `gracz <nick>`, `druzyna <nazwa>`, `bohater <nazwa>`,
// `mvp`, `rekordy`, `elo`, `wpadki`, `losuj`, `otworz <strona>`. Chips under the prompt suggest
// commands and names as you type (Tab completes, ↑ recalls). Answers are rich cards with a way
// into the full page. Nothing scrolls: the newest answers push the older ones off the top.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, PlayerX, TeamX, HeroX } from '@/lib/stats-lab/derive';
import { rankPlayers } from '@/lib/stats-lab/derive';
import { eloTable, type Fact } from '@/lib/stats-lab/teasers';
import { heroName } from '@/lib/stats-lab/heroes';
import { REDESIGN_NAMES } from '../preview';
import { Avatar, C, HeroImg, HeroRender, LabTitle, TeamLogo, mix, onDark, useHeaderFont, wrColor } from '../kit';
import { FactCard, HubShell, useFacts } from '../hub';

const GREEN = '#7CFFB2';
const DIM = 'rgba(255,255,255,0.45)';
const norm = (s: string) => s.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

interface Cmd { name: string; arg?: string; desc: string }
const CMDS: Cmd[] = [
  { name: 'gracz', arg: 'nick', desc: 'profil gracza' },
  { name: 'druzyna', arg: 'nazwa', desc: 'profil drużyny' },
  { name: 'bohater', arg: 'nazwa', desc: 'bohater w turnieju' },
  { name: 'mvp', desc: 'najlepsi gracze sezonu' },
  { name: 'rekordy', desc: 'rekordy jednej gry' },
  { name: 'elo', desc: 'ranking siły drużyn' },
  { name: 'wpadki', desc: 'to, o czym się nie mówi' },
  { name: 'losuj', desc: 'losowa ciekawostka' },
  { name: 'otworz', arg: 'strona', desc: 'otwiera pełną stronę' },
  { name: 'wyczysc', desc: 'czyści ekran' },
  { name: 'pomoc', desc: 'lista komend' },
];

interface Entry { id: number; cmd: string; out: React.ReactNode }
interface Sugg { label: string; value: string; run: boolean; img?: React.ReactNode }

function Btn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-widest" style={{ background: C.primary, color: '#fff' }}>{children}</button>;
}
const Stat = ({ v, l, color }: { v: React.ReactNode; l: string; color?: string }) => (
  <div><div className="text-2xl font-bold tabular-nums leading-none" style={{ color: color ?? '#fff' }}>{v}</div><div className="text-[10px] uppercase tracking-widest mt-1" style={{ color: DIM }}>{l}</div></div>
);

function Terminal({ model, open }: { model: Model; open: (n: number) => void }) {
  const font = useHeaderFont();
  const facts = useFacts(model);
  const elo = useMemo(() => eloTable(model), [model]);
  const scoreRank = useMemo(() => rankPlayers(model, 'score', 'avg'), [model]);
  const [input, setInput] = useState('');
  const [log, setLog] = useState<Entry[]>([]);
  const [hist, setHist] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  const playerOut = (p: PlayerX) => {
    const avg = p.agg.score.avg; const kda = p.agg.kda.avg;
    const rank = scoreRank.findIndex(r => r.player.id === p.id);
    return (
      <div className="flex gap-5 items-stretch">
        <Avatar player={p} size={128} className="!rounded-xl" />
        <div className="flex flex-col gap-3 min-w-0">
          <div className="flex items-center gap-3"><span className="text-3xl font-bold" style={font}>{p.name}</span>{p.team && <TeamLogo team={p.team} size={34} />}<span style={{ color: DIM }}>{p.team?.name}</span></div>
          <div className="flex gap-7">
            <Stat v={p.games} l="gier" />
            <Stat v={`${p.wins}–${p.losses}`} l="bilans" color={wrColor(p.wr)} />
            <Stat v={avg != null ? avg.toFixed(2) : '–'} l="pkt występu / grę" color={GREEN} />
            <Stat v={rank >= 0 ? `#${rank + 1}` : '–'} l="w rankingu" />
            <Stat v={kda != null ? kda.toFixed(2) : '–'} l="KDA" />
          </div>
          <div className="flex items-center gap-2">
            {p.heroes.slice(0, 5).map(h => (
              <span key={h.heroId} className="relative" title={`${heroName(h.heroId)} · ${h.games} gier · ${h.wins} wygranych`}>
                <HeroImg heroId={h.heroId} variant="icon" className="rounded-md" style={{ width: 64, height: 36 }} />
                <span className="absolute -bottom-1 -right-1 text-[10px] px-1 rounded bg-black/80">{h.games}</span>
              </span>
            ))}
            <span className="ml-3 flex gap-2"><Btn onClick={() => open(16)}>Dossier</Btn><Btn onClick={() => open(4)}>Karta</Btn></span>
          </div>
        </div>
      </div>
    );
  };
  const teamOut = (t: TeamX) => {
    const e = elo.findIndex(x => x.t.id === t.id);
    return (
      <div className="flex gap-5 items-center">
        <span className="rounded-xl p-2" style={{ background: '#15151c' }}><TeamLogo team={t} size={112} /></span>
        <div className="flex flex-col gap-3 min-w-0">
          <div className="text-3xl font-bold" style={font}>{t.name}</div>
          <div className="flex gap-7">
            <Stat v={`${t.wins}–${t.losses}`} l="gry" color={wrColor(t.wr)} />
            <Stat v={`${t.series.w}–${t.series.d}–${t.series.l}`} l="mecze W–R–P" />
            <Stat v={e >= 0 ? Math.round(elo[e].v) : '–'} l={`Elo · #${e + 1}`} color={GREEN} />
            <Stat v={`${Math.round(t.avg?.kills ?? 0)}`} l="zabójstw / grę" />
          </div>
          <div className="flex items-center gap-2">
            {t.players.slice(0, 7).map(p => <span key={p.id} title={p.name}><Avatar player={p} size={44} /></span>)}
            <span className="ml-3 flex gap-2"><Btn onClick={() => open(7)}>Odciski</Btn><Btn onClick={() => open(12)}>Scouting</Btn></span>
          </div>
        </div>
      </div>
    );
  };
  const heroOut = (h: HeroX) => {
    const best = [...h.players].sort((a, b) => b.games - a.games)[0];
    return (
      <div className="flex gap-5 items-end">
        <div className="relative shrink-0" style={{ width: 150, height: 170 }}><HeroRender heroId={h.heroId} sizes="150px" /></div>
        <div className="flex flex-col gap-3 pb-2">
          <div className="text-3xl font-bold" style={font}>{heroName(h.heroId)}</div>
          <div className="flex gap-7">
            <Stat v={h.picks} l="picków" /><Stat v={h.bans} l="banów" /><Stat v={`${Math.round(h.wr * 100)}%`} l="wygranych" color={wrColor(h.wr)} />
            <Stat v={`${h.avgK.toFixed(1)}/${h.avgD.toFixed(1)}/${h.avgA.toFixed(1)}`} l="średnie KDA" />
          </div>
          <div className="flex items-center gap-3">
            {best && <><Avatar player={best.player} size={40} /><span style={{ color: DIM }}>najczęściej: <b className="text-white">{best.player.name}</b> · {best.games} gier</span></>}
            <span className="ml-3"><Btn onClick={() => open(3)}>Mozaika</Btn></span>
          </div>
        </div>
      </div>
    );
  };
  const factRows = (list: Fact[], page: number) => (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
      {list.map(f => (
        <button key={f.id} type="button" onClick={() => open(page)} className="flex items-center gap-3 text-left rounded-md px-2 py-1 hover:bg-white/10">
          {f.player ? <Avatar player={f.player} size={34} /> : f.team ? <TeamLogo team={f.team} size={34} /> : <span className="w-[34px]" />}
          <span className="w-16 text-right font-bold tabular-nums" style={{ color: f.tone === 'roast' ? '#ff8a3d' : GREEN }}>{f.big}</span>
          <span className="min-w-0 truncate"><span style={{ color: DIM }}>{f.kicker.replace(/^(Rekord|Wpadka) · /, '')}</span> · {f.title}</span>
        </button>
      ))}
    </div>
  );

  // ── commands ──
  const find = <T,>(list: T[], name: (t: T) => string, q: string) => {
    const n = norm(q);
    return list.find(x => norm(name(x)) === n) ?? list.find(x => norm(name(x)).startsWith(n)) ?? list.find(x => norm(name(x)).includes(n));
  };
  const exec = (raw: string): React.ReactNode | 'clear' => {
    const [c0, ...rest] = raw.trim().split(/\s+/);
    const c = norm(c0 ?? ''); const arg = rest.join(' ');
    const err = (m: string) => <span style={{ color: '#ff6b6b' }}>{m}</span>;
    switch (c) {
      case '': return null;
      case 'pomoc': case 'help': return (
        <div className="grid grid-cols-3 gap-x-6 gap-y-1">
          {CMDS.map(k => <button key={k.name} type="button" onClick={() => { setInput(`${k.name}${k.arg ? ' ' : ''}`); inputRef.current?.focus({ preventScroll: true }); }} className="text-left hover:underline"><span style={{ color: GREEN }}>{k.name}</span>{k.arg && <span style={{ color: DIM }}> &lt;{k.arg}&gt;</span>} <span style={{ color: DIM }}>— {k.desc}</span></button>)}
        </div>
      );
      case 'wyczysc': case 'clear': case 'cls': return 'clear';
      case 'gracz': { if (!arg) return err('podaj nick, np. gracz ' + (model.players[0]?.name ?? '')); const p = find(model.players, x => x.name, arg); return p ? playerOut(p) : err(`nie znam gracza „${arg}”`); }
      case 'druzyna': { if (!arg) return err('podaj nazwę drużyny'); const t = find(model.teams, x => `${x.name}`, arg) ?? find(model.teams, x => x.tag ?? '', arg); return t ? teamOut(t) : err(`nie znam drużyny „${arg}”`); }
      case 'bohater': { if (!arg) return err('podaj bohatera'); const h = find(model.heroes, x => heroName(x.heroId), arg); return h ? heroOut(h) : err(`„${arg}” nie grał w tym turnieju`); }
      case 'mvp': {
        const mvp = facts.find(f => f.id === 'mvp');
        return (
          <div className="flex gap-5 items-stretch">
            {mvp && <button type="button" onClick={() => open(2)} className="w-[300px] h-[190px] shrink-0 rounded-xl overflow-hidden text-left"><FactCard f={mvp} size="md" className="w-full h-full" /></button>}
            <div className="flex flex-col gap-1 justify-center">
              {scoreRank.slice(0, 6).map((r, i) => (
                <button key={r.player.id} type="button" onClick={() => setInput(`gracz ${r.player.name}`)} className="flex items-center gap-3 text-left hover:underline">
                  <span className="w-5 text-right" style={{ color: DIM }}>{i + 1}</span><Avatar player={r.player} size={26} /><span className="w-40 truncate">{r.player.name}</span><span className="tabular-nums font-bold" style={{ color: GREEN }}>{r.value.toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>
        );
      }
      case 'rekordy': return factRows(facts.filter(f => f.id.startsWith('rec-')).slice(0, 10), 1);
      case 'wpadki': return factRows(facts.filter(f => f.tone === 'roast').slice(0, 8), 27);
      case 'elo': {
        const lo = elo[elo.length - 1]?.v ?? 1400; const hi = elo[0]?.v ?? 1600;
        return (
          <div className="flex flex-col gap-1 max-w-[720px]">
            {elo.slice(0, 8).map((e, i) => (
              <button key={e.t.id} type="button" onClick={() => setInput(`druzyna ${e.t.name}`)} className="flex items-center gap-3 text-left">
                <span className="w-5 text-right" style={{ color: DIM }}>{i + 1}</span><TeamLogo team={e.t} size={26} /><span className="w-44 truncate">{e.t.name}</span>
                <span className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${10 + ((e.v - lo) / Math.max(1, hi - lo)) * 90}%`, background: GREEN }} /></span>
                <span className="w-12 text-right tabular-nums font-bold">{Math.round(e.v)}</span>
              </button>
            ))}
          </div>
        );
      }
      case 'losuj': {
        const f = facts[Math.floor(Math.random() * facts.length)];
        return f ? <button type="button" onClick={() => open(f.page)} className="block w-[420px] h-[200px] rounded-xl overflow-hidden text-left"><FactCard f={f} size="md" className="w-full h-full" /></button> : null;
      }
      case 'otworz': case 'open': {
        const n = Number(arg);
        const page = Number.isInteger(n) && n >= 1 && n <= REDESIGN_NAMES.length ? n : REDESIGN_NAMES.findIndex(x => norm(x).startsWith(norm(arg))) + 1;
        if (!arg || page < 1) return err('podaj numer lub nazwę strony');
        open(page);
        return <span style={{ color: DIM }}>otwieram „{REDESIGN_NAMES[page - 1]}”…</span>;
      }
      default: {
        // bare name: try a player, then a team, then a hero
        const p = find(model.players, x => x.name, raw); if (p) return playerOut(p);
        const t = find(model.teams, x => x.name, raw); if (t) return teamOut(t);
        return err(`nieznana komenda „${c0}” — wpisz pomoc`);
      }
    }
  };
  const run = (raw: string) => {
    const out = exec(raw);
    if (raw.trim()) setHist(h => [raw, ...h].slice(0, 30));
    setHIdx(-1); setInput('');
    if (out === 'clear') { setLog([]); return; }
    setLog(l => [...l, { id: ++seq.current, cmd: raw, out }].slice(-4));
  };

  // Boot: type a first command by itself
  useEffect(() => {
    const demo = 'mvp'; let i = 0; let t: ReturnType<typeof setTimeout>;
    const tick = () => { i++; setInput(demo.slice(0, i)); t = setTimeout(i < demo.length ? tick : () => run(demo), i < demo.length ? 110 : 350); };
    t = setTimeout(tick, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── suggestions ──
  const sugg: Sugg[] = useMemo(() => {
    const m = input.match(/^(\S+)\s+(.*)$/);
    const head = norm(m ? m[1] : input);
    const q = norm(m ? m[2] : '');
    const names = <T,>(list: T[], name: (t: T) => string, img: (t: T) => React.ReactNode, cmd: string) =>
      list.filter(x => !q || norm(name(x)).includes(q)).sort((a, b) => (q && norm(name(b)).startsWith(q) ? 1 : 0) - (q && norm(name(a)).startsWith(q) ? 1 : 0)).slice(0, 9).map(x => ({ label: name(x), value: `${cmd} ${name(x)}`, run: true, img: img(x) }));
    if (m && head === 'gracz') return names([...model.players].sort((a, b) => b.games - a.games), p => p.name, p => <Avatar player={p} size={22} />, 'gracz');
    if (m && head === 'druzyna') return names(model.teams, t => t.name, t => <TeamLogo team={t} size={22} />, 'druzyna');
    if (m && head === 'bohater') return names(model.heroes, h => heroName(h.heroId), h => <HeroImg heroId={h.heroId} variant="icon" className="rounded-sm" style={{ width: 30, height: 17 }} />, 'bohater');
    if (m && head === 'otworz') return REDESIGN_NAMES.map((n, i) => ({ label: `${i + 1} ${n}`, value: `otworz ${i + 1}`, run: true })).filter(s => !q || norm(s.label).includes(q)).slice(0, 9);
    const cmds = CMDS.filter(k => !head || k.name.startsWith(head)).map(k => ({ label: k.name + (k.arg ? ` <${k.arg}>` : ''), value: k.name + (k.arg ? ' ' : ''), run: !k.arg }));
    if (cmds.length || !head) return cmds;
    return names(model.players, p => p.name, p => <Avatar player={p} size={22} />, 'gracz').filter(s => norm(s.label).includes(head));
  }, [input, model]);
  const pick = (s: Sugg) => { if (s.run) run(s.value); else { setInput(s.value); inputRef.current?.focus({ preventScroll: true }); } };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); run(input); }
    else if (e.key === 'Tab') { e.preventDefault(); if (sugg[0]) setInput(sugg[0].value); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); const i = Math.min(hist.length - 1, hIdx + 1); if (i >= 0) { setHIdx(i); setInput(hist[i]); } }
    else if (e.key === 'ArrowDown') { e.preventDefault(); const i = hIdx - 1; setHIdx(i); setInput(i >= 0 ? hist[i] : ''); }
  };

  return (
    <>
      <LabTitle sub={<span>wpisz komendę lub kliknij podpowiedź · Tab uzupełnia · ↑ poprzednie</span>}>Terminal</LabTitle>
      <div className="flex-1 min-h-0 mt-3 rounded-2xl overflow-hidden flex flex-col font-mono text-[15px] text-white cursor-text"
        style={{ background: '#08090d', boxShadow: `0 0 0 1px ${focused ? mix(C.secondary, 60) : 'rgba(255,255,255,0.1)'}, 0 30px 60px rgba(0,0,0,0.45)` }}
        onClick={e => { if ((e.target as HTMLElement).closest('button')) return; inputRef.current?.focus({ preventScroll: true }); }}>
        <div className="shrink-0 flex items-center gap-2 px-4 py-2 text-xs" style={{ background: '#111219', color: DIM }}>
          <span className="w-3 h-3 rounded-full bg-[#ff5f57]" /><span className="w-3 h-3 rounded-full bg-[#febc2e]" /><span className="w-3 h-3 rounded-full bg-[#28c840]" />
          <span className="ml-3">statystyki — {model.games.length} gier · {model.players.length} graczy · {model.teams.length} drużyn</span>
        </div>
        {/* output: newest at the bottom, the old ones fall off the top */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col justify-end gap-5 px-5 pb-3" style={{ maskImage: 'linear-gradient(to bottom, transparent, #000 60px)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 60px)' }}>
          {log.length === 0 && <div style={{ color: DIM }}>wpisz <span style={{ color: GREEN }}>pomoc</span>, aby zobaczyć komendy</div>}
          <AnimatePresence initial={false}>
            {log.map(en => (
              <motion.div key={en.id} className="shrink-0" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                <div className="mb-2"><span style={{ color: onDark(C.secondary) }}>›</span> <span style={{ color: GREEN }}>{en.cmd}</span></div>
                <div className="pl-4">{en.out}</div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        {/* prompt */}
        <div className="shrink-0 px-5 py-3 flex items-center gap-2 border-t border-white/10" style={{ background: '#0d0e14' }}>
          <span style={{ color: onDark(C.secondary) }}>›</span>
          <input ref={inputRef} value={input} onChange={e => { setInput(e.target.value); setHIdx(-1); }} onKeyDown={onKey}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} spellCheck={false} autoComplete="off" aria-label="Komenda"
            className="flex-1 bg-transparent outline-none text-lg caret-[#7CFFB2]" style={{ color: GREEN }} placeholder="pomoc" />
        </div>
        <div className="shrink-0 px-5 pb-3 flex flex-wrap gap-2 min-h-[44px]" style={{ background: '#0d0e14' }}>
          {sugg.slice(0, 11).map(s => (
            <button key={s.value + s.label} type="button" onClick={() => pick(s)} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm hover:brightness-125"
              style={{ background: '#1a1c26', border: '1px solid rgba(255,255,255,0.12)' }}>
              {s.img}<span>{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export default function D43Terminal() {
  return <HubShell render={(m, x) => <Terminal model={m} open={x.open} />} />;
}
