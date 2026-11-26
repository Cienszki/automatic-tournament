// The import report, as Markdown: the global collections, then per tournament what was read and
// what became of it, the rows per table, every finding grouped by its reason, and the standings
// comparison. Findings about a match or a game name it readably (labels.ts), and the owner
// corrections are listed with what each changed. Examples in findings are paths and ids from the
// capture, which can name a person (a Steam id, a user id); `redact` leaves them out, for a report
// that is shared or committed.

import type { GlobalRun } from './global';
import { MatchLabels } from './labels';
import { renderCorrections, renderFindings } from './report-findings';
import { TABLE_ORDER, tableName } from './rows';
import type { RunResult, TournamentResult } from './run';
import type { TableWrite } from './write';

export interface ReportOptions {
  /** Leave out the examples (paths, ids) of findings; keep counts, reasons and team names. */
  redact?: boolean;
}

const changesOf = (writes: readonly TableWrite[]) => writes.reduce((m, w) => m + w.inserted + w.updated + w.deleted, 0);

export function totalChanges(result: RunResult): number {
  return result.tournaments.reduce((n, t) => n + changesOf(t.writes), changesOf(result.globalRun?.writes ?? []));
}

export function renderReport(result: RunResult, options: ReportOptions = {}): string {
  const lines: string[] = ['# Import report', ''];
  const changes = totalChanges(result);
  lines.push(`${result.tournaments.length} tournaments. Rows written: ${changes}${changes === 0 ? ' (nothing changed: the database already held this data)' : ''}.`, '');
  for (const s of result.skipped) lines.push(`Not imported: ${s.slug}, ${s.reason}.`, '');
  if (!result.global) lines.push('No global capture was found: player profiles come from the rosters only, and every user is a stub.', '');
  if (result.globalRun) lines.push(...renderGlobal(result.globalRun, options));
  for (const t of result.tournaments) lines.push(...renderTournament(t, options));
  return lines.join('\n');
}

const TABLES = new Map(TABLE_ORDER.map((t) => [tableName(t), t]));

function renderGlobal(g: GlobalRun, options: ReportOptions): string[] {
  const out = ['## Global collections', '', `Capture: ${g.capture.manifest.source}, ${g.capture.manifest.capturedAt}.`, ''];
  out.push('| Collection | Documents | Status | What the import does with it |', '|---|---:|---|---|');
  for (const k of g.kinds) out.push(`| ${k.kind} | ${k.documents} | ${k.status} | ${k.use} |`);
  out.push('');
  if (g.writes.length) {
    out.push('Rows written from the owner\'s export, for every user it holds:', '', '| Table | Mapped | Inserted | Updated |', '|---|---:|---:|---:|');
    for (const w of g.writes) out.push(`| ${w.table} | ${g.mapped.rows.get(TABLES.get(w.table)!).length} | ${w.inserted} | ${w.updated} |`);
    out.push('');
  }
  if (g.mapped.ctx.findings.length) out.push(...renderFindings(g.mapped.ctx.findings, options, null));
  return out;
}

function renderTournament(t: TournamentResult, options: ReportOptions): string[] {
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
    // A kind the adapter folded into another one is accounted for there.
    if (c && !a?.read) {
      out.push(`| ${kind} | ${c.documents} | → ${c.into} | | | | |`);
      continue;
    }
    const denied = capture.manifest.collections[kind]?.status === 'denied' ? ' (denied: needs the owner\'s export)' : '';
    const split = c ? ` (${c.into})` : '';
    out.push(`| ${kind}${denied} | ${inCapture ?? '-'} | ${a?.read ?? 0}${split} | ${a?.outcomes.mapped ?? 0} | ${a?.outcomes.merged ?? 0} | ${a?.outcomes.dropped ?? 0} | ${a?.outcomes.unmapped ?? 0} |`);
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

  out.push(...renderCorrections(t.mapped.state.corrections.finish(), options));
  out.push(...renderFindings(ctx.findings, options, new MatchLabels(t.mapped.rows, capture.slug)));

  out.push('### Standings', '');
  if (!t.standings.length) out.push('No group stage or league table in this tournament.', '');
  for (const s of t.standings) {
    const against = s.against === 'published' ? 'the published table' : s.against === 'stored' ? 'the standings stored on the old group document (no published table exists)' : 'nothing (no published or stored table)';
    const corrected = s.corrected.length ? `, apart from ${s.corrected.length} values that an owner correction changed` : '';
    const verdict = s.against === 'none' ? 'not compared' : `${s.differences.length ? `${s.differences.length} differences` : 'matches'}${corrected}`;
    out.push(`- **${s.groupName}** (\`${s.groupId}\`) against ${against}: ${verdict}.${s.explanation ? ` ${s.explanation}.` : ''}`);
    for (const d of s.differences.slice(0, 12)) out.push(`  - ${d}`);
    if (s.differences.length > 12) out.push(`  - … ${s.differences.length - 12} more`);
    for (const d of s.corrected) out.push(`  - owner correction: ${d}`);
  }
  out.push('');
  return out;
}
