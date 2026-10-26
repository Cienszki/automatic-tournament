'use client';

// The cheat sheet: both teams' pick order and heroes (as corrected by the captain), and the planned
// draft in BOTH variants (we start / they start) — who starts is only settled in the lobby. Text is
// Discord markdown.

import { useMemo } from 'react';
import { heroName } from '@/lib/stats-lab/heroes';
import { DATA_LABEL, dataLevel, planDraft, predictOrder, roleLabel, type PlanStep, type PlayerModel } from '@/lib/draft-prep/engine';
import { useDP } from './state';

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
      `**Ich kolejność wyboru:** ${order.map(o => `${o.k + 1}. ${o.pm.p.name}`).join(' → ')}`,
      '**Ich bohaterowie:**',
      ...order.map(o => {
        const lvl = dataLevel(o.pm.p);
        return `• ${o.pm.p.name} — ${roleLabel(o.pm.p.role)}: ${topHeroes(o.pm, 4).map(heroName).join(', ')}${lvl === 'none' || lvl === 'low' ? ` _(${DATA_LABEL[lvl]})_` : ''}`;
      }),
      `**Nasza kolejność wyboru:** ${orderUs.map(o => `${o.k + 1}. ${o.pm.p.name}`).join(' → ')}`,
      ...plans.flatMap(pl => [
        '',
        `**Jeśli ${pl.usFirst ? 'zaczynamy my' : 'zaczynają oni'}:**`,
        `Nasze bany (krok): ${list(pl.bans)}`,
        `Oni pewnie zbanują: ${list(pl.theirBans)}`,
        `Nasze picki: ${list(pl.picks, true)}`,
      ]),
    ];
    return { plans, order, orderUs, heroesOf: (key: string) => { const pm = [...dp.players.them, ...dp.players.us].find(p => p.p.key === key); return pm ? topHeroes(pm) : []; }, lines };
  }, [d, dp.players.them, dp.players.us, dp.them, dp.match]);
}
