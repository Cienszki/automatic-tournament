'use client';

// The squad on the account page, edited where it is shown (no separate edit mode): the five players
// with their league nick, role and Steam account, the team's name / tag / captain's Discord / crest,
// the coach and the transfer window. "Zapisz skład" appears once something changed; the transfer
// rules (window, limit per window, 5 players, unique roles, MMR cap) are the same as before.

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label as FieldLabel } from '@/components/ui/label';
import { uploadScreenshot } from '@/lib/storage';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Check, Loader2, Lock, Pencil, RefreshCw, Save, Shield, Upload, X } from 'lucide-react';
import { InfoPopover } from '@/components/ui/info-popover';
import { cn } from '@/lib/utils';
import type { Player, PlayerRole, Team } from '@/lib/definitions';
import { PlayerRoles } from '@/lib/definitions';
import type { CoachLock } from '@/lib/coach-rules';
import { count } from '@/lib/plural';
import { Avatar, C, Tip, TipBody, ink, mix, useHeaderFont } from '@/components/stats-lab/kit';
import { Act, Kicker, Label, Solid, T, fieldClass, fieldStyle } from './ui';

const ROLE_ORDER = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'];
const roleOrder = (r: string) => { const i = ROLE_ORDER.indexOf(r); return i < 0 ? 9 : i; };
const selectClass = 'h-9 bg-transparent border-0 border-b-2 rounded-none px-0 text-[14px] focus:ring-0 focus:ring-offset-0 shadow-none';

const MAX_COACH_NICKNAME = 32;

export interface SquadProps {
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
  /** True for MMR-limited tournaments — shows extra MMR/screenshot/smurf fields */
  isMmrLimited?: boolean;
  /** Team MMR cap (only relevant when isMmrLimited is true) */
  mmrCap?: number;
  /**
   * Team-level coach ("Elastycznie" / "Zgłaszani przed sezonem"), managed here with the rest
   * of the team. Omit when the tournament doesn't use team-level coaches.
   */
  coach?: {
    nickname: string | null;
    /** Changes blocked (e.g. a match within 24 h) and why */
    lock: CoachLock;
    /** One-line rule shown under the field */
    ruleSummary: string;
    /** Full coach rules of this tournament, shown in the (i) popover */
    rulesDetails: string;
    /** Save a nickname, or null to remove the coach */
    onSave: (nickname: string | null) => Promise<void>;
  };
  /** The captain's Discord from their linked account: shown as is, not editable */
  linkedDiscord?: string;
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
  /** Steam display name from Steam API (personaname) */
  personaname?: string;
  avatar?: string;
  avatarmedium?: string;
  avatarfull?: string;
  isNew?: boolean;
  isRemoved?: boolean;
  /** Player MMR (only used in MMR-limited tournaments) */
  mmr?: number;
  /** URL to the MMR verification screenshot */
  profileScreenshotUrl?: string;
  /** Declared smurf accounts */
  smurfAccounts?: { steamProfileUrl: string; steamId64?: string; steamId32?: string }[];
}

export function SquadView({
  team,
  isCaptain,
  isTransferWindowOpen,
  isSeasonActive,
  previousRoundPlayers,
  maxTransfers,
  isMmrLimited,
  mmrCap,
  coach,
  linkedDiscord,
  onSaveRoster,
}: SquadProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const { theme } = useTournament();
  const { toast } = useToast();
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // Editable state
  const [editPlayers, setEditPlayers] = useState<EditablePlayer[]>([]);
  const [editTeamName, setEditTeamName] = useState(team.name);
  const [editTeamTag, setEditTeamTag] = useState(team.tag);
  const [editCaptainDiscord, setEditCaptainDiscord] = useState(linkedDiscord || team.discordUsername || team.captainDiscordUsername || '');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingCoach, setAddingCoach] = useState(false);
  const [editCoach, setEditCoach] = useState(coach?.nickname ?? '');
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);
  const [editLogoPreview, setEditLogoPreview] = useState(team.logoUrl);

  // New player form
  const [newNickname, setNewNickname] = useState('');
  const [newRole, setNewRole] = useState<PlayerRole | ''>('');
  const [newSteamUrl, setNewSteamUrl] = useState('');
  // MMR-limited extra fields for new player
  const [newMmr, setNewMmr] = useState('');
  const [newProfileScreenshotFile, setNewProfileScreenshotFile] = useState<File | null>(null);
  const [newProfileScreenshotPreview, setNewProfileScreenshotPreview] = useState<string | null>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const [newSmurfUrls, setNewSmurfUrls] = useState<string[]>(['']);

  // Edit player dialog state
  const [editPlayerDialogOpen, setEditPlayerDialogOpen] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editDialogNickname, setEditDialogNickname] = useState('');
  const [editDialogSmurfs, setEditDialogSmurfs] = useState<string[]>(['']);
  const [editDialogOriginalSmurfCount, setEditDialogOriginalSmurfCount] = useState(0);
  const [editDialogMmr, setEditDialogMmr] = useState('');
  const [editDialogScreenshotFile, setEditDialogScreenshotFile] = useState<File | null>(null);
  const [editDialogScreenshotPreview, setEditDialogScreenshotPreview] = useState<string | null>(null);
  const editScreenshotInputRef = useRef<HTMLInputElement>(null);

  // Initialize editing state from current team
  const startEditing = useCallback(() => {
    setEditPlayers(
      (team.players || []).map(p => ({
        id: p.id,
        nickname: p.nickname,
        role: p.role,
        steamProfileUrl: p.steamProfileUrl || '',
        // Registration-created player docs store the steamId64 value in the
        // 'steamId64' field, while transfer-created docs store it in 'steamId'.
        // Coalesce both so we never lose the Steam ID when editing.
        steamId: p.steamId || (p as unknown as Record<string, string>).steamId64 || '',
        steamId32: p.steamId32 || '',
        personaname: p.personaname,
        avatar: p.avatar,
        avatarmedium: p.avatarmedium,
        avatarfull: p.avatarfull,
        mmr: (p as any).mmr,
        profileScreenshotUrl: (p as any).profileScreenshotUrl,
        smurfAccounts: (p as any).smurfAccounts,
      }))
    );
    setEditTeamName(team.name);
    setEditTeamTag(team.tag);
    setEditCaptainDiscord(linkedDiscord || team.discordUsername || team.captainDiscordUsername || '');
    setEditingId(null);
    setAddingCoach(false);
    setEditLogoPreview(team.logoUrl);
    setEditLogoFile(null);
    setEditCoach(coach?.nickname ?? '');
    setIsEditing(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team, coach?.nickname]);

  // The squad is always editable where it is shown; a saved (or changed elsewhere) team starts it over
  useEffect(() => {
    startEditing();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team, coach?.nickname]);

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
    for (const [role, n] of Object.entries(roleCounts)) {
      if (n > 1) {
        errors.push(`Duplikat roli: ${role} (${count(n, 'gracz', 'graczy', 'graczy')})`);
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

  const handleOpenEditPlayer = (playerId: string) => {
    const player = editPlayers.find(p => p.id === playerId);
    if (!player) return;
    setEditingPlayerId(playerId);
    setEditDialogNickname(player.nickname);
    const existingSmurfs = player.smurfAccounts && player.smurfAccounts.length > 0
      ? player.smurfAccounts.map(s => s.steamProfileUrl)
      : [];
    setEditDialogSmurfs(existingSmurfs.length > 0 ? existingSmurfs : ['']);
    setEditDialogOriginalSmurfCount(existingSmurfs.length);
    setEditDialogMmr(player.mmr?.toString() ?? '');
    setEditDialogScreenshotFile(null);
    setEditDialogScreenshotPreview(player.profileScreenshotUrl ?? null);
    setEditPlayerDialogOpen(true);
  };

  const handleEditPlayerDialogSave = async () => {
    if (!editingPlayerId) return;
    setLoading(true);
    try {
      let screenshotUrl: string | undefined;
      if (isMmrLimited && editDialogScreenshotFile) {
        screenshotUrl = await uploadScreenshot(editDialogScreenshotFile, team.id);
      }
      const smurfs = editDialogSmurfs
        .map(u => u.trim())
        .filter(u => u.length > 0)
        .map(u => ({ steamProfileUrl: u }));

      // Compute updated list first so we can use it for the Firestore save
      const updatedPlayers = editPlayers.map(p => {
        if (p.id !== editingPlayerId) return p;
        return {
          ...p,
          nickname: editDialogNickname.trim() || p.nickname,
          smurfAccounts: smurfs.length > 0 ? smurfs : undefined,
          ...(isMmrLimited
            ? {
                mmr: editDialogMmr ? (parseInt(editDialogMmr, 10) || p.mmr) : p.mmr,
                ...(screenshotUrl ? { profileScreenshotUrl: screenshotUrl } : {}),
              }
            : {}),
        };
      });

      setEditPlayers(updatedPlayers);
      setEditPlayerDialogOpen(false);
      setEditingPlayerId(null);

      // Persist immediately to Firestore (same mapping as handleConfirmSave)
      const activePlayers = updatedPlayers
        .filter(p => !p.isRemoved)
        .map(p => ({
          id: p.id.startsWith('new-') ? '' : p.id,
          nickname: p.nickname,
          role: p.role,
          steamProfileUrl: p.steamProfileUrl,
          steamId: p.steamId,
          steamId32: p.steamId32 || '',
          personaname: p.personaname,
          avatar: p.avatar,
          avatarmedium: p.avatarmedium,
          avatarfull: p.avatarfull,
          mmr: p.mmr ?? 0,
          profileScreenshotUrl: p.profileScreenshotUrl || '',
          smurfAccounts: p.smurfAccounts,
        })) as Player[];

      try {
        await onSaveRoster({
          players: activePlayers,
          teamName: editTeamName.trim(),
          teamTag: editTeamTag.trim(),
          teamLogo: editLogoFile || team.logoUrl,
          captainDiscord: editCaptainDiscord.trim(),
        });
        toast({ title: 'Zapisano', description: 'Dane gracza zostały zaktualizowane.' });
      } catch (err) {
        console.error('Failed to save player data:', err);
        toast({ title: 'Błąd zapisu', description: 'Nie udało się zapisać zmian. Spróbuj ponownie.', variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddPlayer = async () => {
    if (!newNickname.trim() || !newRole || !newSteamUrl.trim()) return;
    if (isMmrLimited && !newMmr.trim()) return;

    // MMR cap check — adding this player must not push the team over the cap
    if (isMmrLimited && mmrCap) {
      const currentTotal = editPlayers
        .filter(p => !p.isRemoved)
        .reduce((sum, p) => sum + (p.mmr || 0), 0);
      const incoming = parseInt(newMmr, 10) || 0;
      if (currentTotal + incoming > mmrCap) {
        alert(`Dodanie tego gracza (${incoming} MMR) przekroczy limit MMR drużyny (${mmrCap}). Obecny skład: ${currentTotal} MMR.`);
        return;
      }
    }

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

      const smurfAccounts = newSmurfUrls
        .map(u => u.trim())
        .filter(u => u.length > 0)
        .map(u => ({ steamProfileUrl: u }));

      let screenshotUrl: string | undefined;
      if (isMmrLimited && newProfileScreenshotFile) {
        screenshotUrl = await uploadScreenshot(newProfileScreenshotFile, team.id);
      }

      const newPlayer: EditablePlayer = {
        id: `new-${Date.now()}`,
        nickname: newNickname.trim(),
        role: newRole as PlayerRole,
        // Use canonical profileurl from Steam API when available; fall back to what the user typed.
        steamProfileUrl: data.profileurl || newSteamUrl.trim(),
        steamId: data.steamId64 || '',
        steamId32: data.steamId32 || '',
        personaname: data.personaname,
        avatar: data.avatar,
        avatarmedium: data.avatarmedium,
        avatarfull: data.avatarfull,
        isNew: true,
        mmr: isMmrLimited ? (parseInt(newMmr, 10) || undefined) : undefined,
        profileScreenshotUrl: screenshotUrl,
        smurfAccounts: smurfAccounts.length > 0 ? smurfAccounts : undefined,
      };

      setEditPlayers(prev => [...prev, newPlayer]);
      setNewNickname('');
      setNewRole('');
      setNewSteamUrl('');
      setNewMmr('');
      setNewProfileScreenshotFile(null);
      setNewProfileScreenshotPreview(null);
      setNewSmurfUrls(['']);
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
                  // Update to canonical Steam URL when available
                  steamProfileUrl: data.profileurl || p.steamProfileUrl,
                  personaname: data.personaname ?? p.personaname,
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

  // Whether the roster composition changed during THIS edit session (a player
  // was added or removed). Role, nickname and smurf edits don't set these flags,
  // so they stay saveable even when the transfer window is closed.
  const rosterCompositionChanged = useMemo(
    () => editPlayers.some(p => p.isNew || p.isRemoved),
    [editPlayers]
  );

  // Coach edited in this session (only when changes aren't locked)
  const coachChanged = !!coach && !coach.lock.locked
    && editCoach.trim() !== (coach.nickname ?? '');

  const canSave = useMemo(() => {
    if (activePlayerCount !== 5) return false;
    if (roleErrors.length > 0) return false;
    if (!editTeamName.trim()) return false;
    if (!editTeamTag.trim()) return false;

    // When the transfer window is closed, block only actual roster changes
    // (adding/removing players). Role/nick/smurf edits remain allowed even if
    // the current roster already differs from the previous round.
    if (!isTransferWindowOpen && rosterCompositionChanged) return false;

    // If season is active and transfer window is open, check transfer limits
    if (isSeasonActive && isTransferWindowOpen && transfersUsed > maxTransfers) return false;

    return true;
  }, [activePlayerCount, roleErrors, editTeamName, editTeamTag, isTransferWindowOpen, rosterCompositionChanged, transfersUsed, isSeasonActive, maxTransfers]);

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
          personaname: p.personaname,
          avatar: p.avatar,
          avatarmedium: p.avatarmedium,
          avatarfull: p.avatarfull,
          mmr: p.mmr ?? 0,
          profileScreenshotUrl: p.profileScreenshotUrl || '',
          smurfAccounts: p.smurfAccounts,
        })) as Player[];

      await onSaveRoster({
        players: activePlayers,
        teamName: editTeamName.trim(),
        teamTag: editTeamTag.trim(),
        teamLogo: editLogoFile || team.logoUrl,
        captainDiscord: editCaptainDiscord.trim(),
      });
      if (coach && coachChanged) {
        await coach.onSave(editCoach.trim().slice(0, MAX_COACH_NICKNAME) || null);
      }

      setConfirmDialogOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const font = useHeaderFont();
  const open = isTransferWindowOpen;
  const original = (id: string) => team.players?.find(p => p.id === id);
  // Something differs from the saved team: only then is there anything to save
  const dirty = editPlayers.some(p => p.isNew || p.isRemoved)
    || editPlayers.some(p => { const o = original(p.id); return !!o && (o.nickname !== p.nickname || o.role !== p.role || (o.steamProfileUrl || '') !== (p.steamProfileUrl || '')); })
    || editTeamName !== team.name || editTeamTag !== team.tag
    || editCaptainDiscord !== (linkedDiscord || team.discordUsername || team.captainDiscordUsername || '')
    || !!editLogoFile || coachChanged;
  // Why "Zapisz skład" is off (same rules as canSave)
  const blocker = activePlayerCount !== 5 ? `Skład musi mieć 5 graczy (teraz ${activePlayerCount})`
    : roleErrors.length ? null
    : !editTeamName.trim() || !editTeamTag.trim() ? 'Podaj nazwę i tag drużyny'
    : !open && rosterCompositionChanged ? 'Okno transferowe jest zamknięte: nie można dodawać ani usuwać graczy'
    : isSeasonActive && open && transfersUsed > maxTransfers ? `Za dużo zmian zawodników (${transfersUsed}/${maxTransfers})`
    : null;
  const totalMmr = editPlayers.filter(p => !p.isRemoved).reduce((s, p) => s + (p.mmr || 0), 0);
  const cancelAdd = () => { setShowAddPlayer(false); setNewNickname(''); setNewRole(''); setNewSteamUrl(''); setNewMmr(''); setNewProfileScreenshotFile(null); setNewProfileScreenshotPreview(null); setNewSmurfUrls(['']); };
  const rule = { borderBottom: `1px solid ${ink(8)}` };

  return (
    <div className="grid gap-x-12 gap-y-10 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1.75fr)_minmax(300px,1fr)]">
      {/* Players */}
      <div className="min-w-0 lg:min-h-0 flex flex-col">
        <Label right={
          !open ? <span className="flex items-center gap-1.5"><Lock className="w-3 h-3" />Transfery zamknięte</span>
            : isSeasonActive ? <span style={{ color: transfersUsed > maxTransfers ? C.loss : C.muted }}>Zmiany zawodników {transfersUsed}/{maxTransfers}</span>
            : <span style={{ color: C.win }}>Transfery otwarte</span>
        }>Skład</Label>
        <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto custom-scrollbar lg:pr-1 flex flex-col">
          {/* Carry → Hard Support, the order every captain thinks in */}
          {[...editPlayers].sort((a, b) => roleOrder(a.role) - roleOrder(b.role)).map(pl => {
            if (pl.isRemoved) {
              return (
                <div key={pl.id} className="relative h-[54px] shrink-0 flex items-center gap-3 pl-4" style={rule}>
                  <span className="absolute left-0 top-2 bottom-2 w-[3px]" style={{ background: C.loss }} />
                  <span className="flex-1 min-w-0 truncate line-through" style={{ color: C.muted }}>{pl.nickname} · {pl.role}</span>
                  {open && <Act onClick={() => handleRestorePlayer(pl.id)}>Przywróć</Act>}
                </div>
              );
            }
            const editing = editingId === pl.id;
            return (
              <div key={pl.id} className={cn('relative flex flex-col justify-center pl-4 pr-1 py-2', editing ? 'shrink-0' : 'lg:flex-1 min-h-[72px] lg:max-h-[124px]')}
                style={{ ...rule, background: editing ? mix(T, 8) : undefined }}>
                {(pl.isNew || editing) && <span className="absolute left-0 top-2 bottom-2 w-[3px]" style={{ background: editing ? T : C.win }} />}
                {/* The player: picture and league nick, the pencil right beside it */}
                <div className="flex items-center gap-5 min-w-0">
                  <Avatar player={{ name: pl.nickname, avatar: pl.avatarfull || pl.avatarmedium || pl.avatar }} size={editing ? 48 : 64} />
                  <div className="font-logik-extended-bold text-[22px] leading-tight truncate min-w-0" style={{ color: C.heading, ...font }}>{pl.nickname || '–'}</div>
                  <Tip content={<TipBody title={editing ? 'Gotowe' : 'Edytuj gracza'} />}>
                    <button type="button" onClick={() => setEditingId(editing ? null : pl.id)} aria-label={editing ? 'Gotowe' : `Edytuj: ${pl.nickname}`}
                      className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-colors hover:bg-[color-mix(in_srgb,var(--tournament-text,#fff)_8%,transparent)]" style={{ color: editing ? T : C.muted }}>
                      {editing ? <Check className="w-5 h-5" /> : <Pencil className="w-4 h-4" />}
                    </button>
                  </Tip>
                </div>
                {/* The same row, editable: nick, role, Steam (smurfs and MMR only where MMR is limited) */}
                {editing && (
                  <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-3">
                    <label className="flex flex-col gap-1">
                      <Kicker>Nick w lidze</Kicker>
                      <input value={pl.nickname} onChange={e => handlePlayerFieldChange(pl.id, 'nickname', e.target.value)} aria-label="Nick w lidze" autoFocus
                        className={cn(fieldClass, 'w-[190px] font-bold')} style={fieldStyle} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <Kicker>Rola</Kicker>
                      <Select value={pl.role} onValueChange={val => handlePlayerFieldChange(pl.id, 'role', val)}>
                        <SelectTrigger aria-label="Rola" className={cn(selectClass, 'w-[150px]')} style={fieldStyle}><SelectValue /></SelectTrigger>
                        <SelectContent>{PlayerRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                    </label>
                    {!isMmrLimited && (
                      <label className="flex flex-col gap-1 flex-1 min-w-[220px]">
                        <Kicker>Steam</Kicker>
                        <span className="flex items-end gap-2">
                          <input value={pl.steamProfileUrl} disabled={!open} placeholder="Link do profilu Steam" aria-label="Link do Steam"
                            onChange={e => {
                              handlePlayerFieldChange(pl.id, 'steamProfileUrl', e.target.value);
                              const m = e.target.value.match(/\/profiles\/(\d+)/);
                              if (m) handlePlayerFieldChange(pl.id, 'steamId', m[1]);
                            }}
                            className={cn(fieldClass, 'flex-1 text-[13px]')} style={fieldStyle} />
                          {open && (
                            <Tip content={<TipBody title="Odśwież dane ze Steama" />}>
                              <button type="button" onClick={() => handleRefreshPlayerSteam(pl.id)} disabled={loading || !pl.steamProfileUrl} aria-label="Odśwież dane ze Steama"
                                className="p-1 mb-1 opacity-60 hover:opacity-100 disabled:opacity-25" style={{ color: C.text }}>
                                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                              </button>
                            </Tip>
                          )}
                        </span>
                      </label>
                    )}
                    {isMmrLimited && (
                      <>
                        <span className="h-9 flex items-center text-[13px] tabular-nums" style={{ color: C.muted }}>{pl.mmr != null ? `${pl.mmr} MMR` : ''}</span>
                        <Act onClick={() => handleOpenEditPlayer(pl.id)}>MMR i smurfy</Act>
                      </>
                    )}
                    {open && <Act danger onClick={() => { handleRemovePlayer(pl.id); setEditingId(null); }}><X className="w-3.5 h-3.5" />Usuń ze składu</Act>}
                  </div>
                )}
              </div>
            );
          })}

          {open && activePlayerCount < 5 && (showAddPlayer ? (
            <div className="relative shrink-0 py-3 pl-3" style={rule}>
              <span className="absolute left-0 top-3 bottom-3 w-[3px]" style={{ background: T }} />
              <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
                <input value={newNickname} onChange={e => setNewNickname(e.target.value)} placeholder="Nick gracza" aria-label="Nick nowego gracza" className={cn(fieldClass, 'w-[170px]')} style={fieldStyle} />
                <Select value={newRole} onValueChange={val => setNewRole(val as PlayerRole)}>
                  <SelectTrigger aria-label="Rola nowego gracza" className={cn(selectClass, 'w-[140px]')} style={fieldStyle}><SelectValue placeholder="Rola" /></SelectTrigger>
                  <SelectContent>{PlayerRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
                <input value={newSteamUrl} onChange={e => setNewSteamUrl(e.target.value)} placeholder="Link do profilu Steam" aria-label="Steam nowego gracza" className={cn(fieldClass, 'flex-1 min-w-[180px] text-[13px]')} style={fieldStyle} />
                <Solid onClick={handleAddPlayer} disabled={loading || !newNickname.trim() || !newRole || !newSteamUrl.trim() || (isMmrLimited ? (!newMmr.trim() || !newProfileScreenshotFile) : false)}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}Dodaj
                </Solid>
                <Act onClick={cancelAdd}>Anuluj</Act>
              </div>
              {isMmrLimited && (
                <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3">
                  <label className="flex flex-col gap-1">
                    <Kicker>MMR</Kicker>
                    <input type="number" min={0} value={newMmr} onChange={e => setNewMmr(e.target.value)} placeholder="4500" className={cn(fieldClass, 'w-[100px] tabular-nums')} style={fieldStyle} />
                  </label>
                  <div className="flex flex-col gap-1">
                    <Kicker>Screenshot profilu</Kicker>
                    <button type="button" onClick={() => screenshotInputRef.current?.click()} className="h-9 flex items-center gap-2 text-[13px]" style={{ color: newProfileScreenshotPreview ? C.win : T }}>
                      <Upload className="w-4 h-4" />{newProfileScreenshotPreview ? 'Wgrany, zmień' : 'Wgraj'}
                    </button>
                    <input ref={screenshotInputRef} type="file" accept="image/*" className="hidden" onChange={e => {
                      const file = e.target.files?.[0] ?? null;
                      setNewProfileScreenshotFile(file);
                      if (file) { const reader = new FileReader(); reader.onload = () => setNewProfileScreenshotPreview(reader.result as string); reader.readAsDataURL(file); }
                      else setNewProfileScreenshotPreview(null);
                    }} />
                  </div>
                  <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
                    <Kicker>Konta smurf</Kicker>
                    {newSmurfUrls.map((url, i) => (
                      <div key={i} className="flex items-end gap-2">
                        <input value={url} onChange={e => setNewSmurfUrls(prev => prev.map((u, idx) => idx === i ? e.target.value : u))} placeholder="Link do profilu Steam smurfa" className={cn(fieldClass, 'flex-1 text-[13px]')} style={fieldStyle} />
                        {newSmurfUrls.length > 1 && <button type="button" onClick={() => setNewSmurfUrls(prev => prev.filter((_, idx) => idx !== i))} aria-label="Usuń smurfa" className="p-1 opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>}
                      </div>
                    ))}
                    {newSmurfUrls.length < 3 && <Act className="self-start mt-1" onClick={() => setNewSmurfUrls(prev => [...prev, ''])}>+ Smurf</Act>}
                  </div>
                  {mmrCap && newMmr && totalMmr + (parseInt(newMmr, 10) || 0) > mmrCap && (
                    <p className="w-full text-[13px] flex items-center gap-1.5" style={{ color: C.loss }}><AlertTriangle className="w-3.5 h-3.5" />Przekroczy limit MMR ({totalMmr + (parseInt(newMmr, 10) || 0)}/{mmrCap})</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="shrink-0 pt-3"><Act onClick={() => setShowAddPlayer(true)}>+ Dodaj gracza</Act></div>
          ))}

          {roleErrors.map(err => (
            <p key={err} className="mt-2 text-[13px] flex items-center gap-1.5" style={{ color: C.loss }}><AlertTriangle className="w-3.5 h-3.5" />{err}</p>
          ))}
        </div>
      </div>

      {/* The team, the coach, the window — and saving */}
      <div className="min-w-0 lg:min-h-0 flex flex-col">
        <Label>Drużyna</Label>
        <div className="flex items-end gap-5">
          <Tip content={open ? <TipBody title="Zmień herb" /> : null}>
            <label className={cn('relative shrink-0 rounded-[10px] overflow-hidden', open && 'cursor-pointer group')} style={{ width: 60, height: 60, background: ink(8) }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {editLogoPreview && <img src={editLogoPreview} alt="Herb drużyny" className="w-full h-full object-cover" />}
              {open && <span className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity text-white"><Upload className="w-5 h-5" /></span>}
              {open && <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />}
            </label>
          </Tip>
          <label className="flex flex-col gap-1 flex-1 min-w-0">
            <Kicker>Nazwa</Kicker>
            <input value={editTeamName} onChange={e => setEditTeamName(e.target.value)} disabled={!open} aria-label="Nazwa drużyny" className={cn(fieldClass, 'w-full font-bold')} style={fieldStyle} />
          </label>
          <label className="flex flex-col gap-1 w-[84px] shrink-0">
            <Kicker>Tag</Kicker>
            <input value={editTeamTag} onChange={e => setEditTeamTag(e.target.value.slice(0, 5))} maxLength={5} disabled={!open} aria-label="Tag drużyny" className={cn(fieldClass, 'w-full font-bold uppercase')} style={fieldStyle} />
          </label>
        </div>
        <label className="flex flex-col gap-1 mt-4">
          <Kicker>Discord kapitana</Kicker>
          {linkedDiscord
            // The captain's own Discord account is linked: that is the Discord, nothing to type
            ? <span className="h-9 flex items-center font-bold" style={{ color: C.heading }}>{linkedDiscord}</span>
            : <input value={editCaptainDiscord} onChange={e => setEditCaptainDiscord(e.target.value)} aria-label="Discord kapitana" className={cn(fieldClass, 'w-full')} style={fieldStyle} />}
        </label>

        {coach && (
          <>
            <Label className="mt-7" right={<InfoPopover label="Zasady dotyczące trenera w tym turnieju" title="Zasady dotyczące trenera w tym turnieju">{coach.rulesDetails}</InfoPopover>}>Trener</Label>
            {coach.lock.locked ? (
              <>
                <div className="font-bold" style={{ color: coach.nickname ? C.heading : C.muted }}>{coach.nickname || 'Bez trenera'}</div>
                <p className="mt-1 text-[12px] flex items-start gap-1.5" style={{ color: C.muted }}><Lock className="w-3 h-3 mt-0.5 shrink-0" />{coach.lock.reason}</p>
              </>
            ) : editCoach || coach.nickname || addingCoach ? (
              <input value={editCoach} maxLength={MAX_COACH_NICKNAME} onChange={e => setEditCoach(e.target.value)} placeholder="Nick trenera" aria-label="Nick trenera" autoFocus={addingCoach}
                className={cn(fieldClass, 'w-full font-bold')} style={fieldStyle} />
            ) : (
              <Act className="self-start" onClick={() => setAddingCoach(true)}>+ Dodaj trenera</Act>
            )}
          </>
        )}

        {isMmrLimited && (
          <p className="mt-7 text-[13px] tabular-nums" style={{ color: mmrCap != null && totalMmr > mmrCap ? C.loss : C.text }}>
            Łączne MMR: <b>{totalMmr}</b>{mmrCap != null && <span style={{ color: C.muted }}> / {mmrCap}</span>}
          </p>
        )}

        {dirty && (
          <div className="mt-auto pt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
            <Solid onClick={handleSave} disabled={!canSave || loading}><Save className="w-4 h-4" />Zapisz skład</Solid>
            <Act onClick={() => { startEditing(); cancelAdd(); }}>Cofnij zmiany</Act>
            {blocker && <p className="w-full text-[13px]" style={{ color: C.loss }}>{blocker}</p>}
          </div>
        )}
      </div>

          {/* Confirm dialog */}
          <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
            <DialogContent className="border text-white max-w-md bg-black/40 backdrop-blur-2xl backdrop-saturate-150" style={{ borderColor: 'var(--tournament-border, rgba(255,255,255,0.1))' }}>
              <DialogHeader>
                <DialogTitle
                  className="uppercase tracking-[0.15em]"
                  style={{
                    color: 'var(--tournament-heading)',
                    fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined,
                  }}
                >
                  Potwierdź zmiany
                </DialogTitle>
                <DialogDescription style={{ color: 'var(--tournament-secondary-text)' }}>
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
                {coachChanged && (
                  <p className="text-sm text-white/80">
                    Trener:{' '}
                    {coach?.nickname
                      ? <span className="line-through text-white/40">{coach.nickname}</span>
                      : <span className="text-white/40">brak</span>}
                    {' → '}
                    {editCoach.trim()
                      ? <span className="text-pdl-gold">{editCoach.trim()}</span>
                      : <span className="text-white/60">bez trenera</span>}
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

                {/* MMR total for MMR-limited tournaments */}
                {isMmrLimited && (() => {
                  const totalMmr = editPlayers.filter(p => !p.isRemoved).reduce((s, p) => s + (p.mmr || 0), 0);
                  const overCap = mmrCap != null && totalMmr > mmrCap;
                  return (
                    <div className={`rounded-lg border p-3 ${overCap ? 'border-red-500/30 bg-red-500/10' : 'border-white/10 bg-white/[0.03]'}`}>
                      <p className="text-sm text-white/80 flex items-center gap-2">
                        Łączne MMR składu:
                        <span className="font-logik-extended-bold">{totalMmr}</span>
                        {mmrCap != null && <span className="text-white/40">/ {mmrCap}</span>}
                        {overCap && (
                          <span className="text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Przekroczony limit!
                          </span>
                        )}
                      </p>
                    </div>
                  );
                })()}

                {/* Admin verification warning when new players added in MMR-limited tournament */}
                {isMmrLimited && editPlayers.some(p => p.isNew && !p.isRemoved) && (
                  <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-200">
                      Nowi gracze wymagają weryfikacji przez administratora. Po zapisaniu status drużyny zostanie ustawiony na <strong>oczekujący</strong> do momentu zatwierdzenia przez admina.
                    </p>
                  </div>
                )}

                <div className="text-sm text-white/80">
                  Skład ({count(activePlayerCount, 'gracz', 'graczy', 'graczy')}):
                  <ul className="mt-2 space-y-1">
                    {editPlayers.filter(p => !p.isRemoved).map(p => (
                      <li key={p.id} className="flex items-center gap-2">
                        {p.isNew && <span className="text-xs text-green-400">[NOWY]</span>}
                        <span>{p.nickname}</span>
                        <span className="text-white/40">({p.role})</span>
                        {isMmrLimited && p.mmr != null && <span className="text-white/30 text-xs">({p.mmr} MMR)</span>}
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

          {/* Edit player dialog */}
          <Dialog open={editPlayerDialogOpen} onOpenChange={setEditPlayerDialogOpen}>
            <DialogContent className="border text-white max-w-md bg-black/40 backdrop-blur-2xl backdrop-saturate-150" style={{ borderColor: 'var(--tournament-border, rgba(255,255,255,0.1))' }}>
              <DialogHeader>
                <DialogTitle
                  className="uppercase tracking-[0.15em]"
                  style={{
                    color: 'var(--tournament-heading)',
                    fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined,
                  }}
                >
                  Edytuj gracza
                </DialogTitle>
                <DialogDescription style={{ color: 'var(--tournament-secondary-text)' }}>
                  {isTransferWindowOpen
                    ? 'Zmień dane gracza bez usuwania i ponownego dodawania.'
                    : 'Okno transferowe zamknięte — możesz zmienić tylko nick i dodawać nowe konta smurf.'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Nickname */}
                <div className="space-y-1">
                  <FieldLabel className="text-sm" style={{ color: 'var(--tournament-secondary-text)' }}>Nick gracza</FieldLabel>
                  <Input
                    value={editDialogNickname}
                    onChange={(e) => setEditDialogNickname(e.target.value)}
                    placeholder="Nick"
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>

                {/* MMR + Screenshot — only for MMR-limited tournaments when transfer window is open */}
                {isMmrLimited && isTransferWindowOpen && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <FieldLabel className="text-sm" style={{ color: 'var(--tournament-secondary-text)' }}>MMR</FieldLabel>
                      <Input
                        type="number"
                        min={0}
                        value={editDialogMmr}
                        onChange={(e) => setEditDialogMmr(e.target.value)}
                        placeholder="np. 4500"
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <FieldLabel className="text-sm" style={{ color: 'var(--tournament-secondary-text)' }}>Screenshot MMR</FieldLabel>
                      <div
                        className="relative border border-dashed border-white/20 rounded-md bg-white/5 hover:bg-white/10 transition-colors cursor-pointer text-center p-2"
                        onClick={() => editScreenshotInputRef.current?.click()}
                      >
                        {editDialogScreenshotPreview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={editDialogScreenshotPreview}
                            alt="Screenshot"
                            className="max-h-16 mx-auto rounded object-contain"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1 py-1">
                            <Upload className="w-4 h-4 text-white/40" />
                            <span className="text-xs text-white/40">Zmień screenshot</span>
                          </div>
                        )}
                        <input
                          ref={editScreenshotInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            setEditDialogScreenshotFile(file);
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = () => setEditDialogScreenshotPreview(reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Smurf accounts */}
                <div className="space-y-1">
                  <FieldLabel className="text-sm" style={{ color: 'var(--tournament-secondary-text)' }}>
                    Konta smurf
                    <span className="ml-1 text-white/30 font-normal">(opcjonalnie)</span>
                  </FieldLabel>
                  <div className="space-y-2">
                    {editDialogSmurfs.map((url, i) => {
                      const isExisting = i < editDialogOriginalSmurfCount;
                      const locked = !isTransferWindowOpen && isExisting;
                      return (
                        <div key={i} className="flex gap-2">
                          <Input
                            value={url}
                            onChange={(e) => setEditDialogSmurfs(prev => prev.map((u, idx) => idx === i ? e.target.value : u))}
                            placeholder="https://steamcommunity.com/profiles/..."
                            className="bg-white/5 border-white/10 text-white text-sm flex-1"
                            disabled={locked}
                          />
                          {(isTransferWindowOpen ? editDialogSmurfs.length > 1 : !isExisting) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-white/40 hover:text-red-400 px-2"
                              onClick={() => setEditDialogSmurfs(prev => prev.filter((_, idx) => idx !== i))}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white/40 text-xs hover:text-white/60"
                      onClick={() => setEditDialogSmurfs(prev => [...prev, ''])}
                    >
                      + Dodaj smurf
                    </Button>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => { setEditPlayerDialogOpen(false); setEditingPlayerId(null); }}
                  className="text-white/60"
                >
                  Anuluj
                </Button>
                <Button
                  onClick={handleEditPlayerDialogSave}
                  disabled={loading || !editDialogNickname.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Zapisz zmiany
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
    </div>
  );
}
