'use client';

import { useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeftRight,
  Loader2,
  UserPlus,
  UserMinus,
  Pencil,
  Save,
  X,
  AlertTriangle,
  CheckCircle,
  Upload,
  Shield,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Player, PlayerRole, Team } from '@/lib/definitions';
import { PlayerRoles } from '@/lib/definitions';

interface PDLTransferSectionProps {
  team: Team;
  isCaptain: boolean;
  /** Whether the transfer window is currently open */
  isTransferWindowOpen: boolean;
  /** Whether the season has started (determines if transfers count) */
  isSeasonActive: boolean;
  /** Players from the previous completed round (for comparing transfers) */
  previousRoundPlayers: Player[];
  /** Max allowed roster changes per transfer window */
  maxTransfers: number;
  /** Called when captain saves all roster changes */
  onSaveRoster: (data: {
    players: Player[];
    teamName: string;
    teamTag: string;
    teamLogo: string | File;
    captainDiscord: string;
  }) => Promise<void>;
}

interface EditablePlayer {
  id: string;
  nickname: string;
  role: PlayerRole;
  steamProfileUrl: string;
  steamId: string;
  steamId32?: string;
  avatar?: string;
  avatarmedium?: string;
  avatarfull?: string;
  isNew?: boolean;
  isRemoved?: boolean;
}

export function PDLTransferSection({
  team,
  isCaptain,
  isTransferWindowOpen,
  isSeasonActive,
  previousRoundPlayers,
  maxTransfers,
  onSaveRoster,
}: PDLTransferSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // Editable state
  const [editPlayers, setEditPlayers] = useState<EditablePlayer[]>([]);
  const [editTeamName, setEditTeamName] = useState(team.name);
  const [editTeamTag, setEditTeamTag] = useState(team.tag);
  const [editCaptainDiscord, setEditCaptainDiscord] = useState(team.discordUsername || team.captainDiscordUsername || '');
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);
  const [editLogoPreview, setEditLogoPreview] = useState(team.logoUrl);

  // New player form
  const [newNickname, setNewNickname] = useState('');
  const [newRole, setNewRole] = useState<PlayerRole | ''>('');
  const [newSteamUrl, setNewSteamUrl] = useState('');

  // Initialize editing state from current team
  const startEditing = useCallback(() => {
    setEditPlayers(
      (team.players || []).map(p => ({
        id: p.id,
        nickname: p.nickname,
        role: p.role,
        steamProfileUrl: p.steamProfileUrl || '',
        steamId: p.steamId || '',
        steamId32: p.steamId32 || '',
        avatar: p.avatar,
        avatarmedium: p.avatarmedium,
        avatarfull: p.avatarfull,
      }))
    );
    setEditTeamName(team.name);
    setEditTeamTag(team.tag);
    setEditCaptainDiscord(team.discordUsername || team.captainDiscordUsername || '');
    setEditLogoPreview(team.logoUrl);
    setEditLogoFile(null);
    setIsEditing(true);
  }, [team]);

  // Count how many SteamIDs changed compared to previous round
  const transfersUsed = useMemo(() => {
    if (!isSeasonActive || previousRoundPlayers.length === 0) return 0;

    const previousSteamIds = new Set(previousRoundPlayers.map(p => p.steamId).filter(Boolean));
    const currentSteamIds = new Set(
      editPlayers
        .filter(p => !p.isRemoved)
        .map(p => p.steamId)
        .filter(Boolean)
    );

    let changes = 0;
    // Count new Steam IDs not in previous round
    for (const id of currentSteamIds) {
      if (!previousSteamIds.has(id)) changes++;
    }
    return changes;
  }, [editPlayers, previousRoundPlayers, isSeasonActive]);

  const transfersRemaining = maxTransfers - transfersUsed;

  // Validate roles - no duplicates
  const roleErrors = useMemo(() => {
    const activePlayers = editPlayers.filter(p => !p.isRemoved);
    const roleCounts: Record<string, number> = {};
    for (const p of activePlayers) {
      roleCounts[p.role] = (roleCounts[p.role] || 0) + 1;
    }
    const errors: string[] = [];
    for (const [role, count] of Object.entries(roleCounts)) {
      if (count > 1) {
        errors.push(`Duplikat roli: ${role} (${count} graczy)`);
      }
    }
    return errors;
  }, [editPlayers]);

  const activePlayerCount = editPlayers.filter(p => !p.isRemoved).length;

  const handleRemovePlayer = (playerId: string) => {
    setEditPlayers(prev =>
      prev.map(p => (p.id === playerId ? { ...p, isRemoved: true } : p))
    );
  };

  const handleRestorePlayer = (playerId: string) => {
    setEditPlayers(prev =>
      prev.map(p => (p.id === playerId ? { ...p, isRemoved: false } : p))
    );
  };

  const handleAddPlayer = async () => {
    if (!newNickname.trim() || !newRole || !newSteamUrl.trim()) return;

    setLoading(true);
    try {
      // Validate Steam profile and fetch full player data
      const response = await fetch('/api/validate-steam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steamProfileUrl: newSteamUrl.trim() }),
      });

      const data = await response.json();

      if (!response.ok || !data.isValid) {
        alert(data.error || 'Invalid Steam profile URL');
        return;
      }

      const newPlayer: EditablePlayer = {
        id: `new-${Date.now()}`,
        nickname: newNickname.trim(),
        role: newRole as PlayerRole,
        steamProfileUrl: newSteamUrl.trim(),
        steamId: data.steamId64 || '',
        steamId32: data.steamId32 || '',
        avatar: data.avatar,
        avatarmedium: data.avatarmedium,
        avatarfull: data.avatarfull,
        isNew: true,
      };

      setEditPlayers(prev => [...prev, newPlayer]);
      setNewNickname('');
      setNewRole('');
      setNewSteamUrl('');
      setShowAddPlayer(false);
    } catch (error) {
      console.error('Error adding player:', error);
      alert('Failed to validate Steam profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayerFieldChange = (playerId: string, field: keyof EditablePlayer, value: string) => {
    setEditPlayers(prev =>
      prev.map(p => (p.id === playerId ? { ...p, [field]: value } : p))
    );
  };

  const handleRefreshPlayerSteam = async (playerId: string) => {
    const player = editPlayers.find(p => p.id === playerId);
    if (!player || !player.steamProfileUrl) return;

    setLoading(true);
    try {
      const response = await fetch('/api/validate-steam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steamProfileUrl: player.steamProfileUrl }),
      });

      const data = await response.json();

      if (response.ok && data.isValid) {
        setEditPlayers(prev =>
          prev.map(p =>
            p.id === playerId
              ? {
                  ...p,
                  steamId: data.steamId64 || p.steamId,
                  steamId32: data.steamId32 || p.steamId32,
                  avatar: data.avatar,
                  avatarmedium: data.avatarmedium,
                  avatarfull: data.avatarfull,
                }
              : p
          )
        );
      } else {
        alert(data.error || 'Failed to validate Steam profile');
      }
    } catch (error) {
      console.error('Error refreshing Steam profile:', error);
      alert('Failed to refresh Steam profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditLogoFile(file);
      const url = URL.createObjectURL(file);
      setEditLogoPreview(url);
    }
  };

  const canSave = useMemo(() => {
    if (activePlayerCount !== 5) return false;
    if (roleErrors.length > 0) return false;
    if (!editTeamName.trim()) return false;
    if (!editTeamTag.trim()) return false;
    
    // If transfer window is closed, only allow saving if no player changes were made
    if (!isTransferWindowOpen && transfersUsed > 0) return false;
    
    // If season is active and transfer window is open, check transfer limits
    if (isSeasonActive && isTransferWindowOpen && transfersUsed > maxTransfers) return false;
    
    return true;
  }, [activePlayerCount, roleErrors, editTeamName, editTeamTag, isTransferWindowOpen, transfersUsed, isSeasonActive, maxTransfers]);

  const handleSave = () => {
    if (!canSave) return;
    setConfirmDialogOpen(true);
  };

  const handleConfirmSave = async () => {
    setLoading(true);
    try {
      const activePlayers = editPlayers
        .filter(p => !p.isRemoved)
        .map(p => ({
          id: p.id.startsWith('new-') ? '' : p.id,
          nickname: p.nickname,
          role: p.role,
          steamProfileUrl: p.steamProfileUrl,
          steamId: p.steamId,
          steamId32: p.steamId32 || '',
          avatar: p.avatar,
          avatarmedium: p.avatarmedium,
          avatarfull: p.avatarfull,
          mmr: 0,
          profileScreenshotUrl: '',
        })) as Player[];

      await onSaveRoster({
        players: activePlayers,
        teamName: editTeamName.trim(),
        teamTag: editTeamTag.trim(),
        teamLogo: editLogoFile || team.logoUrl,
        captainDiscord: editCaptainDiscord.trim(),
      });

      setIsEditing(false);
      setConfirmDialogOpen(false);
    } finally {
      setLoading(false);
    }
  };

  // Not in transfer window and not captain
  if (!isTransferWindowOpen && !isCaptain) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white/5 border border-white/10">
            <ArrowLeftRight className="w-5 h-5 text-pdl-gold" />
          </div>
          <div>
            <h2 className="text-xl font-logik-extended-bold text-white tracking-wide uppercase">
              Zarządzanie Składem
            </h2>
            {isSeasonActive && (
              <p className="text-xs text-white/40 font-logik mt-0.5">
                Transfery: {transfersUsed}/{maxTransfers} wykorzystane
              </p>
            )}
          </div>
        </div>

        {isCaptain && !isEditing && (
          <Button
            onClick={startEditing}
            className="bg-pdl-crimson hover:bg-pdl-crimson/80 text-white font-logik-extended-bold"
            size="sm"
          >
            <Pencil className="w-4 h-4 mr-2" />
            {isTransferWindowOpen ? 'Edytuj skład' : 'Edytuj dane drużyny'}
          </Button>
        )}
      </div>

      {/* Info about transfer window */}
      {isCaptain && !isEditing && (
        isTransferWindowOpen ? (
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-green-200 font-logik-extended-bold">
                Okno transferowe jest otwarte
              </p>
              <p className="text-xs text-green-200/60 mt-1">
                {isSeasonActive
                  ? `Możesz dokonać maksymalnie ${maxTransfers} zmian w składzie (porównanie z ostatnią zakończoną rundą). Zmiany nicków i ról nie liczą się jako transfery.`
                  : 'Sezon jeszcze nie rozpoczył się — możesz dowolnie modyfikować skład bez ograniczeń.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 flex items-start gap-3">
            <Lock className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-yellow-200 font-logik-extended-bold">
                Okno transferowe zamknięte
              </p>
              <p className="text-xs text-yellow-200/60 mt-1">
                Możesz edytować dane drużyny (nazwa, tag, logo, Discord), ale nie możesz modyfikować składu zawodników.
              </p>
            </div>
          </div>
        )
      )}

      {/* Editing mode */}
      {isEditing && (
        <div className="space-y-6">
          {/* Transfer budget warning */}
          {isSeasonActive && (
            <div className={cn(
              'rounded-lg border p-3 flex items-center justify-between',
              transfersUsed > maxTransfers
                ? 'border-red-500/30 bg-red-500/10'
                : transfersUsed === maxTransfers
                ? 'border-yellow-500/30 bg-yellow-500/10'
                : 'border-white/10 bg-white/[0.03]'
            )}>
              <div className="flex items-center gap-2">
                <ArrowLeftRight className={cn(
                  'w-4 h-4',
                  transfersUsed > maxTransfers ? 'text-red-400' : 'text-white/60'
                )} />
                <span className="text-sm text-white/80 font-logik">
                  Zmiany zawodników: <span className="font-logik-extended-bold">{transfersUsed}</span> / {maxTransfers}
                </span>
              </div>
              {transfersUsed > maxTransfers && (
                <span className="text-xs text-red-400 font-logik-extended-bold">
                  Za dużo zmian!
                </span>
              )}
            </div>
          )}

          {/* Team info edit */}
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 space-y-4">
            <h3 className="text-sm font-logik-extended-bold text-white/60 uppercase tracking-wide">
              Dane Drużyny
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white/80 text-sm">Nazwa drużyny</Label>
                <Input
                  value={editTeamName}
                  onChange={(e) => setEditTeamName(e.target.value)}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white/80 text-sm">Tag (max 5 znaków)</Label>
                <Input
                  value={editTeamTag}
                  onChange={(e) => setEditTeamTag(e.target.value.slice(0, 5))}
                  className="bg-white/5 border-white/10 text-white"
                  maxLength={5}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white/80 text-sm">Discord kapitana</Label>
                <Input
                  value={editCaptainDiscord}
                  onChange={(e) => setEditCaptainDiscord(e.target.value)}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white/80 text-sm">Logo drużyny</Label>
                <div className="flex items-center gap-3">
                  <div className="relative w-10 h-10 rounded-lg border border-white/10 overflow-hidden bg-black/40 flex-shrink-0">
                    <Image
                      src={editLogoPreview || '/placeholder-team.svg'}
                      alt="Logo"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <Label className="cursor-pointer">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-sm text-white/60">
                      <Upload className="w-4 h-4" />
                      Zmień logo
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoChange}
                    />
                  </Label>
                </div>
              </div>
            </div>
          </div>

          {/* Player list */}
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-logik-extended-bold text-white/60 uppercase tracking-wide">
                Gracze ({activePlayerCount}/5)
              </h3>
              {!isTransferWindowOpen && (
                <div className="flex items-center gap-2 text-yellow-400/60">
                  <Lock className="w-3 h-3" />
                  <span className="text-xs font-logik">Zablokowane</span>
                </div>
              )}
            </div>

            {/* Role errors */}
            {roleErrors.length > 0 && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 space-y-1">
                {roleErrors.map((err, i) => (
                  <p key={i} className="text-xs text-red-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {err}
                  </p>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {editPlayers.map((player) => (
                <div
                  key={player.id}
                  className={cn(
                    'rounded-lg border p-3 flex flex-col sm:flex-row gap-3 transition-all',
                    player.isRemoved
                      ? 'border-red-500/20 bg-red-500/5 opacity-50'
                      : player.isNew
                      ? 'border-green-500/20 bg-green-500/5'
                      : 'border-white/5 bg-white/[0.02]'
                  )}
                >
                  {player.isRemoved ? (
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <UserMinus className="w-4 h-4 text-red-400" />
                        <span className="text-sm text-red-400 line-through">{player.nickname}</span>
                        <span className="text-xs text-white/30">({player.role})</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRestorePlayer(player.id)}
                        disabled={!isTransferWindowOpen}
                        className="text-white/40 hover:text-white h-7"
                      >
                        Przywróć
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <Input
                          value={player.nickname}
                          onChange={(e) => handlePlayerFieldChange(player.id, 'nickname', e.target.value)}
                          placeholder="Nick"
                          className="bg-white/5 border-white/10 text-white text-sm"
                          disabled={!isTransferWindowOpen}
                        />
                        <Select
                          value={player.role}
                          onValueChange={(val) => handlePlayerFieldChange(player.id, 'role', val)}
                          disabled={!isTransferWindowOpen}
                        >
                          <SelectTrigger className="bg-white/5 border-white/10 text-white text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1a1a1a] border-white/10">
                            {PlayerRoles.map((role) => (
                              <SelectItem key={role} value={role} className="text-white text-sm">
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2">
                          <Input
                            value={player.steamProfileUrl}
                            onChange={(e) => {
                              handlePlayerFieldChange(player.id, 'steamProfileUrl', e.target.value);
                              // Extract steam ID
                              const match = e.target.value.match(/\/profiles\/(\d+)/);
                              if (match) {
                                handlePlayerFieldChange(player.id, 'steamId', match[1]);
                              }
                            }}
                            placeholder="Link do Steam"
                            className="bg-white/5 border-white/10 text-white text-sm flex-1"
                            disabled={!isTransferWindowOpen}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRefreshPlayerSteam(player.id)}
                            disabled={loading || !player.steamProfileUrl || !isTransferWindowOpen}
                            className="text-pdl-gold/60 hover:text-pdl-gold hover:bg-pdl-gold/10 h-10 w-10 p-0 flex-shrink-0"
                            title="Odśwież dane Steam (avatar, ID)"
                          >
                            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                          </Button>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemovePlayer(player.id)}
                        disabled={!isTransferWindowOpen}
                        className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10 h-8 w-8 p-0 flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add new player */}
            {isTransferWindowOpen && activePlayerCount < 5 && (
              showAddPlayer ? (
                <div className="rounded-lg border border-dashed border-white/20 bg-white/[0.02] p-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input
                      value={newNickname}
                      onChange={(e) => setNewNickname(e.target.value)}
                      placeholder="Nick gracza"
                      className="bg-white/5 border-white/10 text-white text-sm"
                    />
                    <Select value={newRole} onValueChange={(val) => setNewRole(val as PlayerRole)}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white text-sm">
                        <SelectValue placeholder="Rola" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1a1a] border-white/10">
                        {PlayerRoles.map((role) => (
                          <SelectItem key={role} value={role} className="text-white text-sm">
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={newSteamUrl}
                      onChange={(e) => setNewSteamUrl(e.target.value)}
                      placeholder="Link do profilu Steam"
                      className="bg-white/5 border-white/10 text-white text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleAddPlayer}
                      disabled={!newNickname.trim() || !newRole || !newSteamUrl.trim()}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <UserPlus className="w-4 h-4 mr-1" />
                      Dodaj
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowAddPlayer(false)}
                      className="text-white/60"
                    >
                      Anuluj
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full border-dashed border-white/10 text-white/40 hover:text-white hover:bg-white/5"
                  onClick={() => setShowAddPlayer(true)}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Dodaj gracza ({activePlayerCount}/5)
                </Button>
              )
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              onClick={() => setIsEditing(false)}
              className="text-white/60"
            >
              Anuluj
            </Button>
            <Button
              onClick={handleSave}
              disabled={!canSave || loading}
              className="bg-pdl-crimson hover:bg-pdl-crimson/80 text-white font-logik-extended-bold"
            >
              <Save className="w-4 h-4 mr-2" />
              Zapisz skład
            </Button>
          </div>

          {/* Confirm dialog */}
          <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
            <DialogContent className="bg-[#0a0a0a] border-white/10 text-white max-w-md">
              <DialogHeader>
                <DialogTitle className="font-logik-extended-bold text-white">
                  Potwierdź zmiany
                </DialogTitle>
                <DialogDescription className="text-white/60">
                  Przejrzyj podsumowanie zmian przed zapisem.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                {editTeamName !== team.name && (
                  <p className="text-sm text-white/80">
                    Nazwa: <span className="line-through text-white/40">{team.name}</span> → <span className="text-pdl-gold">{editTeamName}</span>
                  </p>
                )}
                {editTeamTag !== team.tag && (
                  <p className="text-sm text-white/80">
                    Tag: <span className="line-through text-white/40">[{team.tag}]</span> → <span className="text-pdl-gold">[{editTeamTag}]</span>
                  </p>
                )}
                {isSeasonActive && transfersUsed > 0 && (
                  <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
                    <p className="text-sm text-yellow-200">
                      <Shield className="w-4 h-4 inline mr-1" />
                      Transfery wykorzystane: <span className="font-logik-extended-bold">{transfersUsed}/{maxTransfers}</span>
                    </p>
                  </div>
                )}

                <div className="text-sm text-white/80">
                  Skład ({activePlayerCount} graczy):
                  <ul className="mt-2 space-y-1">
                    {editPlayers.filter(p => !p.isRemoved).map(p => (
                      <li key={p.id} className="flex items-center gap-2">
                        {p.isNew && <span className="text-xs text-green-400">[NOWY]</span>}
                        <span>{p.nickname}</span>
                        <span className="text-white/40">({p.role})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setConfirmDialogOpen(false)}
                  className="text-white/60"
                >
                  Wróć
                </Button>
                <Button
                  onClick={handleConfirmSave}
                  disabled={loading}
                  className="bg-pdl-crimson hover:bg-pdl-crimson/80 text-white font-logik-extended-bold"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Potwierdź i zapisz
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
