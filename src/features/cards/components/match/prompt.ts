// The one line that says whose move it is and what is asked (GAME_DESIGN 6: "the place where the
// game always shows whose move it is"), the round button's label, and how many order gems blink.
import type { Slot } from '@/features/cards/domain/v2/types';
import type { TargetInfo } from '@/features/cards/state/plan';
import type { Prompt } from './ActionBar';
import type { DropAt } from './useCarry';
import type { MatchApi } from './useMatch';

const FIGHT_KEYS = /^(aim|impact|verdict|next)/;

export function promptOf(m: MatchApi, note: string | null): Prompt | null {
  const { stage, ps, choice } = m;
  if (stage.kind === 'plan') {
    const label = 'Planowanie';
    if (note) return { label, text: note, warn: true };
    if (m.waiting) return { label, text: 'Rywal planuje', wait: true };
    if (ps.ask) return { label, text: 'Wybierz jednostkę, która zejdzie' };
    if (ps.picks.length) return { label, text: 'Wybierz objective' };
    return { label, text: m.ready ? 'Zatwierdź' : 'Twój ruch' };
  }
  if (stage.kind === 'fight') {
    const label = 'Walka';
    if (m.waiting) return { label, text: 'Rywal wybiera', wait: true };
    if (choice.target === null && stage.options.targets.length) return { label, text: 'Uderz' };
    if (choice.guard === null && stage.options.guards.length) return { label, text: 'Osłoń' };
    return { label, text: 'Zatwierdź' };
  }
  if (stage.kind === 'show') return { label: `Runda ${m.scene.round}`, text: FIGHT_KEYS.test(stage.steps[m.step].key) ? 'Walka' : 'Odsłona' };
  return null;
}

export function buttonOf(m: MatchApi): { label: string; sub?: string; enabled: boolean; pulse: boolean } {
  const { stage } = m;
  if (stage.kind === 'show') return { label: 'Pomiń', enabled: true, pulse: false };
  if (stage.kind === 'end') return { label: 'Koniec', enabled: false, pulse: false };
  if (m.waiting) return { label: 'Zatwierdź', sub: 'czekam na rywala', enabled: false, pulse: false };
  if (stage.kind === 'plan') return { label: 'Zatwierdź', sub: m.ps.plan.length ? undefined : 'bez rozkazów', enabled: !m.ps.ask, pulse: m.ready };
  return { label: 'Zatwierdź', sub: m.ready ? undefined : 'cios i osłona', enabled: true, pulse: m.ready };
}

/** Gems that would be spent by what is picked or carried: exactly, over a target; else the least */
export function pendingOf(targets: [TargetInfo, TargetInfo, TargetInfo] | null, over: DropAt, picks: number): number {
  if (!targets) return 0;
  if (over !== null && over !== 'hand') { const t = targets[over as Slot]; if (t.kind === 'ok' || t.kind === 'replace') return Math.max(0, t.cost); }
  const costs = targets.filter((t) => t.kind === 'ok' || t.kind === 'replace').map((t) => Math.max(0, t.cost));
  return costs.length ? Math.min(...costs) : Math.min(picks, 0);
}
