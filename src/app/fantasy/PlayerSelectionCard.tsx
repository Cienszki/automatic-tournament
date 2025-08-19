import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlayerAvatar } from '@/components/app/PlayerAvatar';
import type { PlayerSelectionCardProps } from './PlayerSelectionCardProps';
import { useTranslation } from '@/hooks/useTranslation';
import { roleIcons } from './roleIcons';

const PlayerSelectionCard: React.FC<PlayerSelectionCardProps> = ({ role, playersByRole, selectedLineup, onPlayerSelect }) => {
  const { t } = useTranslation();
  const RoleIcon = roleIcons[role];
  const selectedPlayer = selectedLineup[role];

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center">
          <RoleIcon className="mr-2" />
          {t(`players.roles.${role}` as any)}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-between space-y-4 pt-0">
        <Select value={selectedPlayer?.id || ""} onValueChange={(pid: string) => onPlayerSelect(role, pid)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={`${t('fantasy.buildTeam.selectA')} ${t(`players.roles.${role}` as any)}...`} />
          </SelectTrigger>
          <SelectContent>
            {playersByRole[role].map((p) => (
              <SelectItem key={p.id} value={p.id} disabled={Object.values(selectedLineup).some((sp) => sp?.id === p.id && sp.role !== role)}>
                <div className="flex justify-between w-full">
                  <span className="truncate" title={`${p.nickname} (${p.teamTag})`}>{p.nickname} ({p.teamTag})</span>
                  <span className="text-xs text-muted-foreground ml-4 shrink-0">{p.mmr.toLocaleString()} MMR</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedPlayer ? (
          <div className="p-3 border rounded-md flex items-center space-x-3 bg-muted/20 min-h-[76px]">
            <PlayerAvatar player={selectedPlayer} />
            <div className="overflow-hidden">
              <p className="font-semibold truncate" title={selectedPlayer.nickname}>{selectedPlayer.nickname}</p>
              <p className="text-xs text-muted-foreground">MMR: {selectedPlayer.mmr.toLocaleString()}</p>
            </div>
          </div>
        ) : (
          <div className="p-3 border rounded-md text-center flex items-center justify-center min-h-[76px] bg-muted/20">
            <p className="text-sm italic text-muted-foreground">No player selected</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PlayerSelectionCard;
