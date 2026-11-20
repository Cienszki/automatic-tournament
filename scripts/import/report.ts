// The import report, as Markdown: per tournament, what was read and what became of it, the rows
// per table, every finding grouped by its reason, and the standings comparison. Ids in findings
// are paths and ids from the capture; with `--anonymize` the report itself names no person.

import type { Finding } from './context';
import type { RunResult, TournamentResult } from './run';

const EXAMPLES = 3;

export function totalChanges(result: RunResult): number {
  return result.tournaments.reduce((n, t) => n + t.writes.reduce((m, w) => m + w.inserted + w.updated + w.deleted, 0), 0);
}

export function renderReport(result: RunResult): string {
  const lines: string[] = ['# Import report', ''];
  const changes = totalChanges(result);
  lines.push(`${result.tournaments.length} tournaments. Rows written: ${changes}${changes === 0 ? ' (nothing changed: the database already held this data)' : ''}.`, '');
  if (!result.global) lines.push('No global capture was found: player profiles come from the rosters only, and every user is a stub.', '');
  for (const t of result.tournaments) lines.push(...renderTournament(t));
  return lines.join('\n');
}

function renderTournament(t: TournamentResult): string[] {
  const { capture, ctx } = t.mapped;
  const out = [`## ${capture.slug} (id ${capture.tournamentId})`, ''];
  out.push(`Capture: ${capture.manifest.source}, ${capture.manifest.capturedAt}, layout ${capture.manifest.layout}.`, '');
  if (capture.adapted.length) {
    out.push('Adapted from the old layout:', '', ...capture.adapted.map((a) => `- ${a}`), '');
  }

  out.push('### Source documents', '', '| Collection | In capture | Read | Mapped | Merged | Dropped | Not imported |', '|---|---:|---:|---:|---:|---:|---:|');
  const kinds = new Set([...Object.keys(capture.manifest.collections), ...ctx.accounts.keys()]);
  const consumed = new Map(capture.consumed.map((c) => [c.kind, c]));
  for (const kind of [...kinds].sort()) {
    const inCapture = capture.manifest.collections[kind]?.documents;
    const a = ctx.accounts.get(kind);
    if (!a && !inCapture) continue;
    const c = consumed.get(kind);
    if (!a && c) {
      out.push(`| ${kind} | ${c.documents} | → ${c.into} | | | | |`);
      continue;
    }
    const denied = capture.manifest.collections[kind]?.status === 'denied' ? ' (denied: needs the owner\'s export)' : '';
    out.push(`| ${kind}${denied} | ${inCapture ?? '-'} | ${a?.read ?? 0} | ${a?.outcomes.mapped ?? 0} | ${a?.outcomes.merged ?? 0} | ${a?.outcomes.dropped ?? 0} | ${a?.outcomes.unmapped ?? 0} |`);
  }
  out.push('');
  const reasons = [...ctx.accounts.entries()].flatMap(([kind, a]) => Object.entries(a.reasons).map(([r, n]) => `- ${kind}: ${r} (${n})`));
  if (reasons.length) out.push('Why documents were dropped or not imported:', '', ...reasons, '');

  out.push('### Rows', '', '| Table | Mapped | In database | Inserted | Updated | Stale | Deleted |', '|---|---:|---:|---:|---:|---:|---:|');
  const writes = new Map(t.writes.map((w) => [w.table, w]));
  for (const c of t.counts) {
    const w = writes.get(c.table);
    const inDb = c.inDatabase === null ? 'global' : String(c.inDatabase);
    out.push(`| ${c.table} | ${c.mapped} | ${inDb} | ${w?.inserted ?? 0} | ${w?.updated ?? 0} | ${w?.stale ?? 0} | ${w?.deleted ?? 0} |`);
  }
  out.push('');

  out.push('### Findings', '');
  const groups = groupFindings(ctx.findings);
  if (!groups.length) out.push('None.', '');
  for (const code of ['unmapped', 'conflict', 'unknown-field', 'decision'] as const) {
    const list = groups.filter((g) => g.code === code);
    if (!list.length) continue;
    out.push(`${TITLES[code]}:`, '');
    for (const g of list) {
      const refs = g.refs.slice(0, EXAMPLES).map((r) => `\`${r}\``).join('; ');
      out.push(`- ${g.kind}: ${g.reason} (${g.count})${refs ? ` — ${refs}${g.refs.length > EXAMPLES ? ' …' : ''}` : ''}`);
    }
    out.push('');
  }

  out.push('### Standings', '');
  if (!t.standings.length) out.push('No group stage or league table in this tournament.', '');
  for (const s of t.standings) {
    const against = s.against === 'published' ? 'the published table' : s.against === 'stored' ? 'the standings stored on the old group document (no published table exists)' : 'nothing (no published or stored table)';
    const verdict = s.against === 'none' ? 'not compared' : s.differences.length ? `${s.differences.length} differences` : 'matches';
    out.push(`- **${s.groupName}** (\`${s.groupId}\`) against ${against}: ${verdict}.${s.explanation ? ` ${s.explanation}.` : ''}`);
    for (const d of s.differences.slice(0, 12)) out.push(`  - ${d}`);
    if (s.differences.length > 12) out.push(`  - … ${s.differences.length - 12} more`);
  }
  out.push('');
  return out;
}

const TITLES = {
  unmapped: 'Not imported (a document or a value)',
  conflict: 'Conflicts in the old data, and how they were settled',
  'unknown-field': 'Fields no mapper names',
  decision: 'Decisions taken where the old data was ambiguous',
} as const;

interface FindingGroup { kind: string; code: Finding['code']; reason: string; count: number; refs: string[] }

export function groupFindings(findings: readonly Finding[]): FindingGroup[] {
  const map = new Map<string, FindingGroup>();
  for (const f of findings) {
    const key = `${f.code}|${f.kind}|${f.reason}`;
    let g = map.get(key);
    if (!g) {
      g = { kind: f.kind, code: f.code, reason: f.reason, count: 0, refs: [] };
      map.set(key, g);
    }
    g.count++;
    if (f.ref) g.refs.push(f.ref);
  }
  return [...map.values()];
}
