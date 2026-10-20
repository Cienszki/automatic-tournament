// src/components/format-preview/FinalTable.tsx
// TEMPORARY — final qualifier standings, styled like the live "Tabela" section.
'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useTournament } from '@/context/TournamentContext';
import { records, type FormatSim } from './model';

const WIN = '#22c55e';

export function FinalTable({ sim, after }: { sim: FormatSim; after: number }) {
  const { theme } = useTournament();
  const rec = records(sim.matches, after);
  const rows = sim.placements;
  const two = rows.length > 14;
  const halves = two ? [rows.slice(0, Math.ceil(rows.length / 2)), rows.slice(Math.ceil(rows.length / 2))] : [rows];

  return (
    <div className="h-full overflow-hidden flex justify-center">
      <div className={cn('w-full grid gap-x-10 content-start', two ? 'max-w-6xl grid-cols-2' : 'max-w-3xl grid-cols-1')}>
        {halves.map((half, h) => (
          <table key={h} className="w-full border-collapse self-start">
            <tbody>
              {half.map(p => {
                const known = p.round <= after;
                const team = known ? sim.teams[p.teamId] : undefined;
                const r = team ? rec[p.teamId] : undefined;
                return (
                  <tr key={p.place} className="border-b border-white/5 last:border-0">
                    <td className={cn('pl-2 pr-3 w-20 whitespace-nowrap font-logik-extended-bold tabular-nums', two ? 'py-1.5 text-lg' : 'py-2 text-xl')} style={{ color: p.lan ? WIN : 'var(--tournament-secondary-text, #6b7280)' }}>
                      {p.label}
                    </td>
                    <td className={two ? 'py-1.5' : 'py-2'}>
                      {team ? (
                        <div className="flex items-center gap-3 font-logik text-lg" style={{ color: 'var(--tournament-primary-text, #fff)' }}>
                          <span className="relative w-8 h-8 shrink-0 rounded bg-black/40 overflow-hidden grid place-items-center">
                            {team.logoUrl
                              ? <Image src={team.logoUrl} alt={team.name} fill className="object-cover" unoptimized />
                              : <span className="text-xs font-mono opacity-50">?</span>}
                          </span>
                          <span className={cn('truncate', team.placeholder && 'italic opacity-70')}>{team.name}</span>
                        </div>
                      ) : (
                        <span className="font-mono text-xs uppercase tracking-wider italic" style={{ color: 'var(--tournament-secondary-text, #6b7280)' }}>TBD</span>
                      )}
                    </td>
                    <td className="px-3 text-right w-20">
                      {p.lan && team && <span className="font-logik-extended-bold text-xs uppercase tracking-widest" style={{ color: WIN }}>LAN</span>}
                    </td>
                    <td className="pr-4 text-right w-20 whitespace-nowrap">
                      {r && (
                        <span className="font-logik-extended-bold text-xl tabular-nums" style={{ color: 'var(--tournament-title, white)', fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined }}>
                          {r[0]}–{r[1]}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ))}
      </div>
    </div>
  );
}
