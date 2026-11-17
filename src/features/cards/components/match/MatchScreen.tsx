'use client';

// A whole match against the computer on the 1920×900 stage. Layout: the top bar; three objective
// rows (the player's units on the left, toward their Ancient; the rival's on the right); the hand,
// the one prompt line, the order gems and the round button at the bottom. This file only lays the
// parts out and connects them; the stage and every number come from useMatch.
import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { mix } from '@/components/stats-lab/kit';
import { baseMight } from '@/lib/card-lab/outposts';
import { useFitScale } from '@/components/card-lab/ui';
import { chime, titleAlert } from '@/lib/card-lab/chime';
import { pulseAt } from '@/components/tour/pulse';
import { LEVELS } from '@/features/cards/domain/v2/ai/levels';
import { SLOTS } from '@/features/cards/domain/v2/types';
import { logRounds } from '@/features/cards/state/log';
import { shownHp } from '@/features/cards/state/ledger';
import { ME, type UnitModel } from '@/features/cards/state/scene';
import { ActionBar, PromptLine } from './ActionBar';
import { lookOf, linesOf, rowFxOf, verdictOf, type LookCtx } from './board';
import { CombatLog } from './CombatLog';
import { DragGhost } from './DragGhost';
import { EndScreen } from './EndScreen';
import { Figure } from './Figure';
import { FightLayer } from './FightLayer';
import { Hand } from './Hand';
import { Hud } from './Hud';
import { Banner, Flyers, Names } from './Overlays';
import { Row, CENTER_W } from './Row';
import { RulesPage } from './RulesPage';
import { buttonOf, pendingOf, promptOf } from './prompt';
import { KEYFRAMES, T } from './theme';
import { useInput } from './useInput';
import { useMatch, type MatchOptions } from './useMatch';

export interface MatchScreenProps extends MatchOptions { onRematch: () => void; onNew: () => void; onExit: () => void }

const TOP = 64; const BOTTOM = 214;

export function MatchScreen({ seed, cast, jump, step, onRematch, onNew, onExit }: MatchScreenProps) {
  const m = useMatch({ seed, cast, jump, step });
  const fit = useFitScale();
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [rowsEl, setRowsEl] = useState<HTMLDivElement | null>(null);
  const [rowH, setRowH] = useState(210);
  const [logOpen, setLogOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ text: string; side: 0 | 1 | null; key: number } | null>(null);
  const [edge, setEdge] = useState(0);
  const input = useInput(m, rowsEl, fit);
  const { stage, scene, ps } = m;
  const costMode = m.rules.costMode;

  useEffect(() => {
    if (!rowsEl) return;
    const ro = new ResizeObserver(() => setRowH(rowsEl.clientHeight / 3)); ro.observe(rowsEl); return () => ro.disconnect();
  }, [rowsEl]);
  const w = Math.round(Math.max(80, Math.min(168, (rowH - 22) / 1.34)));

  // The game waits while the log or the rules are open
  useEffect(() => { m.setPaused(logOpen || rulesOpen); }, [logOpen, rulesOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  // Why a tap did nothing, long enough to read
  // Why a refused tap did nothing; out of orders, the gems pulse
  useEffect(() => { if (!ps.why) return; setNote(ps.why); if (/rozkaz/.test(ps.why)) pulseAt('[data-orders]'); }, [ps.refused]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ps.ask) setNote(null); }, [ps.ask]);
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(null), Math.max(2600, note.length * 55)); return () => clearTimeout(t); }, [note, ps.refused]);
  // A new round: the banner, the board's edge lights up; in another tab a chime and a blinking title
  const roundNow = stage.kind === 'plan' ? stage.view.public.round : null;
  useEffect(() => {
    if (roundNow === null) return;
    setBanner({ text: `Runda ${roundNow}`, side: ME, key: Date.now() }); setEdge(Date.now());
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') { chime('turn'); titleAlert('Twoja runda'); }
  }, [roundNow]);
  useEffect(() => { if (stage.kind === 'fight') setBanner({ text: 'Walka', side: null, key: Date.now() }); }, [stage.kind]);
  useEffect(() => { if (!banner) return; const t = setTimeout(() => setBanner(null), banner.side === null ? 1000 : 1500); return () => clearTimeout(t); }, [banner]);

  const carried = new Set(input.carry.carry?.refs.map((r) => (r.kind === 'card' ? `0:${r.id}` : r.uid)) ?? []);
  const stepKey = stage.kind === 'show' ? stage.steps[m.step].key : null;
  const ctx: LookCtx = { stage, scene, ps, choice: m.choice, aimFrom: m.aimFrom, glow: m.glow.units, carried, stepKey };
  const carriedTargets = input.carry.carry ? m.targetsFor(input.carry.carry.refs) : null;
  const targets = carriedTargets ?? m.targets;
  const lines = useMemo(() => linesOf(ctx), [stage, scene, m.choice, m.aimFrom]); // eslint-disable-line react-hooks/exhaustive-deps
  const hp = shownHp(scene.hp, m.ledger);
  const rival = stage.kind === 'plan' ? stage.view.rival : stage.kind === 'fight' ? stage.mid.rival : null;
  const [rivalCounts, setRivalCounts] = useState({ hand: scene.rivalHand, deck: 0, grave: 0 });
  useEffect(() => { if (rival) setRivalCounts({ hand: rival.handSize, deck: rival.deckSize, grave: rival.grave.length }); }, [rival]);

  const draw = (u: UnitModel) => {
    const settle = input.settled.has(u.uid);
    const interactive = stage.kind === 'plan' ? u.side === ME : stage.kind === 'fight';
    return (
      <Figure key={u.uid} layoutId={settle ? undefined : u.uid} settle={settle} dataUid={u.uid} card={u.card} side={u.side} w={w} strength={u.strength} parts={u.parts} lost={u.lost}
        look={lookOf(u, ctx)} costMode={costMode} info={!input.carry.carry && !input.aim} held={input.held === `unit:${u.uid}` || (u.planned === 'play' && input.held === `card:${u.card.id}`)}
        grow={u.at === 0 ? 'down' : u.at === 2 ? 'up' : 'center'} note={u.out ? 'Gank: nie liczy się w tej rundzie.' : undefined}
        onPointerDown={interactive ? (e) => input.pressUnit(e, u) : undefined} />
    );
  };
  const ghostModels: UnitModel[] = input.carry.carry ? input.carry.carry.refs.flatMap((r): UnitModel[] => {
    const uid = r.kind === 'card' ? `0:${r.id}` : r.uid;
    const onBoard = scene.units.find((u) => u.uid === uid);
    if (onBoard) return [onBoard];
    const c = r.kind === 'card' ? scene.hand.find((x) => x.id === r.id) : undefined;
    return c ? [{ uid, card: c, side: ME, at: 0, strength: baseMight(c), parts: { base: baseMight(c), growth: 0, aura: 0, team: 0, highGround: 0 }, out: false, lost: 0 }] : [];
  }) : [];
  const handPicked = new Set(ps.picks.flatMap((p) => (p.kind === 'card' ? [p.id] : [])));
  const end = stage.kind === 'end' && !m.ledger.flying.length;

  return (
    <div ref={setRoot} className="relative h-full flex flex-col overflow-hidden select-none" style={{ background: `radial-gradient(110% 80% at 45% 0%, #191c25, ${T.bg} 62%)`, color: T.text }}
      onClick={() => { if (stage.kind === 'show') m.skip(); else if (stage.kind === 'plan' && (ps.picks.length || ps.ask)) m.plan({ type: 'pick', ref: null }); }}>
      <style>{KEYFRAMES}</style>
      <AnimatePresence>
        {edge > 0 && <motion.div key={edge} className="absolute inset-0 z-[35] pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.6, 0] }} transition={{ duration: 2.2, times: [0, 0.15, 0.5, 1] }}
          onAnimationComplete={() => setEdge(0)} style={{ boxShadow: `inset 0 0 0 4px ${T.me}, inset 0 0 120px ${mix(T.me, 45)}` }} />}
      </AnimatePresence>
      <Hud hp={hp} max={m.rules.hp} round={scene.round} lateFrom={m.rules.lateFrom} lastRound={m.rules.roundCap} rival={rivalCounts} level={m.level} thinking={m.thinking}
        onBack={onExit} onHelp={() => setRulesOpen(true)} onLog={() => setLogOpen(true)} report={() => ({ mode: 'v2-computer', ...m.debug() })} />
      <LayoutGroup>
        <div ref={setRowsEl} className="relative flex-1 min-h-0 flex flex-col" style={{ maxHeight: `calc(100% - ${TOP + BOTTOM}px)` }}>
          {SLOTS.map((at) => (
            <React.Fragment key={at}>
              {at > 0 && <div className="h-px shrink-0" style={{ background: `linear-gradient(90deg, transparent, ${T.line}, transparent)` }} />}
              <Row slot={at} o={scene.objectives[at]} units={scene.units.filter((u) => u.at === at)} capacity={m.rules.capacity} w={w} h={rowH - 1}
                draw={draw} target={stage.kind === 'plan' ? targets?.[at] ?? null : null} verdict={verdictOf(scene, at)} fx={rowFxOf(scene, at, stage)} onTap={() => input.tapRow(at)} />
            </React.Fragment>
          ))}
          <FightLayer board={rowsEl} fit={fit} tick={m.tick} lines={lines} live={input.aim} />
        </div>
        <div className="relative shrink-0 flex flex-col" style={{ height: BOTTOM }} onClick={(e) => e.stopPropagation()}>
          <PromptLine p={promptOf(m, note)} />
          <div className="relative z-0 flex-1 flex items-end justify-center pb-3">
            <Hand cards={scene.hand} costMode={costMode} glow={m.glow.cards} picked={handPicked} dragged={carried.size ? new Set([...carried].map((u) => u.slice(2))) : new Set()} held={input.held}
              away={stage.kind !== 'plan' || m.waiting} dragging={!!input.carry.carry} onPress={(e, c) => input.pressCard(e, { kind: 'card', id: c.id })} />
            <div className="absolute bottom-3" style={{ right: Math.max(40, (CENTER_W - 124) / 2 + 20) }}>
              <ActionBar orders={stage.kind === 'plan' ? { ...scene.orders, pending: pendingOf(targets, input.over, ps.picks.length) } : null}
                canUndo={stage.kind === 'plan' && ps.plan.length > 0 && !m.waiting} onUndo={() => m.plan({ type: 'undo' })} button={buttonOf(m)} onButton={() => (stage.kind === 'show' ? m.skip() : void m.confirm())} />
            </div>
          </div>
        </div>
      </LayoutGroup>
      <Flyers flying={m.ledger.flying} root={root} fit={fit} onLand={m.landed} />
      <Names names={m.names} root={root} fit={fit} tick={m.tick} />
      <Banner banner={banner} />
      <AnimatePresence>{logOpen && <CombatLog rounds={logRounds(m.log)} objectives={scene.objectives.map((o) => o.id)} onClose={() => setLogOpen(false)} />}</AnimatePresence>
      <AnimatePresence>{rulesOpen && <RulesPage onClose={() => setRulesOpen(false)} />}</AnimatePresence>
      <AnimatePresence>{end && stage.kind === 'end' && <EndScreen result={stage.result} hp={scene.hp} rival={`Komputer ${LEVELS[m.level].name}`} onRematch={onRematch} onNew={onNew} onExit={onExit} />}</AnimatePresence>
      {input.carry.carry && <DragGhost models={ghostModels} w={input.carry.carry.w / fit} fit={fit} pointer={input.carry.pointer.current} ghostRef={input.carry.ghost} costMode={costMode} />}
    </div>
  );
}
