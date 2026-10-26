'use client';

// The cheat sheet: both teams' pick order and heroes (as corrected by the captain), and the planned
// draft in BOTH variants (we start / they start) — who starts is only settled in the lobby. Text is
// Discord markdown; a role sits in it as a ⟦Role⟧ token (⟦#Role⟧ = icon only), drawn as its icon on
// screen and written out as plain text when copied.

import { useMemo } from 'react';
import { C } from '@/components/stats-lab/kit';
import { heroName } from '@/lib/stats-lab/heroes';
import { DATA_LABEL, ROLE_SHORT, dataLevel, planDraft, predictOrder, roleLabel, type PlanStep, type PlayerModel } from '@/lib/draft-prep/engine';
import { useDP } from './state';
import { RoleTag } from './role';

export interface SheetPlan { usFirst: boolean; bans: PlanStep[]; theirBans: PlanStep[]; picks: PlanStep[] }

/** A player's likeliest heroes, best first (heroes the captain ruled out never appear) */
export const topHeroes = (pm: PlayerModel, n = 5) => [...pm.like.entries()].filter(([, l]) => l > 0).sort((a, b) => b[1] - a[1]).slice(0, n).map(([h]) => h);

export function useCheatSheet() {
  const dp = useDP(); const d = dp.input;
  return useMemo(() => {
    if (!d) return null;
    const plans: SheetPlan[] = [true, false].map(usFirst => {
      const plan = planDraft({ ...d, usFirst, steps: d.steps.map(() => null), assign: {} });
      return { usFirst, bans: plan.filter(x => x.us && !x.pick), theirBans: plan.filter(x => !x.us && !x.pick), picks: plan.filter(x => x.us && x.pick) };
    });
    const order = predictOrder(d.habitsThem, dp.players.them);
    const orderUs = predictOrder(d.habitsUs, dp.players.us);
    const when = dp.match?.scheduledFor ? new Date(dp.match.scheduledFor).toLocaleString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;
    const list = (xs: PlanStep[], who = false) => xs.map(x => `${x.i + 1}. ${heroName(x.hero)}${who && x.player ? ` (${x.player.p.name})` : ''}`).join(', ');
    const lines: string[] = [
      `**Draft vs ${dp.them?.name ?? '?'}**${when ? ` · ${when}` : ''}${dp.match?.bestOf ? ` · Bo${dp.match.bestOf}` : ''}`,
      `**Ich kolejność wyboru:** ${order.map(o => `${o.k + 1}. ${o.pm.p.name} ⟦#${o.pm.p.role ?? ''}⟧`).join(' → ')}`,
      '**Ich bohaterowie:**',
      ...order.map(o => {
        const lvl = dataLevel(o.pm.p);
        return `• ${o.pm.p.name} — ⟦${o.pm.p.role ?? ''}⟧: ${topHeroes(o.pm, 4).map(heroName).join(', ')}${lvl === 'none' || lvl === 'low' ? ` _(${DATA_LABEL[lvl]})_` : ''}`;
      }),
      `**Nasza kolejność wyboru:** ${orderUs.map(o => `${o.k + 1}. ${o.pm.p.name} ⟦#${o.pm.p.role ?? ''}⟧`).join(' → ')}`,
      ...plans.flatMap(pl => [
        '',
        `**Jeśli ${pl.usFirst ? 'zaczynamy my' : 'zaczynają oni'}:**`,
        `Nasze bany (krok): ${list(pl.bans)}`,
        `Oni pewnie zbanują: ${list(pl.theirBans)}`,
        `Nasze picki: ${list(pl.picks, true)}`,
      ]),
    ];
    const text = lines.map(l => l.replace(ROLE_TOKEN, (_, short, role) => (short ? (ROLE_SHORT[role] ? `(${ROLE_SHORT[role]})` : '') : roleLabel(role || undefined))).replace(/ +$/, '')).join('\n');
    return { plans, order, orderUs, heroesOf: (key: string) => { const pm = [...dp.players.them, ...dp.players.us].find(p => p.p.key === key); return pm ? topHeroes(pm) : []; }, lines, text };
  }, [d, dp.players.them, dp.players.us, dp.them, dp.match]);
}

const ROLE_TOKEN = /⟦(#?)([^⟧]*)⟧/g;

/** The sheet as shown on screen: bold headings, role icons in place of the tokens */
export function SheetLines({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((l, k) => {
        const plain = l.replace(/\*\*/g, '').replace(/_\((.*)\)_/, '($1)');
        const parts = plain.split(/(⟦#?[^⟧]*⟧)/);
        return (
          <div key={k} className={l ? '' : 'h-2'} style={l.startsWith('**') ? { color: C.heading, fontWeight: 700 } : undefined}>
            {parts.map((x, j) => {
              const m = /^⟦(#?)([^⟧]*)⟧$/.exec(x);
              if (!m) return x;
              return m[2] ? <span key={j} className="inline-flex align-[-0.15em]"><RoleTag role={m[2]} label={!m[1]} /></span> : null;
            })}
          </div>
        );
      })}
    </>
  );
}
