// src/components/format-preview/FormatFlow.tsx
// TEMPORARY — the qualifier as ONE flowchart (CS2-Major style): time runs left to right, match
// cards are grouped by record, and a team's last match gets a small arrow saying where it ended
// ("LAN", "6. miejsce"). Lines appear only for the match card under the pointer: where its two
// teams came from and where they go (green = won, red = lost), so the chart never turns into
// spaghetti. The chart is fitted to the screen height; when it is wider than the screen a slider
// (or wheel / drag) pans it.
'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useTournament } from '@/context/TournamentContext';
import { MatchDetailModal } from '@/components/divisions/MatchDetailModal';
import type { Match } from '@/lib/definitions';
import { matchState, type FPMatch, type FPTeam, type FormatSim } from './model';

// ─── Geometry (canvas units) ────────────────────────────────────────────────
export const CARD_W = 272;
const ROW_H = 44;
const CARD_H = ROW_H * 2 + 3;
const GAP = 124;
const REC_H = 22;
const CARD_GAP = 10;
const BUCKET_GAP = 26;
const BAND_GAP = 34;
const LANE = 6;
const TAIL = 140;

const WIN = '#22c55e';
const LOSS = '#f43f5e';

type Band = 'top' | 'bottom';
type Tone = 'win' | 'loss' | 'pending';
type Corr = 'T' | 'M' | 'B';

interface Bucket { id: string; band: Band; col: number; rec: string; matches: FPMatch[]; x: number; y: number; h: number; tiebreak?: string[] }
/** One team going from one match group to the next. */
interface Move { team: string; from: string; to: string; tone: Tone; src?: FPMatch; dst?: FPMatch; fromRow?: number }
interface Outcome { x: number; y: number; text: string; lan: boolean }

const recKey = (r: [number, number]) => `${r[0]}:${r[1]}`;
const bandOf = (stage: FPMatch['stage']): Band => (stage === 'A' || stage === 'F' ? 'top' : 'bottom');
const cardTop = (b: Bucket, i: number) => b.y + REC_H + i * (CARD_H + CARD_GAP);
/** Centre of a team's row: row 0/1 of a lone match, or row i of the tiebreak box. */
const rowY = (b: Bucket, row: number) =>
  b.tiebreak ? b.y + REC_H + 1 + row * (ROW_H + 1) + ROW_H / 2 : cardTop(b, 0) + 1 + (row === 0 ? ROW_H / 2 : ROW_H + 1 + ROW_H / 2);
const midOf = (b: Bucket) => b.y + REC_H + (b.h - REC_H) / 2;
export const TIEBREAK_ID = 'tiebreak';

function layout(sim: FormatSim, after: number) {
  const flow = sim.matches.filter(m => m.stage !== 'L');
  const T = sim.totalRounds;
  const tb = sim.tiebreak;
  // The tiebreak box takes its own slot between the Swiss rounds and the Final (not a round).
  const tbCol = tb ? tb.round + 0.5 : null;
  const colX = (col: number) => (Math.ceil(col) - 1) * (CARD_W + GAP) + (tbCol !== null && col > tbCol ? CARD_W + GAP : 0);
  // Only once the organiser has really decided (a projected pick of a real tournament is not shown).
  const tbDecided = !!tb && tb.decided && after >= tb.round;

  const buckets = new Map<string, Bucket>();
  const bucketOf = new Map<string, string>();
  for (const m of flow) {
    // An odd record group sends its lowest team down to the next group; that match gets its own
    // group named with both records, so nobody reads it as two teams on the same record.
    const mixed = !!m.b && recKey(m.recA) !== recKey(m.recB);
    const rec = mixed ? `${recKey(m.recA)} – ${recKey(m.recB)}` : recKey(m.recA);
    const id = `${m.stage}-${m.round}-${rec}`;
    if (!buckets.has(id)) buckets.set(id, { id, band: bandOf(m.stage), col: m.round, rec, matches: [], x: colX(m.round), y: 0, h: 0 });
    buckets.get(id)!.matches.push(m);
    bucketOf.set(m.id, id);
  }
  for (const b of buckets.values()) b.h = REC_H + b.matches.length * CARD_H + (b.matches.length - 1) * CARD_GAP;
  if (tb && tbCol !== null) {
    buckets.set(TIEBREAK_ID, {
      id: TIEBREAK_ID, band: 'top', col: tbCol, rec: recKey(tb.record), matches: [], x: colX(tb.round) + CARD_W + GAP, y: 0,
      h: REC_H + tb.teams.length * (ROW_H + 1) + 1, tiebreak: tb.teams,
    });
  }

  const stacks = new Map<string, Bucket[]>();
  for (const b of buckets.values()) stacks.set(`${b.band}-${b.col}`, [...(stacks.get(`${b.band}-${b.col}`) ?? []), b]);
  const stackH = (list: Bucket[]) => list.reduce((h, b) => h + b.h, 0) + (list.length - 1) * BUCKET_GAP;
  for (const list of stacks.values()) {
    // Best record on top; a mixed group sits right below the higher of its two records.
    list.sort((a, b) => {
      const [aw, al] = a.rec.split(' ')[0].split(':').map(Number);
      const [bw, bl] = b.rec.split(' ')[0].split(':').map(Number);
      return bw - aw || al - bl || Number(a.rec.includes('–')) - Number(b.rec.includes('–'));
    });
  }
  const bandH = (band: Band) => Math.max(0, ...[...stacks.entries()].filter(([k]) => k.startsWith(band)).map(([, l]) => stackH(l)));

  // Moves: every team, match to next match (through the tiebreak box when it is in it).
  const byTeam = new Map<string, FPMatch[]>();
  for (const m of [...flow].sort((a, b) => a.round - b.round)) {
    for (const id of [m.a, m.b]) if (id) byTeam.set(id, [...(byTeam.get(id) ?? []), m]);
  }
  const moves: Move[] = [];
  for (const [team, list] of byTeam) {
    const inTb = !!tb && tb.teams.includes(team);
    list.slice(0, -1).forEach((m, i) => {
      const played = matchState(m, after) === 'played';
      const won = m.a === team ? m.sa > m.sb : m.sb > m.sa;
      const tone: Tone = played ? (won ? 'win' : 'loss') : 'pending';
      const from = bucketOf.get(m.id)!;
      const next = list[i + 1];
      // A lone match sends each team's line from its own row; a group of matches from its middle.
      const row = buckets.get(from)!.matches.length === 1 ? (m.a === team ? 0 : 1) : undefined;
      if (inTb && m.round === tb!.round) {
        moves.push({ team, from, to: TIEBREAK_ID, tone, src: m, fromRow: row });
        const advanced = tb!.advanced.includes(team);
        moves.push({ team, from: TIEBREAK_ID, to: bucketOf.get(next.id)!, tone: tbDecided ? (advanced ? 'win' : 'loss') : 'pending', dst: next, fromRow: tb!.teams.indexOf(team) });
      } else {
        moves.push({ team, from, to: bucketOf.get(next.id)!, tone, src: m, dst: next, fromRow: row });
      }
    });
  }

  /** Where a team's row is in a group (falls back to the group's middle). */
  const teamY = (bid: string, team: string, m?: FPMatch) => {
    const b = buckets.get(bid)!;
    if (b.tiebreak) return rowY(b, b.tiebreak.indexOf(team));
    if (!m) return midOf(b);
    return cardTop(b, b.matches.indexOf(m)) + 1 + (m.a === team ? ROW_H / 2 : ROW_H + 1 + ROW_H / 2);
  };

  const topH = bandH('top');
  const botH = bandH('bottom');
  const W = colX(T) + CARD_W + TAIL;

  // Places every card for the given lane heights. The tiebreak box hugs the bottom of the top
  // half, right above the Swiss teams it takes in, so their other lines pass beneath it.
  const place = (corT: number, corM: number) => {
    const yTop = corT;
    const yBot = yTop + topH + BAND_GAP + corM;
    for (const [k, list] of stacks) {
      const band = k.split('-')[0] as Band;
      const top = band === 'top' ? yTop : yBot;
      const h = band === 'top' ? topH : botH;
      let y = list.some(b => b.tiebreak) ? top + h - stackH(list) : top + (h - stackH(list)) / 2;
      for (const b of list) { b.y = y; y += b.h + BUCKET_GAP; }
    }
    return { yMid: yTop + topH + BAND_GAP / 2, yBot };
  };

  // A source → target pair takes a lane only when a card actually sits between its two ends
  // (for any of its teams' rows); otherwise its lines curve straight across.
  place(0, 0);
  const pairs = new Map<string, Move[]>();
  for (const mv of moves) pairs.set(`${mv.from}>${mv.to}`, [...(pairs.get(`${mv.from}>${mv.to}`) ?? []), mv]);
  const lanes: Record<Corr, string[]> = { T: [], M: [], B: [] };
  const corridor = new Map<string, Corr>();
  for (const [key, list] of pairs) {
    const a = buckets.get(list[0].from)!;
    const b = buckets.get(list[0].to)!;
    const ys = [midOf(a), midOf(b), ...list.flatMap(mv => [teamY(mv.from, mv.team, mv.src), teamY(mv.to, mv.team, mv.dst)])];
    const lo = Math.min(...ys) - 12;
    const hi = Math.max(...ys) + 12;
    const hit = [...buckets.values()].some(o => o.col > a.col && o.col < b.col && o.y < hi && o.y + o.h > lo);
    if (!hit) continue;
    const c: Corr = a.band !== b.band ? 'M' : a.band === 'top' ? 'T' : 'B';
    corridor.set(key, c);
    lanes[c].push(key);
  }
  const corH = (c: Corr) => (lanes[c].length ? 8 + lanes[c].length * LANE : 0);
  const { yMid, yBot } = place(corH('T'), corH('M'));
  const H = yBot + botH + corH('B') + 4;
  const laneY = (key: string) => {
    const c = corridor.get(key)!;
    const i = lanes[c].indexOf(key);
    return c === 'T' ? 4 + i * LANE : c === 'B' ? yBot + botH + corH('B') - 4 - i * LANE : yMid + (i - (lanes.M.length - 1) / 2) * LANE;
  };

  /** Curved path between two points of a pair, through its lane when it has one. */
  const route = (from: string, to: string, x1: number, y1: number, x2: number, y2: number) => {
    const key = `${from}>${to}`;
    if (!corridor.has(key)) {
      const mx = (x1 + x2) / 2;
      return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
    }
    const ly = laneY(key);
    const g = GAP * 0.45;
    return `M ${x1} ${y1} C ${x1 + g} ${y1}, ${x1 + g} ${ly}, ${x1 + g * 1.6} ${ly} L ${x2 - g * 1.6} ${ly} C ${x2 - g} ${ly}, ${x2 - g} ${y2}, ${x2} ${y2}`;
  };

  // Where each team's qualifier ends: a small arrow right of its row in its last match.
  const outcomes: Outcome[] = [];
  for (const [team, list] of byTeam) {
    const last = list[list.length - 1];
    const o = sim.outcome[team];
    if (!o || matchState(last, after) !== 'played' || o.round > after) continue;
    const b = buckets.get(bucketOf.get(last.id)!)!;
    outcomes.push({ x: b.x + CARD_W, y: teamY(b.id, team, last), text: o.text, lan: o.lan });
  }

  return { buckets, moves, teamY, route, outcomes, W, H };
}

type Layout = ReturnType<typeof layout>;

// ─── Lines ──────────────────────────────────────────────────────────────────

/** A team already certain in a projected (TBD) match — see `known` in model.ts. */
const isKnown = (m: FPMatch, team: string) => !!m.known?.[m.a === team ? 0 : 1];

const toneColor = (t: Tone) => (t === 'win' ? WIN : t === 'loss' ? LOSS : 'rgba(255,255,255,0.22)');

function Arrow({ x, y, len = 20, color }: { x: number; y: number; len?: number; color: string }) {
  return (
    <g>
      <path d={`M ${x} ${y} L ${x + len} ${y}`} stroke={color} strokeWidth={2} />
      <path d={`M ${x + len - 5} ${y - 4} L ${x + len} ${y} L ${x + len - 5} ${y + 4}`} fill="none" stroke={color} strokeWidth={2} />
    </g>
  );
}

/** Lines of the hovered match (or tiebreak box): where its teams came from and where they go. */
function drawLines(L: Layout, after: number, hoveredMatch: string | null): ReactNode[] {
  if (!hoveredMatch) return [];
  const B = (id: string) => L.buckets.get(id)!;
  const svg: ReactNode[] = [];
  const touches = (mv: Move) =>
    hoveredMatch === TIEBREAK_ID ? mv.from === TIEBREAK_ID || mv.to === TIEBREAK_ID : mv.src?.id === hoveredMatch || mv.dst?.id === hoveredMatch;
  for (const mv of L.moves.filter(touches)) {
    const a = B(mv.from);
    const b = B(mv.to);
    const key = `${mv.team}>${mv.from}>${mv.to}`;
    if (mv.tone === 'pending') {
      // Not played yet: show where the winner / loser will go, without saying who.
      const outgoing = hoveredMatch === TIEBREAK_ID ? mv.from === TIEBREAK_ID : mv.src?.id === hoveredMatch;
      if (!outgoing) continue;
      svg.push(<path key={key} d={L.route(mv.from, mv.to, a.x + CARD_W, midOf(a), b.x, midOf(b))} fill="none" stroke={toneColor('pending')} strokeWidth={1.5} strokeDasharray="4 6" />);
      continue;
    }
    // From the team's row to its row in the next match (that match's middle while it is hidden).
    const known = !!b.tiebreak || (!!mv.dst && (matchState(mv.dst, after) !== 'future' || isKnown(mv.dst, mv.team)));
    const y1 = L.teamY(mv.from, mv.team, mv.src);
    const y2 = known ? L.teamY(mv.to, mv.team, mv.dst) : midOf(b);
    svg.push(<path key={key} d={L.route(mv.from, mv.to, a.x + CARD_W, y1, b.x, y2)} fill="none" stroke={toneColor(mv.tone)} strokeWidth={2.5} opacity={0.9} />);
    svg.push(<circle key={`${key}-a`} cx={a.x + CARD_W} cy={y1} r={3.5} fill={toneColor(mv.tone)} />);
    svg.push(<circle key={`${key}-b`} cx={b.x} cy={y2} r={3.5} fill={toneColor(mv.tone)} />);
  }
  return svg;
}

// ─── Cards (same look as the playoff bracket cards, minus the badge strip) ──

/** Sets the match card (or tiebreak box) under the pointer, whose lines are drawn. */
const HoverCtx = createContext<(id: string | null) => void>(() => {});

function TeamLine({ team, score, state, won, lost }: { team?: FPTeam; score?: number; state: 'played' | 'next' | 'future'; won: boolean; lost: boolean }) {
  const { theme } = useTournament();
  const primary = theme?.primaryColor || '#d4af37';
  const secondary = theme?.secondaryTextColor || '#6b7280';
  if (state === 'future' || !team) {
    return (
      <div className="flex items-center gap-2.5 px-3" style={{ height: ROW_H }}>
        <div className="w-7 h-7 rounded border border-white/8 bg-white/5 shrink-0 grid place-items-center">
          <span className="text-[9px] font-mono" style={{ color: secondary }}>?</span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider italic" style={{ color: secondary }}>TBD</span>
      </div>
    );
  }
  return (
    <div
      className={cn('flex items-center justify-between gap-2 px-3', lost && 'opacity-35')}
      style={{ height: ROW_H, background: won ? `linear-gradient(to right, color-mix(in srgb, ${primary} 10%, transparent), transparent)` : undefined }}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="relative w-7 h-7 rounded bg-black/40 overflow-hidden shrink-0 grid place-items-center">
          {team.logoUrl ? (
            <Image src={team.logoUrl} alt={team.name} fill className="object-cover" unoptimized />
          ) : (
            <span className="text-[10px] font-mono" style={{ color: secondary }}>{team.placeholder ? '?' : team.name.charAt(0)}</span>
          )}
        </div>
        <span
          className={cn('font-logik-extended-bold text-[13px] truncate uppercase tracking-tight leading-tight', team.placeholder && 'italic')}
          style={{
            color: won ? (theme?.headingColor || primary) : lost ? secondary : (theme?.primaryTextColor || '#d1d5db'),
            fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined,
          }}
        >
          {team.name}
        </span>
      </div>
      {state === 'played' && score !== undefined && (
        <span className="text-base font-mono font-bold tabular-nums" style={{ color: won ? (theme?.headingColor || primary) : secondary }}>{score}</span>
      )}
    </div>
  );
}

/** The schedule's Match shape, so the usual match-details modal can open a preview match. */
export function toModalMatch(m: FPMatch, sim: FormatSim, after: number): Match {
  const played = matchState(m, after) === 'played';
  const side = (id: string, score: number) => ({ id, name: sim.teams[id].name, score: played ? score : 0, logoUrl: sim.teams[id].logoUrl || '' });
  return {
    id: `preview-${m.id}`,
    teamA: side(m.a, m.sa),
    teamB: side(m.b!, m.sb),
    teams: [m.a, m.b!],
    status: played ? 'completed' : 'scheduled',
    scheduledFor: '',
    schedulingStatus: 'confirmed',
    bestOf: m.bestOf,
    series_format: m.bestOf === 5 ? 'bo5' : 'bo3',
    winnerId: played ? (m.sa > m.sb ? m.a : m.b!) : undefined,
  } as unknown as Match;
}

function MatchCard({ m, sim, after, onOpen }: { m: FPMatch; sim: FormatSim; after: number; onOpen: (m: FPMatch) => void }) {
  const setHover = useContext(HoverCtx);
  const st = matchState(m, after);
  const played = st === 'played';
  const aWon = m.sa > m.sb;
  const canOpen = st !== 'future' && !!m.b;
  // A team already certain in a projected match is drawn like one of a scheduled match: name, no score
  const rowState = (side: 0 | 1) => (st === 'future' && m.known?.[side] ? 'next' : st);
  return (
    <div
      onClick={() => canOpen && onOpen(m)}
      onMouseEnter={() => setHover(m.id)}
      onMouseLeave={() => setHover(null)}
      className={cn(
        'group rounded-lg border backdrop-blur-md overflow-hidden divide-y divide-white/5 transition-[border-color,transform] duration-200',
        st === 'next' ? 'border-white/25' : 'border-white/10',
        canOpen && 'cursor-pointer hover:border-white/30 hover:-translate-y-px',
      )}
      style={{ width: CARD_W, height: CARD_H, backgroundColor: 'rgba(255,255,255,0.05)' }}
    >
      <TeamLine team={sim.teams[m.a]} score={m.sa} state={rowState(0)} won={played && (!m.b || aWon)} lost={played && !!m.b && !aWon} />
      {m.b ? (
        <TeamLine team={sim.teams[m.b]} score={m.sb} state={rowState(1)} won={played && !aWon} lost={played && aWon} />
      ) : (
        <div className="flex items-center px-3 font-mono text-[10px] uppercase tracking-wider italic" style={{ height: ROW_H, color: 'var(--tournament-secondary-text, #6b7280)' }}>
          wolny los
        </div>
      )}
    </div>
  );
}

/** The teams level on record for the last Swiss spot; the organiser decides who advances. */
function TiebreakBox({ teams, sim, after }: { teams: string[]; sim: FormatSim; after: number }) {
  const setHover = useContext(HoverCtx);
  const tb = sim.tiebreak!;
  const reached = after >= tb.round;
  return (
    <div
      onMouseEnter={() => setHover(TIEBREAK_ID)}
      onMouseLeave={() => setHover(null)}
      className="rounded-lg border border-white/25 backdrop-blur-md overflow-hidden divide-y divide-white/5" style={{ width: CARD_W, backgroundColor: 'rgba(255,255,255,0.05)' }}>
      {teams.map(id => {
        const advanced = tb.advanced.includes(id);
        return (
          <TeamLine key={id} team={reached ? sim.teams[id] : undefined} state={reached ? 'played' : 'future'} won={reached && tb.decided && advanced} lost={reached && tb.decided && !advanced} />
        );
      })}
    </div>
  );
}

// ─── Chart ──────────────────────────────────────────────────────────────────

/** `embedded`: inside the snap-scrolling home page — a plain vertical wheel then scrolls the page
 *  (between sections) and only horizontal scrolling / shift+wheel pans the chart. */
export function FormatFlow({ sim, after, embedded = false }: { sim: FormatSim; after: number; embedded?: boolean }) {
  const { theme } = useTournament();
  const primary = theme?.primaryColor || '#d4af37';
  const L = useMemo(() => layout(sim, after), [sim, after]);
  const [hoveredMatch, setHoveredMatch] = useState<string | null>(null);
  const lines = useMemo(() => drawLines(L, after, hoveredMatch), [L, after, hoveredMatch]);

  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [pan, setPan] = useState(0);
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit the height; the width pans.
  const scale = size.h > 0 ? Math.min(size.h / L.H, 1.15) : 0;
  const maxPan = Math.max(0, L.W * scale - size.w);
  const x = maxPan > 0 ? -Math.min(pan, maxPan) : (size.w - L.W * scale) / 2;
  const clampPan = (v: number) => Math.max(0, Math.min(maxPan, v));

  // Wheel pans sideways (the page itself never scrolls).
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (maxPan <= 0) return;
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const delta = horizontal ? e.deltaX : embedded && !e.shiftKey ? 0 : e.deltaY;
      if (!delta) return;
      e.preventDefault();
      e.stopPropagation();
      setPan(p => Math.max(0, Math.min(maxPan, p + delta)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [maxPan, embedded]);

  // Drag pans; a press that moved more than a few pixels is a drag, not a click on a card.
  const drag = useRef<{ x: number; pan: number; moved: boolean } | null>(null);
  const dragged = useRef(false);
  const onDown = (e: ReactPointerEvent) => { dragged.current = false; if (maxPan > 0) drag.current = { x: e.clientX, pan: Math.min(pan, maxPan), moved: false }; };
  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.abs(e.clientX - d.x) > 4) d.moved = true;
    if (d.moved) setPan(clampPan(d.pan - (e.clientX - d.x)));
  };
  const onUp = () => { dragged.current = !!drag.current?.moved; drag.current = null; };

  const [open, setOpen] = useState<FPMatch | null>(null);
  const openMatch = (m: FPMatch) => { if (!dragged.current) setOpen(m); };

  return (
    <HoverCtx.Provider value={setHoveredMatch}>
      <div className="h-full flex flex-col">
        <div
          ref={viewport}
          className={cn('relative flex-1 min-h-0 overflow-hidden select-none', maxPan > 0 && 'cursor-grab active:cursor-grabbing')}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {scale > 0 && (
            <div className="absolute top-0 left-0 origin-top-left" style={{ width: L.W, height: L.H, transform: `translate(${x}px, ${(size.h - L.H * scale) / 2}px) scale(${scale})` }}>
              <svg className="absolute inset-0 pointer-events-none overflow-visible" width={L.W} height={L.H}>
                {lines}
                {L.outcomes.map((o, i) => (
                  <g key={`out-${i}`} opacity={0.9}><Arrow x={o.x + 8} y={o.y} len={19} color={o.lan ? WIN : 'rgba(255,255,255,0.35)'} /></g>
                ))}
              </svg>

              {[...L.buckets.values()].map(b => (
                <div key={b.id} className="absolute" style={{ left: b.x, top: b.y, width: CARD_W }}>
                  <div className="flex items-baseline gap-2 font-mono font-bold text-sm leading-none px-0.5" style={{ height: REC_H, color: primary }}>
                    {b.rec}
                    {/* The only named step: the tied teams must know a tiebreaker awaits them */}
                    {b.tiebreak && (
                      <span className="font-logik-extended-bold text-[11px] uppercase tracking-widest" style={{ color: 'var(--tournament-title, white)' }}>dogrywka o awans</span>
                    )}
                  </div>
                  {b.tiebreak ? (
                    <TiebreakBox teams={b.tiebreak} sim={sim} after={after} />
                  ) : (
                    <div className="flex flex-col" style={{ gap: CARD_GAP }}>
                      {b.matches.map(m => <MatchCard key={m.id} m={m} sim={sim} after={after} onOpen={openMatch} />)}
                    </div>
                  )}
                </div>
              ))}

              {L.outcomes.map((o, i) => (
                <div
                  key={`outt-${i}`}
                  className="absolute font-logik-extended-bold text-[11px] uppercase tracking-widest whitespace-nowrap leading-none"
                  style={{ left: o.x + 33, top: o.y - 6, color: o.lan ? WIN : 'var(--tournament-secondary-text, #9ca3af)' }}
                >
                  {o.text}
                </div>
              ))}
            </div>
          )}
        </div>

        {maxPan > 0 && (
          <div className="shrink-0 flex justify-center pt-3">
            <input
              type="range"
              min={0}
              max={Math.round(maxPan)}
              value={Math.round(Math.min(pan, maxPan))}
              onChange={e => setPan(Number(e.target.value))}
              aria-label="Przesuń schemat"
              className="w-full max-w-xl h-1 cursor-pointer"
              style={{ accentColor: primary }}
            />
          </div>
        )}

        <MatchDetailModal match={open ? toModalMatch(open, sim, after) : null} isOpen={!!open} onClose={() => setOpen(null)} divisionColor={primary} />
      </div>
    </HoverCtx.Provider>
  );
}
