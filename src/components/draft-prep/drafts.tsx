'use client';

// The opponent's real drafts in this tournament — the evidence behind every prediction: each
// game's 24 steps in order (theirs raised, the other team's lowered), who started, the result,
// and what the team does again and again (bans, first picks, most picked heroes).

import React, { useMemo } from 'react';
import { C, HeroImg, TeamLogo, Tip, TipBody, ink, mix, useHeaderFont } from '@/components/stats-lab/kit';
import { heroName } from '@/lib/stats-lab/heroes';
import { count } from '@/lib/plural';
import { useDP } from './state';
import { Label, RULE, vh } from './ui';

const MAX_GAMES = 6;

function Tally({ title, items }: { title: string; items: Array<[number, number]> }) {
  return (
    <div className="min-w-0">
      <Label>{title}</Label>
      {items.length ? (
        <div className="flex gap-2">
          {items.map(([h, n]) => (
            <Tip key={h} content={`${heroName(h)} · ${n}×`}>
              <span className="relative block w-[min(5vw,84px)] aspect-video rounded-sm overflow-hidden cursor-help">
                <HeroImg heroId={h} className="w-full h-full" />
                <span className="absolute right-0 bottom-0 px-1 text-[11px] font-bold" style={{ background: 'rgba(0,0,0,0.75)', color: C.heading }}>{n}×</span>
              </span>
            </Tip>
          ))}
        </div>
      ) : <div className="text-sm" style={{ color: C.muted }}>—</div>}
    </div>
  );
}

export function TeamDrafts() {
  const font = useHeaderFont();
  const dp = useDP();
  const them = dp.them; const model = dp.model;
  const data = useMemo(() => {
    if (!them || !model) return null;
    const games = model.games.filter(g => g.radiant === them.id || g.dire === them.id).sort((a, b) => b.start - a.start);
    const bans = new Map<number, number>(); const first = new Map<number, number>(); const picks = new Map<number, number>();
    const inc = (m: Map<number, number>, h: number) => m.set(h, (m.get(h) ?? 0) + 1);
    let started = 0; let wins = 0;
    const rows = games.map(g => {
      const side = g.radiant === them.id ? 0 : 1;
      const pb = [...g.pb].sort((a, b) => a[3] - b[3]);
      const weStart = pb.length > 0 && pb[0][2] === side;
      if (weStart) started++;
      const won = (g.radiantWin ? 0 : 1) === side; if (won) wins++;
      pb.forEach(x => { if (x[2] !== side) return; if (x[1]) inc(picks, x[0]); else inc(bans, x[0]); });
      const own = pb.filter(x => x[1] && x[2] === side); if (own[0]) inc(first, own[0][0]);
      const oppId = side === 0 ? g.dire : g.radiant;
      const who = new Map(g.perfs.map(p => [p.heroId, p.player?.name ?? '?']));
      return { g, side, pb, weStart, won, opp: model.teamById.get(oppId), who };
    });
    const top = (m: Map<number, number>, n: number) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
    return { rows, started, wins, bans: top(bans, 6), first: top(first, 4), picks: top(picks, 6) };
  }, [them, model]);
  if (!data) return null;
  if (!data.rows.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-center" style={{ color: C.muted, fontSize: vh(14, 1.9, 19) }}>
        <div className="max-w-[640px]">{them?.name} nie zagrali jeszcze w tym turnieju, więc nie ma ich draftów. Przewidywania opierają się na grach poszczególnych graczy — zobacz zakładkę „Gracze”.</div>
      </div>
    );
  }
  const n = data.rows.length;
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)] gap-8 items-start pb-3 border-b" style={{ borderColor: RULE }}>
        <div>
          <Label>W turnieju</Label>
          <div className="font-logik-extended-bold tabular-nums" style={{ color: C.heading, fontSize: vh(18, 2.6, 30), ...font }}>{data.wins}–{n - data.wins}</div>
          <div className="text-xs" style={{ color: C.muted }}>zaczynali draft w {data.started} z {count(n, 'gry', 'gier', 'gier')}</div>
        </div>
        <Tally title="Banują najczęściej" items={data.bans} />
        <Tally title="Wybierają najczęściej" items={data.picks} />
        <Tally title="Pierwszy pick" items={data.first} />
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        {data.rows.slice(0, MAX_GAMES).map(r => (
          <div key={r.g.id} className="flex-1 min-h-0 max-h-[110px] flex items-center gap-4 border-b" style={{ borderColor: RULE }}>
            <div className="w-[200px] shrink-0 flex items-center gap-3 min-w-0">
              <TeamLogo team={r.opp} size={34} />
              <span className="min-w-0">
                <span className="block truncate font-bold" style={{ color: C.heading, fontSize: vh(13, 1.7, 17) }}>vs {r.opp?.name ?? '?'}</span>
                <span className="block text-xs" style={{ color: C.muted }}>
                  {new Date(r.g.start * 1000).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })} · <span style={{ color: r.won ? C.win : C.loss }}>{r.won ? 'wygrana' : 'porażka'}</span> · {r.weStart ? 'zaczynali' : 'drudzy'}
                </span>
              </span>
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-[3px]">
              {r.pb.map(x => {
                const theirs = x[2] === r.side; const pick = !!x[1];
                return (
                  <Tip key={x[3]} content={<TipBody title={`${x[3] + 1}. ${pick ? 'pick' : 'ban'} — ${theirs ? them?.name : r.opp?.name ?? 'rywal'}`}>{heroName(x[0])}{pick ? ` · ${r.who.get(x[0]) ?? '?'}` : ''}</TipBody>}>
                    <span className="relative block min-w-0 rounded-sm overflow-hidden cursor-help" style={{ flex: pick ? '1.4 1 0' : '1 1 0', aspectRatio: '16 / 9', transform: `translateY(${theirs ? -4 : 4}px)`, boxShadow: `0 0 0 1px ${mix(theirs ? C.dire : ink(40), theirs ? 70 : 30)}` }}>
                      <HeroImg heroId={x[0]} className="w-full h-full" style={{ filter: pick ? undefined : 'grayscale(1) brightness(0.55)' }} />
                    </span>
                  </Tip>
                );
              })}
            </div>
          </div>
        ))}
        {n > MAX_GAMES && <div className="shrink-0 pt-2 text-xs" style={{ color: C.muted }}>i {count(n - MAX_GAMES, 'starsza gra', 'starsze gry', 'starszych gier')} — liczą się w podsumowaniu wyżej.</div>}
        <div className="shrink-0 pt-2 text-xs" style={{ color: C.muted }}>Wyżej: ruchy {them?.name} (z czerwoną ramką), niżej: rywala. Szare to bany. Najedź, by zobaczyć bohatera i gracza.</div>
      </div>
    </div>
  );
}
