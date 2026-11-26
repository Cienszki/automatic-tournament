// The findings and owner corrections of the import report. A finding about a match or a game
// names it readably (labels.ts): tournament, stage and round, the two teams, the date and the
// score, then the id. Those labels hold team names and match ids only, so they stay in a
// redacted report; paths, user ids and Steam ids (the `ref` of a finding) do not.

import type { Finding } from './context';
import type { CorrectionOutcome } from './corrections';
import type { MatchLabels } from './labels';

/** Examples shown per group: plain references, and readable match or game labels. */
const EXAMPLES = 3;
const LABELLED = 12;

export interface FindingOptions {
  redact?: boolean;
}

const TITLES = {
  unmapped: 'Not imported (a document or a value)',
  conflict: 'Conflicts in the old data, and how they were settled',
  'unknown-field': 'Fields no mapper names',
  decision: 'Decisions taken where the old data was ambiguous',
} as const;

export interface FindingGroup { kind: string; code: Finding['code']; reason: string; count: number; refs: string[]; items: Finding[] }

export function groupFindings(findings: readonly Finding[]): FindingGroup[] {
  const map = new Map<string, FindingGroup>();
  for (const f of findings) {
    const key = `${f.code}|${f.kind}|${f.reason}`;
    let g = map.get(key);
    if (!g) {
      g = { kind: f.kind, code: f.code, reason: f.reason, count: 0, refs: [], items: [] };
      map.set(key, g);
    }
    g.count++;
    g.items.push(f);
    if (f.ref) g.refs.push(f.ref);
  }
  return [...map.values()];
}

/** The readable name of what a finding is about, or null when it is about no match. */
export function labelOf(f: Finding, labels: MatchLabels | null): string | null {
  if (!f.about || !labels) return null;
  const { matchId, game, alsoUnder } = f.about;
  const main = game ? labels.game(matchId, game) : labels.match(matchId);
  const also = alsoUnder?.length ? `; also stored under ${alsoUnder.map((id) => labels.match(id)).join(' and ')}` : '';
  return `${main}${also}`;
}

export function renderFindings(findings: readonly Finding[], options: FindingOptions, labels: MatchLabels | null): string[] {
  const out = ['### Findings', ''];
  const groups = groupFindings(findings);
  if (!groups.length) out.push('None.', '');
  for (const code of ['unmapped', 'conflict', 'unknown-field', 'decision'] as const) {
    const list = groups.filter((g) => g.code === code);
    if (!list.length) continue;
    out.push(`${TITLES[code]}:`, '');
    for (const g of list) out.push(...renderGroup(g, options, labels));
    out.push('');
  }
  return out;
}

function renderGroup(g: FindingGroup, options: FindingOptions, labels: MatchLabels | null): string[] {
  const named = g.items.map((f) => ({ f, label: labelOf(f, labels) })).filter((x): x is { f: Finding; label: string } => x.label !== null);
  if (named.length) {
    const lines = [`- ${g.kind}: ${g.reason} (${g.count})`];
    for (const { f, label } of named.slice(0, LABELLED)) lines.push(`  - ${label}${!options.redact && f.ref ? ` — \`${f.ref}\`` : ''}`);
    if (named.length > LABELLED) lines.push(`  - … ${named.length - LABELLED} more`);
    return lines;
  }
  // A count ("65 values", "12 documents") names nobody and stays in a redacted report.
  const shown = options.redact ? g.refs.filter((r) => /^\d+ [a-z]+$/.test(r)) : g.refs;
  const refs = shown.slice(0, EXAMPLES).map((r) => `\`${r}\``).join('; ');
  return [`- ${g.kind}: ${g.reason} (${g.count})${refs ? ` — ${refs}${shown.length > EXAMPLES ? ' …' : ''}` : ''}`];
}

/** The owner corrections of one tournament: what each changed, or that it matched nothing. Redacted, Steam ids are left out. */
export function renderCorrections(outcomes: readonly CorrectionOutcome[], options: FindingOptions = {}): string[] {
  if (!outcomes.length) return [];
  const applied = outcomes.filter((o) => o.status === 'applied').length;
  const out = ['### Owner corrections', '', `${applied} of ${outcomes.length} applied (scripts/import/owner-corrections.json).`, ''];
  for (const o of outcomes) {
    const line = `- ${o.status === 'applied' ? 'Applied owner correction' : '**Matched no row**'}: ${o.label}. ${capital(o.change)}. ${o.reason} (\`${o.id}\`; ${o.source})`;
    out.push(options.redact ? line.replace(STEAM64, 'a Steam account') : line);
  }
  out.push('');
  return out;
}

const STEAM64 = /7656\d{13}/g;
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
