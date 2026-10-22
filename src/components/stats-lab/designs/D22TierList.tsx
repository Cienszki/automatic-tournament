'use client';

// #22 — Tier list. The classic S–D tier list, filled from the data: heroes by (smoothed) win rate
// and how contested they are, players by average performance score (optionally per position).
// "Twoja lista" lets you drag items between tiers (the item follows the cursor); agreement with
// the data is scored, and the list can be downloaded as a PNG.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useTournament } from '@/context/TournamentContext';
import type { HeroX, Model, PlayerX } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { pctRank } from '@/lib/stats-lab/derive';
import { Avatar, C, HeroImg, ImgProxy, LabTitle, LabView, Seg, Tip, TipBody, WithModel, ink, mix, playerTip, useHeaderFont, useSize } from '../kit';
import { useStageScale } from '@/components/ui/ScaledStage';

type Kind = 'heroes' | 'players';
type Mode = 'data' | 'mine';
const TIERS = ['S', 'A', 'B', 'C', 'D'] as const;
type TierName = typeof TIERS[number];
// Classic tier-list colours (fixed meaning, not theme)
const TIER_BG: Record<TierName, string> = { S: '#ff7f7f', A: '#ffbf7f', B: '#ffdf7f', C: '#bfff7f', D: '#7fbfff' };
const CUTS = [0.92, 0.75, 0.5, 0.25]; // percentile thresholds for S, A, B, C
const ROLES = [
  { value: 'all', label: 'Wszyscy', role: '' },
  { value: '1', label: '1', role: 'Carry' },
  { value: '2', label: '2', role: 'Mid' },
  { value: '3', label: '3', role: 'Offlane' },
  { value: '4', label: '4', role: 'Soft Support' },
  { value: '5', label: '5', role: 'Hard Support' },
];

interface Item {
  id: string;
  name: string;
  score: number;
  tier: TierName;
  node: (size: number) => React.ReactNode;
  tip: React.ReactNode;
}

function tierFor(p: number): TierName {
  return p >= CUTS[0] ? 'S' : p >= CUTS[1] ? 'A' : p >= CUTS[2] ? 'B' : p >= CUTS[3] ? 'C' : 'D';
}

function buildItems(model: Model, kind: Kind, role: string): Item[] {
  if (kind === 'heroes') {
    const hs = model.heroes.filter(h => h.contest >= 3);
    const maxC = Math.max(1, ...hs.map(h => h.contest));
    const raw = (h: HeroX) => 0.6 * ((h.wins + 3) / (h.picks + 6)) + 0.4 * (h.contest / maxC) * 0.6;
    const scores = hs.map(raw);
    return hs.map(h => {
      const sc = raw(h);
      return {
        id: String(h.heroId), name: heroName(h.heroId), score: sc, tier: tierFor(pctRank(scores, sc)),
        node: size => <HeroImg heroId={h.heroId} className="rounded-md" style={{ width: size * 1.78, height: size }} />,
        tip: <TipBody title={heroName(h.heroId)}>{h.picks} pick · {h.bans} ban · {h.picks ? `${Math.round(h.wr * 100)}% wygranych` : 'nie grany'}</TipBody>,
      };
    });
  }
  const ps = model.players.filter(p => p.games >= Math.min(model.minGames, 3) && p.agg.score.avg != null && (!role || p.role === role));
  const scores = ps.map(p => p.agg.score.avg!);
  return ps.map((p: PlayerX) => ({
    id: p.id, name: p.name, score: p.agg.score.avg!, tier: tierFor(pctRank(scores, p.agg.score.avg!)),
    node: size => <Avatar player={p} size={size} />,
    tip: <>{playerTip(p)}<div className="text-white/60 mt-0.5">{p.agg.score.avg!.toFixed(2)} pkt fantasy / grę</div></>,
  }));
}

/** Largest item height so every tier fits its items in at most 2 lines (shrinks only if needed) */
function itemSize(counts: number[], w: number, h: number, aspect: number, cap: number) {
  const gap = 6;
  for (let s = cap; s >= 18; s--) {
    const perLine = Math.max(1, Math.floor((w + gap) / (s * aspect + gap)));
    const lines = Math.max(1, ...counts.map(c => Math.ceil(c / perLine)));
    const maxLines = Math.max(1, Math.floor((h + gap) / (s + gap)));
    if (lines <= Math.min(2, maxLines) || (lines <= maxLines && s <= 28)) return s;
  }
  return 18;
}

// ── PNG export ─────────────────────────────────────────────────────────
// The download is a real render of the same tier rows (same components, fonts and colours), laid
// out at a fixed 1600px width with every item at full size, then captured with html-to-image.
// Images go through our same-origin proxy (<ImgProxy>) so the capture isn't blocked by CORS.

function ExportSheet({ rows, kind, title, subtitle, sheetRef }: {
  rows: Array<{ tier: TierName; items: Item[] }>; kind: Kind; title: string; subtitle: string; sheetRef: React.Ref<HTMLDivElement>;
}) {
  const font = useHeaderFont();
  const { theme } = useTournament();
  const size = kind === 'heroes' ? 68 : 92;
  return (
    <div style={{ position: 'fixed', left: -20000, top: 0, pointerEvents: 'none' }} aria-hidden="true">
      <ImgProxy>
        <div ref={sheetRef} style={{ width: 1600, padding: 40, background: theme.backgroundGradient || theme.backgroundColor, color: C.text }}>
          <div className="text-6xl font-logik-extended-bold uppercase tracking-tight leading-none" style={{ color: C.title, ...font }}>{title}</div>
          <div className="mt-3 text-sm uppercase tracking-[0.25em]" style={{ color: C.muted }}>{subtitle}</div>
          <div className="mt-8 flex flex-col gap-3">
            {rows.map(r => (
              <div key={r.tier} className="flex rounded-2xl overflow-hidden" style={{ background: ink(4), border: `1px solid ${ink(10)}` }}>
                <div className="w-32 shrink-0 flex items-center justify-center text-7xl font-logik-extended-bold text-black/80" style={{ background: TIER_BG[r.tier], minHeight: size + 32, ...font }}>{r.tier}</div>
                <div className="flex-1 flex flex-wrap content-center gap-3 p-4">
                  {r.items.map(it => (
                    <div key={it.id} className="flex flex-col items-center" style={{ width: kind === 'players' ? size + 8 : undefined }}>
                      {it.node(size)}
                      {kind === 'players' && <div className="mt-1 text-xs font-semibold text-center truncate w-full">{it.name}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 text-base" style={{ color: C.muted }}>dota2inhouse.pl</div>
        </div>
      </ImgProxy>
    </div>
  );
}

async function captureSheet(node: HTMLElement, file: string) {
  const { toPng } = await import('html-to-image');
  // Wait for every image (proxied) and the web fonts
  await Promise.all([...node.querySelectorAll('img')].map(img => (img.complete ? null : new Promise(res => { img.onload = res; img.onerror = res; }))));
  await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
  let url: string;
  try { url = await toPng(node, { pixelRatio: 1.25, cacheBust: false }); }
  catch { url = await toPng(node, { pixelRatio: 1.25, cacheBust: false, skipFonts: true }); }
  const a = document.createElement('a'); a.href = url; a.download = file; a.click();
}

// ── View ───────────────────────────────────────────────────────────────

function TierList({ model }: { model: Model }) {
  const font = useHeaderFont();
  const { tournament } = useTournament();
  const [kind, setKind] = useState<Kind>('heroes');
  const [mode, setMode] = useState<Mode>('data');
  const [roleKey, setRoleKey] = useState('all');
  const role = kind === 'players' ? ROLES.find(r => r.value === roleKey)?.role ?? '' : '';
  const items = useMemo(() => buildItems(model, kind, role), [model, kind, role]);
  const storeKey = `statslab-tiers-${model.ds.tournamentId}-${kind}-${role || 'all'}`;
  const [mine, setMine] = useState<Record<string, TierName>>({});
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; over: TierName | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [ref, box] = useSize<HTMLDivElement>();

  useEffect(() => {
    let saved: Record<string, TierName> = {};
    try { saved = JSON.parse(localStorage.getItem(storeKey) || '{}'); } catch { /* storage blocked */ }
    setMine(saved);
  }, [storeKey]);
  const save = useCallback((next: Record<string, TierName>) => { setMine(next); try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* storage blocked */ } }, [storeKey]);

  const tierOf = (it: Item): TierName => (mode === 'mine' ? mine[it.id] ?? it.tier : it.tier);
  const agree = items.length ? items.filter(it => (mine[it.id] ?? it.tier) === it.tier).length / items.length : 1;
  const rows = TIERS.map(t => ({ tier: t, items: items.filter(it => tierOf(it) === t).sort((a, b) => b.score - a.score) }));

  // Item size: as big as possible, 2 lines per tier before shrinking
  const aspect = kind === 'heroes' ? 1.78 : 1;
  const rowH = (box.h - 4 * 8) / 5 - 12;
  const size = box.w > 0 ? itemSize(rows.map(r => r.items.length), box.w - 96 - 20, rowH, aspect, kind === 'heroes' ? 64 : 76) : 40;

  // Pointer drag: the item follows the cursor; drop on the tier under it
  const dragRef = useRef(drag); dragRef.current = drag;
  const stageScale = useStageScale();
  const dragId = drag?.id;
  useEffect(() => {
    if (!dragId) return;
    const tierAt = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest('[data-tier]')?.getAttribute('data-tier') as TierName | null) ?? null;
    const move = (e: PointerEvent) => setDrag(d => d && { ...d, x: e.clientX, y: e.clientY, over: tierAt(e.clientX, e.clientY) });
    const up = (e: PointerEvent) => {
      const d = dragRef.current; const t = tierAt(e.clientX, e.clientY);
      if (d && t) save({ ...mine, [d.id]: t });
      setDrag(null);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [dragId, mine, save]);

  const dragged = drag ? items.find(it => it.id === drag.id) : null;
  const [exporting, setExporting] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const what = kind === 'heroes' ? 'Bohaterowie' : `Gracze${role ? ` · ${role}` : ''}`;
  const exportTitle = `${mode === 'mine' ? 'Moja lista tierów' : 'Lista tierów'} — ${what}`;
  const fileName = `tierlista-${tournament?.slug ?? 'turniej'}-${kind}${role ? `-${role.replace(' ', '-').toLowerCase()}` : ''}.png`;
  const download = () => { setBusy(true); setExporting(true); };
  useEffect(() => {
    if (!exporting || !sheetRef.current) return;
    let alive = true;
    // one frame so the sheet is laid out before capture
    requestAnimationFrame(() => {
      captureSheet(sheetRef.current!, fileName).finally(() => { if (alive) { setExporting(false); setBusy(false); } });
    });
    return () => { alive = false; };
  }, [exporting]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <LabTitle
        sub={mode === 'mine'
          ? <Tip content="Ile pozycji leży w tym samym tierze co według danych"><span className="cursor-help">zgodność z danymi: {Math.round(agree * 100)}% · przeciągaj, by zmienić</span></Tip>
          : <span>{kind === 'heroes' ? 'skuteczność + popularność w drafcie' : 'średnie punkty fantasy'}</span>}
        right={
          <div className="flex gap-2 items-center flex-wrap justify-end">
            {kind === 'players' && <Seg value={roleKey} onChange={setRoleKey} options={ROLES.map(r => ({ value: r.value, label: r.label, tip: r.role || undefined }))} />}
            <Seg value={kind} onChange={setKind} options={[{ value: 'heroes', label: 'Bohaterowie' }, { value: 'players', label: 'Gracze' }]} />
            <Seg value={mode} onChange={setMode} options={[{ value: 'data', label: 'Dane' }, { value: 'mine', label: 'Twoja lista', tip: 'Przeciągaj pozycje między tierami' }]} />
            {mode === 'mine' && Object.keys(mine).length > 0 && <button type="button" onClick={() => save({})} className="text-[11px] uppercase tracking-widest px-3.5 py-2 rounded-full" style={{ background: ink(6) }}>Reset</button>}
            <Tip content="Pobierz tę listę jako obrazek PNG">
              <button type="button" onClick={download} disabled={busy} className="text-[11px] font-bold uppercase tracking-widest px-4 py-2 rounded-full disabled:opacity-50" style={{ background: C.primary, color: '#fff' }}>{busy ? 'Generuję…' : 'Pobierz PNG'}</button>
            </Tip>
          </div>
        }
      >
        Lista tierów
      </LabTitle>
      <div ref={ref} className="flex-1 min-h-0 flex flex-col gap-2 mt-3 select-none">
        {rows.map(({ tier: t, items: row }) => (
          <div key={t} data-tier={t} className="flex-1 min-h-0 flex rounded-xl overflow-hidden transition-all"
            style={{ background: drag?.over === t ? ink(12) : ink(3), border: `1px solid ${drag?.over === t ? TIER_BG[t] : ink(8)}` }}>
            <Tip content={`Tier ${t}: ${t === 'S' ? 'najlepsze 8%' : t === 'A' ? 'kolejne 17%' : t === 'B' ? 'górna połowa' : t === 'C' ? 'dolna połowa' : 'najsłabsze 25%'}`}>
              <div className="w-24 shrink-0 flex items-center justify-center text-5xl font-logik-extended-bold text-black/80 cursor-help" style={{ background: TIER_BG[t], ...font }}>{t}</div>
            </Tip>
            <div className="flex-1 min-w-0 flex flex-wrap content-center gap-1.5 px-2.5 py-1.5 overflow-hidden">
              {row.map(it => {
                const off = mode === 'mine' && (mine[it.id] ?? it.tier) !== it.tier;
                return (
                  <Tip key={it.id} content={<>{it.tip}{off && <div className="text-white/60 mt-0.5">Według danych: tier {it.tier}</div>}</>}>
                    <div onPointerDown={e => { if (mode !== 'mine') return; e.preventDefault(); setDrag({ id: it.id, x: e.clientX, y: e.clientY, over: tierOf(it) }); }}
                      className="relative shrink-0" style={{ cursor: mode === 'mine' ? 'grab' : 'default', opacity: drag?.id === it.id ? 0.25 : 1, touchAction: 'none' }}>
                      <motion.div layout="position" layoutId={`${kind}-${it.id}`} transition={{ type: 'spring', stiffness: 400, damping: 34 }}>
                        {it.node(size)}
                      </motion.div>
                      {off && <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center text-black shadow" style={{ background: TIER_BG[it.tier] }}>{it.tier}</span>}
                    </div>
                  </Tip>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {exporting && <ExportSheet rows={rows} kind={kind} title={exportTitle} subtitle={tournament?.name ?? ''} sheetRef={sheetRef} />}
      {/* Portalled: inside the scaled stats stage `fixed` would resolve against the stage, not the screen */}
      {dragged && drag && createPortal(
        <div className="fixed z-[9999] pointer-events-none" style={{ left: drag.x, top: drag.y, transform: 'translate(-50%, -50%) scale(1.25) rotate(-4deg)', filter: `drop-shadow(0 12px 22px rgba(0,0,0,0.55)) drop-shadow(0 0 10px ${mix(C.secondary, 60)})` }}>
          {dragged.node(size * stageScale)}
        </div>,
        document.body,
      )}
    </>
  );
}

export default function D22TierList() {
  return <LabView><WithModel>{m => <TierList model={m} />}</WithModel></LabView>;
}
