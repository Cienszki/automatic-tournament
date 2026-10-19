'use client';

// Team logos + the chosen team's roster as big faces: the standard "pick a player" control for the
// per-player pages (#61, #74, #75, #77, #78, #79, #87).

import React, { useMemo, useState } from 'react';
import type { Model, PlayerX } from '@/lib/stats-lab/derive';
import { qualified } from '@/lib/stats-lab/season';
import { Avatar, C, TeamPicker, Tip, mix } from './kit';

/** Team + player selection, starting on the season's best performer */
export function usePlayerPick(model: Model) {
  const teams = useMemo(() => model.teams.filter(t => t.players.some(p => p.games > 0)), [model]);
  const star = useMemo(() => qualified(model).sort((a, b) => (b.agg.score.avg ?? 0) - (a.agg.score.avg ?? 0))[0], [model]);
  const [teamId, setTeamId] = useState<string | null>(star?.teamId ?? teams[0]?.id ?? null);
  const team = teams.find(t => t.id === teamId) ?? teams[0];
  const roster = useMemo(() => (team?.players ?? []).filter(p => p.games > 0).slice(0, 8), [team]);
  const [pid, setPid] = useState<string | null>(star?.id ?? null);
  const player: PlayerX | undefined = roster.find(p => p.id === pid) ?? roster[0];
  const setTeam = (id: string) => { setTeamId(id); setPid(null); };
  return { teams, team, roster, player, setTeam, setPlayer: setPid };
}

export function PlayerPicker({ pick, size = 56, teamSize = 34, teamRows = 3, cols = 4, className }: {
  pick: ReturnType<typeof usePlayerPick>; size?: number; teamSize?: number; teamRows?: number; cols?: number; className?: string;
}) {
  return (
    <div className={`flex flex-col gap-3 ${className ?? ''}`}>
      <TeamPicker teams={pick.teams} value={pick.team?.id ?? null} onChange={id => id && pick.setTeam(id)} size={teamSize} rows={teamRows} />
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {pick.roster.map(p => {
          const on = p.id === pick.player?.id;
          return (
            <Tip key={p.id} content={`${p.name} · ${p.games} gier`}>
              <button type="button" onClick={() => pick.setPlayer(p.id)} className="flex flex-col items-center gap-1 rounded-2xl p-1.5 transition-all min-w-0"
                style={{ background: on ? mix(C.primary, 40) : 'transparent', boxShadow: on ? `0 0 0 2px ${C.secondary}` : undefined }}>
                <Avatar player={p} size={size} />
                <span className="text-[11px] font-bold truncate max-w-full" style={{ color: C.heading }}>{p.name}</span>
              </button>
            </Tip>
          );
        })}
      </div>
    </div>
  );
}
