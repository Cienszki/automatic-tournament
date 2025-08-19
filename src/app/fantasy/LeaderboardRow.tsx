import React from 'react';
import Link from 'next/link';
import { TableRow, TableCell } from '@/components/ui/table';
import { PlayerRoles } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { roleIcons } from './roleIcons';

export interface LeaderboardRowProps {
  participant: any;
  rank: number;
  isCurrentUser: boolean;
}

const LeaderboardRow: React.FC<LeaderboardRowProps> = ({ participant, rank, isCurrentUser }) => {
  const { t } = useTranslation();
  return (
    <TableRow className={cn(isCurrentUser && 'bg-primary/10')}>
      <TableCell className="font-bold text-center">{rank}</TableCell>
      <TableCell>
        {participant.displayName} {isCurrentUser && `(${t('fantasy.leaderboard.you')})`}
      </TableCell>
      <TableCell>
        <div className="flex flex-row flex-wrap items-center gap-x-3 gap-y-1">
          {PlayerRoles.map(role => {
            const player = participant.lineup?.[role];
            return (
              <div key={role} className="flex items-center space-x-1.5 text-xs" title={`${t(`players.roles.${role}` as any)}: ${player?.nickname || 'N/A'}`}>
                {React.createElement(roleIcons[role], { className: 'h-3.5 w-3.5 text-muted-foreground shrink-0' })}
                {player ? (
                  <Link href={`/teams/${player.teamId}/players/${player.id}`} className="text-primary hover:underline truncate">
                    {player.nickname}
                  </Link>
                ) : (
                  <span className="italic">-</span>
                )}
              </div>
            );
          })}
        </div>
      </TableCell>
      <TableCell className="text-right font-semibold">{participant.totalFantasyScore.toLocaleString()}</TableCell>
    </TableRow>
  );
};

export default LeaderboardRow;
