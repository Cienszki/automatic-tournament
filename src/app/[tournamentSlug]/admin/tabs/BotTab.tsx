"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Bot,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Wifi,
  WifiOff,
  Plus,
  Trash2,
  Play,
  Square,
  RefreshCw,
  MessageSquare,
  Shield,
  Settings,
  Clock,
  Users,
  Gamepad2,
  Server,
  Eye,
  Monitor,
  Activity,
  KeyRound,
  Power,
  EyeOff,
} from 'lucide-react';
import type {
  TournamentBotConfig,
  DotaGameMode,
  DotaServerRegion,
  DotaLobbyVisibility,
  DotaPauseSetting,
  LobbySession,
  LobbyWhitelistEntry,
} from '@/types/lobby-bot';
import type { TournamentTheme, TournamentConfig } from '@/types/tournament';
import {
  DEFAULT_TOURNAMENT_BOT_CONFIG,
  GAME_MODE_LABELS,
  SERVER_REGION_LABELS,
} from '@/types/lobby-bot';

// Safe bot account type — encryptedPassword is never returned from the API
interface SafeBotAccount {
  id: string;
  username: string;
  steamId: string;
  steamId32: string;
  displayName: string;
  enabled: boolean;
  status: string;
  currentMatchId: string | null;
  currentTournamentId: string | null;
  lastHeartbeat: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Bot Tab Component ──────────────────────────────────────────────────────

/**
 * Bot Tab - Dota 2 Lobby Bot Configuration & Monitoring
 * Allows admins to:
 * - Enable/disable the bot system for the tournament
 * - Configure lobby settings (game mode, server, visibility, etc.)
 * - Set ready check commands and behavior
 * - Customize chat messages the bot posts in lobby
 * - Configure post-match sync behavior
 * - Monitor active bot sessions and their status
 */
export function BotTab(): React.ReactElement {
  const { tournament, theme } = useTournament();
  const { user } = useAuth();

  const [config, setConfig] = useState<TournamentBotConfig>(DEFAULT_TOURNAMENT_BOT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [activeTab, setActiveTab] = useState<'settings' | 'monitor' | 'accounts'>('settings');

  // Active sessions for monitoring
  const [activeSessions, setActiveSessions] = useState<LobbySession[]>([]);
  const [poolStatus, setPoolStatus] = useState<{
    total: number;
    idle: number;
    active: number;
    offline: number;
    error: number;
    pendingSessions: number;
    activeSessions: number;
  } | null>(null);

  // Bot accounts state
  const [botAccounts, setBotAccounts] = useState<SafeBotAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [showAddAccountDialog, setShowAddAccountDialog] = useState(false);
  const [newAccountUsername, setNewAccountUsername] = useState('');
  const [newAccountPassword, setNewAccountPassword] = useState('');
  const [newAccountDisplayName, setNewAccountDisplayName] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [addAccountError, setAddAccountError] = useState<string | null>(null);
  const [togglingAccountId, setTogglingAccountId] = useState<string | null>(null);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);

  // Manual test controls
  const [testMatchId, setTestMatchId] = useState('');
  const [isForcing, setIsForcing] = useState(false);
  const [forceResult, setForceResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Whitelist state
  const [whitelist, setWhitelist] = useState<LobbyWhitelistEntry[]>([]);
  const [isLoadingWhitelist, setIsLoadingWhitelist] = useState(false);
  const [newWhitelistUrl, setNewWhitelistUrl] = useState('');
  const [newWhitelistNote, setNewWhitelistNote] = useState('');
  const [isAddingWhitelist, setIsAddingWhitelist] = useState(false);
  const [whitelistError, setWhitelistError] = useState<string | null>(null);
  const [removingWhitelistId, setRemovingWhitelistId] = useState<string | null>(null);
  const [isOrchestrating, setIsOrchestrating] = useState(false);
  const [orchestrateResult, setOrchestrateResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Load configuration
  useEffect(() => {
    if (!tournament?.id) return;

    const loadConfig = async (): Promise<void> => {
      try {
        const res = await fetch(`/api/admin/bot/config?tournamentId=${tournament.id}`, {
          headers: {
            Authorization: `Bearer ${await user?.getIdToken()}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.config) {
            setConfig(data.config);
          }
        }
      } catch (error) {
        console.error('Failed to load bot config:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [tournament?.id, user]);

  // Save configuration
  const handleSave = useCallback(async (): Promise<void> => {
    if (!tournament?.id || !user) return;

    setIsSaving(true);
    setSaveStatus('idle');

    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/bot/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tournamentId: tournament.id,
          config,
        }),
      });

      if (res.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  }, [config, tournament?.id, user]);

  // Load monitoring data
  const loadMonitoringData = useCallback(async (): Promise<void> => {
    if (!tournament?.id || !user) return;

    try {
      const token = await user.getIdToken();
      const [sessionsRes, poolRes] = await Promise.all([
        fetch(`/api/admin/bot/sessions?tournamentId=${tournament.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/admin/bot/pool-status', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (sessionsRes.ok) {
        const data = await sessionsRes.json();
        setActiveSessions(data.sessions || []);
      }
      if (poolRes.ok) {
        const data = await poolRes.json();
        setPoolStatus(data);
      }
    } catch (error) {
      console.error('Failed to load monitoring data:', error);
    }
  }, [tournament?.id, user]);

  useEffect(() => {
    if (activeTab === 'monitor') {
      loadMonitoringData();
      const interval = setInterval(loadMonitoringData, 10000);
      return () => clearInterval(interval);
    }
  }, [activeTab, loadMonitoringData]);

  // ─── Bot account handlers ─────────────────────────────────────────

  const loadBotAccounts = useCallback(async (): Promise<void> => {
    if (!user) return;
    setIsLoadingAccounts(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/bot/accounts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json() as { accounts: SafeBotAccount[] };
        setBotAccounts(data.accounts);
      }
    } catch (error) {
      console.error('Failed to load bot accounts:', error);
    } finally {
      setIsLoadingAccounts(false);
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'accounts') {
      loadBotAccounts();
    }
  }, [activeTab, loadBotAccounts]);

  const handleAddBotAccount = useCallback(async (): Promise<void> => {
    if (!user || !newAccountUsername.trim() || !newAccountPassword.trim() || !newAccountDisplayName.trim()) return;
    setIsAddingAccount(true);
    setAddAccountError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/bot/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          username: newAccountUsername.trim(),
          password: newAccountPassword,
          displayName: newAccountDisplayName.trim(),
        }),
      });
      if (res.ok) {
        setShowAddAccountDialog(false);
        setAddAccountError(null);
        setNewAccountUsername('');
        setNewAccountPassword('');
        setNewAccountDisplayName('');
        setShowNewPassword(false);
        await loadBotAccounts();
      } else {
        const data = await res.json() as { error?: string };
        setAddAccountError(data.error ?? `Błąd serwera: ${res.status}`);
      }
    } catch (error) {
      console.error('Failed to add bot account:', error);
      setAddAccountError('Błąd połączenia z serwerem.');
    } finally {
      setIsAddingAccount(false);
    }
  }, [user, newAccountUsername, newAccountPassword, newAccountDisplayName, loadBotAccounts]);

  const handleToggleBotAccount = useCallback(async (id: string, enabled: boolean): Promise<void> => {
    if (!user) return;
    setTogglingAccountId(id);
    try {
      const token = await user.getIdToken();
      await fetch(`/api/admin/bot/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled }),
      });
      setBotAccounts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, enabled } : a))
      );
    } catch (error) {
      console.error('Failed to toggle bot account:', error);
    } finally {
      setTogglingAccountId(null);
    }
  }, [user]);

  const handleForceCreateSession = useCallback(async (): Promise<void> => {
    if (!user || !tournament?.id || !testMatchId.trim()) return;
    setIsForcing(true);
    setForceResult(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/bot/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tournamentId: tournament.id,
          matchId: testMatchId.trim(),
          gameNumber: 1,
        }),
      });
      const data = await res.json() as { session?: unknown; error?: string };
      if (res.ok) {
        setForceResult({ ok: true, message: 'Sesja created. Kliknij "Uruchom orkiestrator" aby przypisać bota.' });
      } else {
        setForceResult({ ok: false, message: data.error ?? `Błąd ${res.status}` });
      }
    } catch (err) {
      setForceResult({ ok: false, message: 'Błąd połączenia z serwerem.' });
      console.error(err);
    } finally {
      setIsForcing(false);
    }
  }, [user, tournament?.id, testMatchId]);

  const handleRunOrchestrator = useCallback(async (): Promise<void> => {
    if (!user || !tournament?.id) return;
    setIsOrchestrating(true);
    setOrchestrateResult(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/bot/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tournamentId: tournament.id }),
      });
      const data = await res.json() as {
        lobbiesScheduled?: number;
        botsAssigned?: number;
        eventsProcessed?: number;
        errors?: string[];
        error?: string;
      };
      if (res.ok) {
        const msg = `Przypisano botów: ${data.botsAssigned ?? 0}, zaplanowano sesji: ${data.lobbiesScheduled ?? 0}, zdarzeń: ${data.eventsProcessed ?? 0}${data.errors?.length ? ` | Błędy: ${data.errors.join('; ')}` : ''}`;
        setOrchestrateResult({ ok: data.errors?.length === 0, message: msg });
        await loadMonitoringData();
      } else {
        setOrchestrateResult({ ok: false, message: data.error ?? `Błąd ${res.status}` });
      }
    } catch (err) {
      setOrchestrateResult({ ok: false, message: 'Błąd połączenia z serwerem.' });
      console.error(err);
    } finally {
      setIsOrchestrating(false);
    }
  }, [user, tournament?.id, loadMonitoringData]);

  const handleDeleteBotAccount = useCallback(async (id: string): Promise<void> => {
    if (!user) return;
    setDeletingAccountId(id);
    try {
      const token = await user.getIdToken();
      await fetch(`/api/admin/bot/accounts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setBotAccounts((prev) => prev.filter((a) => a.id !== id));
    } catch (error) {
      console.error('Failed to delete bot account:', error);
    } finally {
      setDeletingAccountId(null);
    }
  }, [user]);

  // ─── Whitelist handlers ───────────────────────────────────────────

  const loadWhitelist = useCallback(async (): Promise<void> => {
    if (!tournament?.id || !user) return;
    setIsLoadingWhitelist(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/bot/whitelist?tournamentId=${tournament.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json() as { whitelist: LobbyWhitelistEntry[] };
        setWhitelist(data.whitelist ?? []);
      }
    } catch (error) {
      console.error('Failed to load whitelist:', error);
    } finally {
      setIsLoadingWhitelist(false);
    }
  }, [tournament?.id, user]);

  useEffect(() => {
    if (activeTab === 'settings') {
      loadWhitelist();
    }
  }, [activeTab, loadWhitelist]);

  const handleAddToWhitelist = useCallback(async (): Promise<void> => {
    if (!tournament?.id || !user || !newWhitelistUrl.trim()) return;
    setIsAddingWhitelist(true);
    setWhitelistError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/bot/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tournamentId: tournament.id,
          steamProfileUrl: newWhitelistUrl.trim(),
          note: newWhitelistNote.trim() || undefined,
        }),
      });
      const data = await res.json() as { entry?: LobbyWhitelistEntry; error?: string };
      if (res.ok && data.entry) {
        setWhitelist((prev) => [...prev, data.entry!]);
        setNewWhitelistUrl('');
        setNewWhitelistNote('');
      } else {
        setWhitelistError(data.error ?? `Błąd ${res.status}`);
      }
    } catch {
      setWhitelistError('Błąd połączenia z serwerem.');
    } finally {
      setIsAddingWhitelist(false);
    }
  }, [tournament?.id, user, newWhitelistUrl, newWhitelistNote]);

  const handleRemoveFromWhitelist = useCallback(async (steamId32: string): Promise<void> => {
    if (!tournament?.id || !user) return;
    setRemovingWhitelistId(steamId32);
    try {
      const token = await user.getIdToken();
      await fetch('/api/admin/bot/whitelist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tournamentId: tournament.id, steamId32 }),
      });
      setWhitelist((prev) => prev.filter((e) => e.steamId32 !== steamId32));
    } catch (error) {
      console.error('Failed to remove from whitelist:', error);
    } finally {
      setRemovingWhitelistId(null);
    }
  }, [tournament?.id, user]);

  // ─── Update helpers ───────────────────────────────────────────────

  const updateLobby = <K extends keyof TournamentBotConfig['lobby']>(
    key: K,
    value: TournamentBotConfig['lobby'][K]
  ): void => {
    setConfig((prev) => ({
      ...prev,
      lobby: { ...prev.lobby, [key]: value },
    }));
  };

  const updateReadyCheck = <K extends keyof TournamentBotConfig['readyCheck']>(
    key: K,
    value: TournamentBotConfig['readyCheck'][K]
  ): void => {
    setConfig((prev) => ({
      ...prev,
      readyCheck: { ...prev.readyCheck, [key]: value },
    }));
  };

  const updateChat = <K extends keyof TournamentBotConfig['chatMessages']>(
    key: K,
    value: TournamentBotConfig['chatMessages'][K]
  ): void => {
    setConfig((prev) => ({
      ...prev,
      chatMessages: { ...prev.chatMessages, [key]: value },
    }));
  };

  const updatePostMatch = <K extends keyof TournamentBotConfig['postMatch']>(
    key: K,
    value: TournamentBotConfig['postMatch'][K]
  ): void => {
    setConfig((prev) => ({
      ...prev,
      postMatch: { ...prev.postMatch, [key]: value },
    }));
  };

  const updateEnforcement = <K extends keyof TournamentBotConfig['enforcement']>(
    key: K,
    value: TournamentBotConfig['enforcement'][K]
  ): void => {
    setConfig((prev) => ({
      ...prev,
      enforcement: { ...prev.enforcement, [key]: value },
    }));
  };

  // ─── Ready command management ─────────────────────────────────────

  const [newReadyCmd, setNewReadyCmd] = useState('');
  const [newUnreadyCmd, setNewUnreadyCmd] = useState('');

  const addReadyCommand = (): void => {
    if (newReadyCmd.trim() && !config.readyCheck.readyCommands.includes(newReadyCmd.trim())) {
      updateReadyCheck('readyCommands', [
        ...config.readyCheck.readyCommands,
        newReadyCmd.trim(),
      ]);
      setNewReadyCmd('');
    }
  };

  const removeReadyCommand = (cmd: string): void => {
    updateReadyCheck(
      'readyCommands',
      config.readyCheck.readyCommands.filter((c) => c !== cmd)
    );
  };

  const addUnreadyCommand = (): void => {
    if (newUnreadyCmd.trim() && !config.readyCheck.unreadyCommands.includes(newUnreadyCmd.trim())) {
      updateReadyCheck('unreadyCommands', [
        ...config.readyCheck.unreadyCommands,
        newUnreadyCmd.trim(),
      ]);
      setNewUnreadyCmd('');
    }
  };

  const removeUnreadyCommand = (cmd: string): void => {
    updateReadyCheck(
      'unreadyCommands',
      config.readyCheck.unreadyCommands.filter((c) => c !== cmd)
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: theme.primaryColor }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with sub-tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${theme.primaryColor}20` }}
          >
            <Bot className="h-5 w-5" style={{ color: theme.primaryColor }} />
          </div>
          <div>
            <h2 className="text-xl font-bold">Lobby Bot</h2>
            <p className="text-sm text-muted-foreground">
              Automatyczne tworzenie i zarządzanie lobby Dota 2
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === 'settings' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('settings')}
            style={activeTab === 'settings' ? { backgroundColor: theme.primaryColor } : {}}
          >
            <Settings className="h-4 w-4 mr-1" />
            Ustawienia
          </Button>
          <Button
            variant={activeTab === 'monitor' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('monitor')}
            style={activeTab === 'monitor' ? { backgroundColor: theme.primaryColor } : {}}
          >
            <Monitor className="h-4 w-4 mr-1" />
            Monitor
          </Button>
          <Button
            variant={activeTab === 'accounts' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('accounts')}
            style={activeTab === 'accounts' ? { backgroundColor: theme.primaryColor } : {}}
          >
            <KeyRound className="h-4 w-4 mr-1" />
            Konta
          </Button>
        </div>
      </div>

      {activeTab === 'settings' ? (
        <SettingsView
          config={config}
          setConfig={setConfig}
          updateLobby={updateLobby}
          updateReadyCheck={updateReadyCheck}
          updateChat={updateChat}
          updatePostMatch={updatePostMatch}
          updateEnforcement={updateEnforcement}
          newReadyCmd={newReadyCmd}
          setNewReadyCmd={setNewReadyCmd}
          newUnreadyCmd={newUnreadyCmd}
          setNewUnreadyCmd={setNewUnreadyCmd}
          addReadyCommand={addReadyCommand}
          removeReadyCommand={removeReadyCommand}
          addUnreadyCommand={addUnreadyCommand}
          removeUnreadyCommand={removeUnreadyCommand}
          handleSave={handleSave}
          isSaving={isSaving}
          saveStatus={saveStatus}
          theme={theme}
          tournament={tournament}
          whitelist={whitelist}
          isLoadingWhitelist={isLoadingWhitelist}
          newWhitelistUrl={newWhitelistUrl}
          setNewWhitelistUrl={setNewWhitelistUrl}
          newWhitelistNote={newWhitelistNote}
          setNewWhitelistNote={setNewWhitelistNote}
          isAddingWhitelist={isAddingWhitelist}
          whitelistError={whitelistError}
          onAddToWhitelist={handleAddToWhitelist}
          removingWhitelistId={removingWhitelistId}
          onRemoveFromWhitelist={handleRemoveFromWhitelist}
        />
      ) : activeTab === 'monitor' ? (
        <MonitorView
          activeSessions={activeSessions}
          poolStatus={poolStatus}
          onRefresh={loadMonitoringData}
          theme={theme}
          testMatchId={testMatchId}
          setTestMatchId={setTestMatchId}
          isForcing={isForcing}
          forceResult={forceResult}
          onForceCreate={handleForceCreateSession}
          isOrchestrating={isOrchestrating}
          orchestrateResult={orchestrateResult}
          onOrchestrate={handleRunOrchestrator}
        />
      ) : (
        <AccountsView
          accounts={botAccounts}
          isLoading={isLoadingAccounts}
          onRefresh={loadBotAccounts}
          showAddDialog={showAddAccountDialog}
          setShowAddDialog={(v) => { setShowAddAccountDialog(v); if (!v) setAddAccountError(null); }}
          newUsername={newAccountUsername}
          setNewUsername={setNewAccountUsername}
          newPassword={newAccountPassword}
          setNewPassword={setNewAccountPassword}
          newDisplayName={newAccountDisplayName}
          setNewDisplayName={setNewAccountDisplayName}
          showNewPassword={showNewPassword}
          setShowNewPassword={setShowNewPassword}
          isAdding={isAddingAccount}
          addError={addAccountError}
          onAdd={handleAddBotAccount}
          togglingId={togglingAccountId}
          onToggle={handleToggleBotAccount}
          deletingId={deletingAccountId}
          onDelete={handleDeleteBotAccount}
          theme={theme}
        />
      )}
    </div>
  );
}

// ─── Settings View ──────────────────────────────────────────────────────────

interface SettingsViewProps {
  config: TournamentBotConfig;
  setConfig: React.Dispatch<React.SetStateAction<TournamentBotConfig>>;
  updateLobby: <K extends keyof TournamentBotConfig['lobby']>(
    key: K,
    value: TournamentBotConfig['lobby'][K]
  ) => void;
  updateReadyCheck: <K extends keyof TournamentBotConfig['readyCheck']>(
    key: K,
    value: TournamentBotConfig['readyCheck'][K]
  ) => void;
  updateChat: <K extends keyof TournamentBotConfig['chatMessages']>(
    key: K,
    value: TournamentBotConfig['chatMessages'][K]
  ) => void;
  updatePostMatch: <K extends keyof TournamentBotConfig['postMatch']>(
    key: K,
    value: TournamentBotConfig['postMatch'][K]
  ) => void;
  updateEnforcement: <K extends keyof TournamentBotConfig['enforcement']>(
    key: K,
    value: TournamentBotConfig['enforcement'][K]
  ) => void;
  newReadyCmd: string;
  setNewReadyCmd: (v: string) => void;
  newUnreadyCmd: string;
  setNewUnreadyCmd: (v: string) => void;
  addReadyCommand: () => void;
  removeReadyCommand: (cmd: string) => void;
  addUnreadyCommand: () => void;
  removeUnreadyCommand: (cmd: string) => void;
  handleSave: () => Promise<void>;
  isSaving: boolean;
  saveStatus: 'idle' | 'success' | 'error';
  theme: TournamentTheme;
  tournament: TournamentConfig | null;
  // Whitelist
  whitelist: LobbyWhitelistEntry[];
  isLoadingWhitelist: boolean;
  newWhitelistUrl: string;
  setNewWhitelistUrl: (v: string) => void;
  newWhitelistNote: string;
  setNewWhitelistNote: (v: string) => void;
  isAddingWhitelist: boolean;
  whitelistError: string | null;
  onAddToWhitelist: () => Promise<void>;
  removingWhitelistId: string | null;
  onRemoveFromWhitelist: (steamId32: string) => Promise<void>;
}

function SettingsView({
  config,
  setConfig,
  updateLobby,
  updateReadyCheck,
  updateChat,
  updatePostMatch,
  updateEnforcement,
  newReadyCmd,
  setNewReadyCmd,
  newUnreadyCmd,
  setNewUnreadyCmd,
  addReadyCommand,
  removeReadyCommand,
  addUnreadyCommand,
  removeUnreadyCommand,
  handleSave,
  isSaving,
  saveStatus,
  theme,
  whitelist,
  isLoadingWhitelist,
  newWhitelistUrl,
  setNewWhitelistUrl,
  newWhitelistNote,
  setNewWhitelistNote,
  isAddingWhitelist,
  whitelistError,
  onAddToWhitelist,
  removingWhitelistId,
  onRemoveFromWhitelist,
}: SettingsViewProps): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* Enable/Disable Bot */}
      <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" style={{ color: theme.primaryColor }} />
              <CardTitle className="text-lg">Status Bota</CardTitle>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(checked) =>
                setConfig((prev) => ({ ...prev, enabled: checked }))
              }
            />
          </div>
          <CardDescription>
            {config.enabled
              ? 'Bot jest włączony — automatycznie tworzy lobby dla zaplanowanych meczy.'
              : 'Bot jest wyłączony — mecze muszą być tworzone ręcznie przez kapitanów.'}
          </CardDescription>
        </CardHeader>
      </Card>

      {config.enabled && (
        <>
          {/* Lobby Settings */}
          <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Gamepad2 className="h-5 w-5" style={{ color: theme.primaryColor }} />
                <CardTitle className="text-lg">Ustawienia Lobby</CardTitle>
              </div>
              <CardDescription>
                Konfiguracja lobby Dota 2 tworzonych przez bota.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Game Mode */}
                <div className="space-y-2">
                  <Label>Tryb gry</Label>
                  <Select
                    value={config.lobby.gameMode}
                    onValueChange={(v) => updateLobby('gameMode', v as DotaGameMode)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(GAME_MODE_LABELS) as [DotaGameMode, string][]).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Server Region */}
                <div className="space-y-2">
                  <Label>Serwer</Label>
                  <Select
                    value={config.lobby.serverRegion}
                    onValueChange={(v) => updateLobby('serverRegion', v as DotaServerRegion)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(SERVER_REGION_LABELS) as [DotaServerRegion, string][]).map(
                        ([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Visibility */}
                <div className="space-y-2">
                  <Label>Widoczność</Label>
                  <Select
                    value={config.lobby.visibility}
                    onValueChange={(v) => updateLobby('visibility', v as DotaLobbyVisibility)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Publiczna</SelectItem>
                      <SelectItem value="friends_only">Tylko znajomi</SelectItem>
                      <SelectItem value="unlisted">Ukryta (niewidoczna na liście)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Pause Setting */}
                <div className="space-y-2">
                  <Label>Pauzy</Label>
                  <Select
                    value={config.lobby.pauseSetting}
                    onValueChange={(v) => updateLobby('pauseSetting', v as DotaPauseSetting)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unlimited">Bez limitu</SelectItem>
                      <SelectItem value="limited">Ograniczone</SelectItem>
                      <SelectItem value="disabled">Wyłączone</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* DotaTV Delay */}
                <div className="space-y-2">
                  <Label>DotaTV Opóźnienie (sekundy)</Label>
                  <Select
                    value={String(config.lobby.dotaTvDelay)}
                    onValueChange={(v) => updateLobby('dotaTvDelay', parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Brak opóźnienia</SelectItem>
                      <SelectItem value="120">2 minuty</SelectItem>
                      <SelectItem value="300">5 minut</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Series Type */}
                <div className="space-y-2">
                  <Label>Typ serii</Label>
                  <Select
                    value={String(config.lobby.seriesType)}
                    onValueChange={(v) => updateLobby('seriesType', parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Brak (pojedynczy mecz)</SelectItem>
                      <SelectItem value="1">BO3</SelectItem>
                      <SelectItem value="2">BO5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* League ID */}
                <div className="space-y-2">
                  <Label>League ID (Valve)</Label>
                  <Input
                    type="number"
                    value={config.lobby.leagueId || ''}
                    onChange={(e) =>
                      updateLobby('leagueId', e.target.value ? parseInt(e.target.value) : undefined)
                    }
                    placeholder="np. 19206"
                  />
                  <p className="text-xs text-muted-foreground">
                    Opcjonalnie — przypisuje lobby do ligi Valve (dla DotaTV ticket).
                  </p>
                </div>

                {/* Lead time */}
                <div className="space-y-2">
                  <Label>Tworzenie lobby (min. przed meczem)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={config.lobbyCreationLeadMinutes}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        lobbyCreationLeadMinutes: parseInt(e.target.value) || 10,
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Ile minut przed zaplanowanym meczem bot tworzy lobby.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Toggle options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Pozwól na obserwatorów</Label>
                    <p className="text-xs text-muted-foreground">Spectatorzy mogą dołączyć</p>
                  </div>
                  <Switch
                    checked={config.lobby.allowSpectators}
                    onCheckedChange={(v) => updateLobby('allowSpectators', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Cheaty</Label>
                    <p className="text-xs text-muted-foreground">Włącz komendy cheatów</p>
                  </div>
                  <Switch
                    checked={config.lobby.cheatsEnabled}
                    onCheckedChange={(v) => updateLobby('cheatsEnabled', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Wypełnij botami</Label>
                    <p className="text-xs text-muted-foreground">Puste sloty wypełnione AI</p>
                  </div>
                  <Switch
                    checked={config.lobby.fillWithBots}
                    onCheckedChange={(v) => updateLobby('fillWithBots', v)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ready Check Configuration */}
          <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" style={{ color: theme.primaryColor }} />
                <CardTitle className="text-lg">Gotowość drużyn</CardTitle>
              </div>
              <CardDescription>
                Komendy na czacie lobby, którymi drużyny deklarują gotowość do gry.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Ready Commands */}
              <div className="space-y-2">
                <Label>Komendy &quot;gotowy&quot;</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {config.readyCheck.readyCommands.map((cmd) => (
                    <Badge
                      key={cmd}
                      variant="secondary"
                      className="flex items-center gap-1 px-3 py-1"
                    >
                      <span className="font-mono">{cmd}</span>
                      <button
                        onClick={() => removeReadyCommand(cmd)}
                        className="ml-1 hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newReadyCmd}
                    onChange={(e) => setNewReadyCmd(e.target.value)}
                    placeholder="np. !ready"
                    onKeyDown={(e) => e.key === 'Enter' && addReadyCommand()}
                    className="max-w-xs"
                  />
                  <Button variant="outline" size="sm" onClick={addReadyCommand}>
                    <Plus className="h-4 w-4 mr-1" />
                    Dodaj
                  </Button>
                </div>
              </div>

              {/* Unready Commands */}
              <div className="space-y-2">
                <Label>Komendy &quot;niegotowy&quot;</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {config.readyCheck.unreadyCommands.map((cmd) => (
                    <Badge
                      key={cmd}
                      variant="secondary"
                      className="flex items-center gap-1 px-3 py-1"
                    >
                      <span className="font-mono">{cmd}</span>
                      <button
                        onClick={() => removeUnreadyCommand(cmd)}
                        className="ml-1 hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newUnreadyCmd}
                    onChange={(e) => setNewUnreadyCmd(e.target.value)}
                    placeholder="np. !unready"
                    onKeyDown={(e) => e.key === 'Enter' && addUnreadyCommand()}
                    className="max-w-xs"
                  />
                  <Button variant="outline" size="sm" onClick={addUnreadyCommand}>
                    <Plus className="h-4 w-4 mr-1" />
                    Dodaj
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Tylko kapitan</Label>
                    <p className="text-xs text-muted-foreground">
                      Tylko kapitan drużyny może zadeklarować gotowość
                    </p>
                  </div>
                  <Switch
                    checked={config.readyCheck.captainOnly}
                    onCheckedChange={(v) => updateReadyCheck('captainOnly', v)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Timeout (minuty)</Label>
                  <Input
                    type="number"
                    min={5}
                    max={120}
                    value={config.readyCheck.timeoutMinutes}
                    onChange={(e) =>
                      updateReadyCheck('timeoutMinutes', parseInt(e.target.value) || 30)
                    }
                    className="max-w-[120px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Czas oczekiwania na gotowość obu drużyn
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Chat Messages */}
          <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" style={{ color: theme.primaryColor }} />
                <CardTitle className="text-lg">Wiadomości na czacie</CardTitle>
              </div>
              <CardDescription>
                Wiadomości wysyłane przez bota na czacie lobby. Użyj {'{radiant_team}'} i {'{dire_team}'} jako
                placeholderów nazw drużyn.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Wiadomość powitalna</Label>
                <Textarea
                  value={config.chatMessages.welcomeMessage}
                  onChange={(e) => updateChat('welcomeMessage', e.target.value)}
                  rows={2}
                  placeholder="Witajcie w lobby! Zajmijcie sloty swoich drużyn."
                />
              </div>

              <div className="space-y-2">
                <Label>Przypisanie drużyn do stron</Label>
                <Textarea
                  value={config.chatMessages.teamAssignmentMessage}
                  onChange={(e) => updateChat('teamAssignmentMessage', e.target.value)}
                  rows={2}
                  placeholder="RADIANT: {radiant_team} | DIRE: {dire_team}"
                />
                <p className="text-xs text-muted-foreground">
                  Dostępne placeholdery: {'{radiant_team}'}, {'{dire_team}'}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Obie drużyny gotowe</Label>
                <Textarea
                  value={config.chatMessages.allReadyMessage}
                  onChange={(e) => updateChat('allReadyMessage', e.target.value)}
                  rows={2}
                  placeholder="Obie drużyny gotowe! Sprawdzam wymagania..."
                />
              </div>

              <div className="space-y-2">
                <Label>Prefix błędów walidacji</Label>
                <Input
                  value={config.chatMessages.requirementsNotMetPrefix}
                  onChange={(e) => updateChat('requirementsNotMetPrefix', e.target.value)}
                  placeholder="Nie można wystartować - znalezione problemy:"
                />
              </div>

              <div className="space-y-2">
                <Label>Przypomnienie regulaminu (opcjonalne)</Label>
                <Textarea
                  value={config.chatMessages.rulesReminder || ''}
                  onChange={(e) => updateChat('rulesReminder', e.target.value)}
                  rows={2}
                  placeholder="Przypominamy o zasadach: ..."
                />
              </div>

              <div className="space-y-2">
                <Label>Start meczu</Label>
                <Textarea
                  value={config.chatMessages.matchStartMessage || ''}
                  onChange={(e) => updateChat('matchStartMessage', e.target.value)}
                  rows={2}
                  placeholder="Wszystko gotowe! Startujemy mecz. Powodzenia!"
                />
              </div>
            </CardContent>
          </Card>

          {/* Post-Match Settings */}
          <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5" style={{ color: theme.primaryColor }} />
                <CardTitle className="text-lg">Po meczu</CardTitle>
              </div>
              <CardDescription>
                Zachowanie bota po zakończeniu meczu.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Automatyczna synchronizacja</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatycznie importuj wyniki meczu po zakończeniu gry
                  </p>
                </div>
                <Switch
                  checked={config.postMatch.autoSyncEnabled}
                  onCheckedChange={(v) => updatePostMatch('autoSyncEnabled', v)}
                />
              </div>

              <div className="space-y-2">
                <Label>Opóźnienie synchronizacji (minuty)</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={config.postMatch.syncDelayMinutes}
                  onChange={(e) =>
                    updatePostMatch('syncDelayMinutes', parseInt(e.target.value) || 5)
                  }
                  className="max-w-[120px]"
                />
                <p className="text-xs text-muted-foreground">
                  Czas oczekiwania po zakończeniu meczu przed importem danych (potrzebne na przetworzenie replaya).
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Podsumowanie po grze</Label>
                  <p className="text-xs text-muted-foreground">
                    Bot wyśle podsumowanie wyniku na czacie lobby
                  </p>
                </div>
                <Switch
                  checked={config.postMatch.postGameSummary}
                  onCheckedChange={(v) => updatePostMatch('postGameSummary', v)}
                />
              </div>

              {/* Timeout phases */}
              <Separator />
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-semibold">Fazy zamknięcia lobby</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Bot sprawdza te progi co cykl orkiestratora. Czasy lobby_open liczone od momentu otwarcia lobby, nie od zaplanowania sesji.
                  </p>
                </div>

                {/* Pending timeout */}
                <div className="grid grid-cols-[1fr_auto] gap-4 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Oczekiwanie na bota (min)</Label>
                    <p className="text-xs text-muted-foreground">
                      Jeśli żaden bot nie zostanie przypisany w tym czasie, sesja zostanie anulowana.
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={5}
                    max={60}
                    value={config.pendingSessionTimeoutMinutes ?? 20}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        pendingSessionTimeoutMinutes: parseInt(e.target.value) || 20,
                      }))
                    }
                    className="w-20"
                  />
                </div>

                {/* Bot assigned timeout */}
                <div className="grid grid-cols-[1fr_auto] gap-4 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Tworzenie lobby (min)</Label>
                    <p className="text-xs text-muted-foreground">
                      Jeśli bot nie otworzy lobby w tym czasie po przypisaniu, sesja zostanie anulowana.
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={1}
                    max={15}
                    value={config.botAssignedTimeoutMinutes ?? 5}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        botAssignedTimeoutMinutes: parseInt(e.target.value) || 5,
                      }))
                    }
                    className="w-20"
                  />
                </div>

                {/* Lobby open warning */}
                <div className="grid grid-cols-[1fr_auto] gap-4 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Ostrzeżenie o braku graczy (min)</Label>
                    <p className="text-xs text-muted-foreground">
                      Po tylu minutach od otwarcia lobby bot wyśle ostrzeżenie, jeśli nie wszyscy gracze dołączyli. Ustaw 0 aby wyłączyć.
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={60}
                    value={config.lobbyOpenWarningMinutes ?? 15}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        lobbyOpenWarningMinutes: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="w-20"
                  />
                </div>

                {/* Lobby open close */}
                <div className="grid grid-cols-[1fr_auto] gap-4 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Zamknięcie po no-show (min)</Label>
                    <p className="text-xs text-muted-foreground">
                      Po tylu minutach od otwarcia lobby bot zamknie lobbyi i powiadomi administrację, jeśli gracze nie dołączyli.
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={10}
                    max={120}
                    value={config.lobbyOpenTimeoutMinutes ?? 30}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        lobbyOpenTimeoutMinutes: parseInt(e.target.value) || 30,
                      }))
                    }
                    className="w-20"
                  />
                </div>

                {/* Ready check stuck timeout */}
                <div className="grid grid-cols-[1fr_auto] gap-4 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Zacięty ready check (min)</Label>
                    <p className="text-xs text-muted-foreground">
                      Jeśli obie drużyny potwierdziły gotowość, ale mecz nie ruszył w tym czasie, lobby zostanie anulowane.
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={2}
                    max={30}
                    value={config.readyCheckTimeoutMinutes ?? 10}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        readyCheckTimeoutMinutes: parseInt(e.target.value) || 10,
                      }))
                    }
                    className="w-20"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enforcement & Security Settings */}
          <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" style={{ color: theme.primaryColor }} />
                <CardTitle className="text-lg">Bezpieczeństwo i egzekwowanie</CardTitle>
              </div>
              <CardDescription>
                Automatyczne usuwanie nieautoryzowanych graczy i wymuszanie poprawnych slotów.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Auto-kick unauthorized */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Automatyczne usuwanie nieautoryzowanych</Label>
                  <p className="text-xs text-muted-foreground">
                    Bot automatycznie usunie graczy, którzy nie są zarejestrowani na ten mecz
                  </p>
                </div>
                <Switch
                  checked={config.enforcement.autoKickUnauthorized}
                  onCheckedChange={(v) => updateEnforcement('autoKickUnauthorized', v)}
                />
              </div>

              {/* Auto-kick wrong slot */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Automatyczne usuwanie z błędnego slotu</Label>
                  <p className="text-xs text-muted-foreground">
                    Usunie graczy, którzy siedzą w slocie nie swojej drużyny (po uprzednim ostrzeżeniu)
                  </p>
                </div>
                <Switch
                  checked={config.enforcement.autoKickWrongSlot}
                  onCheckedChange={(v) => updateEnforcement('autoKickWrongSlot', v)}
                />
              </div>

              {/* Wrong slot grace period */}
              {config.enforcement.autoKickWrongSlot && (
                <div className="space-y-2 pl-4 border-l-2" style={{ borderColor: theme.primaryColor }}>
                  <Label>Czas na zmianę slotu (sekundy)</Label>
                  <Input
                    type="number"
                    min={10}
                    max={120}
                    value={config.enforcement.wrongSlotGracePeriodSeconds}
                    onChange={(e) =>
                      updateEnforcement('wrongSlotGracePeriodSeconds', parseInt(e.target.value) || 30)
                    }
                    className="max-w-[120px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Po tym czasie gracz zostanie usunięty i zaproszony ponownie.
                  </p>
                </div>
              )}

              <Separator />

              {/* Ready cooldown */}
              <div className="space-y-2">
                <Label>Cooldown komendy gotowości (sekundy)</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={config.enforcement.readyCooldownSeconds}
                  onChange={(e) =>
                    updateEnforcement('readyCooldownSeconds', parseInt(e.target.value) || 5)
                  }
                  className="max-w-[120px]"
                />
                <p className="text-xs text-muted-foreground">
                  Minimalna przerwa między komendami !ready / !unready dla jednego gracza.
                </p>
              </div>

              <Separator />

              {/* Password visible to players */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Hasło widoczne dla graczy</Label>
                  <p className="text-xs text-muted-foreground">
                    Gracze zobaczą hasło lobby na stronie meczu
                  </p>
                </div>
                <Switch
                  checked={config.passwordVisibleToPlayers ?? true}
                  onCheckedChange={(v) =>
                    setConfig((prev) => ({ ...prev, passwordVisibleToPlayers: v }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Lobby Whitelist — always visible regardless of bot enabled state */}
      <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" style={{ color: theme.primaryColor }} />
            <CardTitle className="text-lg">Whitelist lobby</CardTitle>
          </div>
          <CardDescription>
            Konta Steam, które zawsze mogą dołączyć do lobby bez bycia wykopanymi — np. komentatorzy, obserwatorzy, administratorzy.
            Dodaj link do profilu Steam, a system pobierze dane konta automatycznie.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add entry form */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="https://steamcommunity.com/id/nazwagracza lub /profiles/76561198..."
                value={newWhitelistUrl}
                onChange={(e) => setNewWhitelistUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isAddingWhitelist) {
                    void onAddToWhitelist();
                  }
                }}
                className="flex-1"
              />
              <Input
                placeholder="Notatka (opcjonalnie)"
                value={newWhitelistNote}
                onChange={(e) => setNewWhitelistNote(e.target.value)}
                className="w-48"
              />
              <Button
                onClick={onAddToWhitelist}
                disabled={isAddingWhitelist || !newWhitelistUrl.trim()}
                style={{ backgroundColor: theme.primaryColor }}
              >
                {isAddingWhitelist ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
            {whitelistError && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {whitelistError}
              </p>
            )}
          </div>

          <Separator />

          {/* Whitelist entries */}
          {isLoadingWhitelist ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Ładowanie...
            </div>
          ) : whitelist.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              Brak kont na whiteliście. Dodaj link do profilu Steam powyżej.
            </p>
          ) : (
            <div className="space-y-2">
              {whitelist.map((entry) => (
                <div
                  key={entry.steamId32}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/40"
                >
                  {entry.avatarUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={entry.avatarUrl}
                      alt={entry.displayName}
                      className="w-8 h-8 rounded"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{entry.displayName}</span>
                      {entry.note && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {entry.note}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Steam32: {entry.steamId32}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                    disabled={removingWhitelistId === entry.steamId32}
                    onClick={() => void onRemoveFromWhitelist(entry.steamId32)}
                  >
                    {removingWhitelistId === entry.steamId32 ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="min-w-[140px]"
          style={{ backgroundColor: theme.primaryColor }}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Zapisywanie...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Zapisz ustawienia
            </>
          )}
        </Button>
        {saveStatus === 'success' && (
          <div className="flex items-center gap-1 text-green-500 text-sm">
            <CheckCircle2 className="h-4 w-4" />
            Zapisano pomyślnie
          </div>
        )}
        {saveStatus === 'error' && (
          <div className="flex items-center gap-1 text-red-500 text-sm">
            <AlertCircle className="h-4 w-4" />
            Błąd podczas zapisywania
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Monitor View ───────────────────────────────────────────────────────────

interface MonitorViewProps {
  activeSessions: LobbySession[];
  poolStatus: {
    total: number;
    idle: number;
    active: number;
    offline: number;
    error: number;
    pendingSessions: number;
    activeSessions: number;
  } | null;
  onRefresh: () => void;
  theme: TournamentTheme;
  testMatchId: string;
  setTestMatchId: (v: string) => void;
  isForcing: boolean;
  forceResult: { ok: boolean; message: string } | null;
  onForceCreate: () => Promise<void>;
  isOrchestrating: boolean;
  orchestrateResult: { ok: boolean; message: string } | null;
  onOrchestrate: () => Promise<void>;
}

function MonitorView({
  activeSessions,
  poolStatus,
  onRefresh,
  theme,
  testMatchId,
  setTestMatchId,
  isForcing,
  forceResult,
  onForceCreate,
  isOrchestrating,
  orchestrateResult,
  onOrchestrate,
}: MonitorViewProps): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* Bot Pool Status */}
      {poolStatus && (
        <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5" style={{ color: theme.primaryColor }} />
                <CardTitle className="text-lg">Pula Botów</CardTitle>
              </div>
              <Button variant="outline" size="sm" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Odśwież
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatusCard
                label="Łącznie botów"
                value={poolStatus.total}
                icon={<Bot className="h-5 w-5" />}
                color={theme.primaryColor}
              />
              <StatusCard
                label="Dostępne"
                value={poolStatus.idle}
                icon={<Wifi className="h-5 w-5" />}
                color="#22c55e"
              />
              <StatusCard
                label="Aktywne"
                value={poolStatus.active}
                icon={<Activity className="h-5 w-5" />}
                color="#eab308"
              />
              <StatusCard
                label="Offline / Błąd"
                value={poolStatus.offline + poolStatus.error}
                icon={<WifiOff className="h-5 w-5" />}
                color="#ef4444"
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <StatusCard
                label="Oczekujące sesje"
                value={poolStatus.pendingSessions}
                icon={<Clock className="h-5 w-5" />}
                color="#a855f7"
              />
              <StatusCard
                label="Aktywne sesje"
                value={poolStatus.activeSessions}
                icon={<Gamepad2 className="h-5 w-5" />}
                color="#06b6d4"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual test controls */}
      <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Play className="h-5 w-5" style={{ color: theme.primaryColor }} />
            <CardTitle className="text-lg">Ręczny test bota</CardTitle>
          </div>
          <CardDescription>
            Wymuś stworzenie sesji lobby dla konkretnego meczu i uruchom orkiestrator ręcznie.
            Wymaga: bot włączony w Ustawieniach, konto bota ze statusem <strong>idle</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>ID meczu (Firestore document ID)</Label>
            <div className="flex gap-2">
              <Input
                value={testMatchId}
                onChange={(e) => setTestMatchId(e.target.value)}
                placeholder="np. ABC123xyz"
                className="font-mono"
                onKeyDown={(e) => e.key === 'Enter' && testMatchId.trim() && onForceCreate()}
              />
              <Button
                onClick={onForceCreate}
                disabled={isForcing || !testMatchId.trim()}
                style={{ backgroundColor: theme.primaryColor }}
              >
                {isForcing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-1" />
                    Utwórz sesję
                  </>
                )}
              </Button>
            </div>
            {forceResult && (
              <div className={cn(
                'flex items-start gap-2 rounded-lg p-3 text-sm',
                forceResult.ok ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'
              )}>
                {forceResult.ok
                  ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                {forceResult.message}
              </div>
            )}
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Uruchom orkiestrator</p>
              <p className="text-xs text-muted-foreground">
                Przypisuje boty do oczekujących sesji i przetwarza zdarzenia. Normalnie wywoływane co kilka minut.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={onOrchestrate}
              disabled={isOrchestrating}
            >
              {isOrchestrating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Play className="h-4 w-4 mr-1" />
              )}
              Uruchom
            </Button>
          </div>
          {orchestrateResult && (
            <div className={cn(
              'flex items-start gap-2 rounded-lg p-3 text-sm',
              orchestrateResult.ok ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'
            )}>
              {orchestrateResult.ok
                ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
              {orchestrateResult.message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5" style={{ color: theme.primaryColor }} />
            <CardTitle className="text-lg">Aktywne sesje lobby</CardTitle>
          </div>
          <CardDescription>
            Bieżące sesje zarządzane przez boty.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeSessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Brak aktywnych sesji lobby.</p>
              <p className="text-sm mt-1">Sesje pojawią się automatycznie przed zaplanowanymi meczami.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeSessions.map((session) => (
                <SessionCard key={session.id} session={session} theme={theme} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Accounts View ─────────────────────────────────────────────────────────

const BOT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  idle:          { label: 'Dostępny',    color: '#22c55e' },
  starting:      { label: 'Uruchamianie',color: '#3b82f6' },
  connecting:    { label: 'Łączenie',    color: '#3b82f6' },
  creating_lobby:{ label: 'Tworzy lobby',color: '#eab308' },
  lobby_active:  { label: 'W lobby',     color: '#eab308' },
  ready_check:   { label: 'Ready check', color: '#eab308' },
  in_game:       { label: 'W grze',      color: '#ef4444' },
  post_game:     { label: 'Po grze',     color: '#f97316' },
  syncing:       { label: 'Sync',        color: '#a855f7' },
  error:         { label: 'Błąd',        color: '#ef4444' },
  offline:       { label: 'Offline',     color: '#6b7280' },
};

interface AccountsViewProps {
  accounts: SafeBotAccount[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  showAddDialog: boolean;
  setShowAddDialog: (v: boolean) => void;
  newUsername: string;
  setNewUsername: (v: string) => void;
  newPassword: string;
  setNewPassword: (v: string) => void;
  newDisplayName: string;
  setNewDisplayName: (v: string) => void;
  showNewPassword: boolean;
  setShowNewPassword: (v: boolean) => void;
  addError: string | null;
  isAdding: boolean;
  onAdd: () => Promise<void>;
  togglingId: string | null;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
  deletingId: string | null;
  onDelete: (id: string) => Promise<void>;
  theme: TournamentTheme;
}

function AccountsView({
  accounts,
  isLoading,
  onRefresh,
  showAddDialog,
  setShowAddDialog,
  newUsername,
  setNewUsername,
  newPassword,
  setNewPassword,
  newDisplayName,
  setNewDisplayName,
  showNewPassword,
  setShowNewPassword,
  addError,
  isAdding,
  onAdd,
  togglingId,
  onToggle,
  deletingId,
  onDelete,
  theme,
}: AccountsViewProps): React.ReactElement {
  const canAdd = newUsername.trim() && newPassword.trim() && newDisplayName.trim();

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" style={{ color: theme.primaryColor }} />
            <CardTitle className="text-lg">Konta Steam Botów</CardTitle>
          </div>
          <CardDescription>
            Konta Steam używane przez boty do tworzenia lobby. Hasła są przechowywane
            zaszyfrowane w bazie danych i nigdy nie są ujawniane. Po dodaniu konta uruchom
            proces bota z parametrem <code className="font-mono text-xs bg-muted px-1 rounded">--bot-id=&lt;id&gt;</code>.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Accounts list */}
      <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" style={{ color: theme.primaryColor }} />
              <CardTitle className="text-lg">Zarejestrowane konta</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
                <RefreshCw className={cn('h-4 w-4 mr-1', isLoading && 'animate-spin')} />
                Odśwież
              </Button>
              <Button
                size="sm"
                onClick={() => setShowAddDialog(true)}
                style={{ backgroundColor: theme.primaryColor }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Dodaj konto
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Brak zarejestrowanych kont botów.</p>
              <p className="text-sm mt-1">
                Kliknij &ldquo;Dodaj konto&rdquo;, aby zarejestrować pierwsze konto Steam.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => {
                const statusInfo = BOT_STATUS_LABELS[account.status] ?? { label: account.status, color: '#6b7280' };
                const isToggling = togglingId === account.id;
                const isDeleting = deletingId === account.id;
                const isBusy = isToggling || isDeleting;

                return (
                  <div
                    key={account.id}
                    className={cn(
                      'rounded-xl border bg-background/50 p-4 flex items-center justify-between gap-4',
                      !account.enabled && 'opacity-60'
                    )}
                  >
                    {/* Info */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${theme.primaryColor}20` }}
                      >
                        <Bot className="h-4 w-4" style={{ color: theme.primaryColor }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{account.displayName}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          {account.username}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge
                            style={{
                              backgroundColor: `${statusInfo.color}20`,
                              color: statusInfo.color,
                            }}
                            className="border-0 text-xs"
                          >
                            {statusInfo.label}
                          </Badge>
                          {account.lastHeartbeat && (
                            <span className="text-xs text-muted-foreground">
                              Ostatni ping:{' '}
                              {new Date(account.lastHeartbeat).toLocaleString('pl-PL', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground font-mono select-all">
                            ID: {account.id}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Enable/disable toggle */}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => onToggle(account.id, !account.enabled)}
                        title={account.enabled ? 'Wyłącz konto' : 'Włącz konto'}
                      >
                        {isToggling ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Power
                            className="h-4 w-4"
                            style={{ color: account.enabled ? '#22c55e' : '#6b7280' }}
                          />
                        )}
                      </Button>

                      {/* Delete */}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isBusy || account.status !== 'offline' && account.status !== 'idle' && account.status !== 'error'}
                        onClick={() => onDelete(account.id)}
                        title="Usuń konto"
                        className="text-destructive hover:text-destructive"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add account dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj konto Steam bota</DialogTitle>
            <DialogDescription>
              Podaj dane logowania do konta Steam. Upewnij się, że Steam Guard jest wyłączony
              na tym koncie. Hasło zostanie zaszyfrowane i zapisane w bazie.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nazwa wyświetlana</Label>
              <Input
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="np. Bot #1"
              />
            </div>
            <div className="space-y-2">
              <Label>Login Steam</Label>
              <Input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="nazwa_konta_steam"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>Hasło Steam</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  onKeyDown={(e) => e.key === 'Enter' && canAdd && onAdd()}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Hasło jest kodowane base64 i przechowywane w Firestore. Nigdy nie jest
                zwracane do przeglądarki.
              </p>
            </div>
          </div>

          {addError && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {addError}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
              disabled={isAdding}
            >
              Anuluj
            </Button>
            <Button
              onClick={onAdd}
              disabled={isAdding || !canAdd}
              style={{ backgroundColor: theme.primaryColor }}
            >
              {isAdding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Dodawanie...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Dodaj konto
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Helper Components ──────────────────────────────────────────────────────

function StatusCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}): React.ReactElement {
  return (
    <div className="rounded-xl border bg-background/50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div style={{ color }}>{icon}</div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

const STATE_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Oczekuje', color: '#a855f7' },
  bot_assigned: { label: 'Bot przypisany', color: '#3b82f6' },
  lobby_creating: { label: 'Tworzenie lobby', color: '#3b82f6' },
  lobby_open: { label: 'Lobby otwarte', color: '#22c55e' },
  ready_check: { label: 'Sprawdzanie gotowości', color: '#eab308' },
  requirements_met: { label: 'Wymagania spełnione', color: '#22c55e' },
  coin_toss: { label: 'Coin toss', color: '#06b6d4' },
  in_game: { label: 'W grze', color: '#ef4444' },
  post_game: { label: 'Po grze', color: '#f97316' },
  syncing: { label: 'Synchronizacja', color: '#a855f7' },
  completed: { label: 'Zakończone', color: '#6b7280' },
  cancelled: { label: 'Anulowane', color: '#6b7280' },
  error: { label: 'Błąd', color: '#ef4444' },
};

function SessionCard({
  session,
  theme,
}: {
  session: LobbySession;
  theme: TournamentTheme;
}): React.ReactElement {
  const stateInfo = STATE_LABELS[session.state] || { label: session.state, color: '#6b7280' };

  return (
    <div className="rounded-xl border bg-background/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-semibold">{session.lobbyName}</p>
          <p className="text-xs text-muted-foreground">
            Gra {session.currentGameNumber} z {session.totalGames}
          </p>
        </div>
        <Badge
          style={{ backgroundColor: `${stateInfo.color}20`, color: stateInfo.color }}
          className="border-0"
        >
          {stateInfo.label}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground text-xs">Radiant</p>
          <p className="font-medium">{session.radiantTeam.teamName}</p>
          <div className="flex items-center gap-1 mt-1">
            {session.readyState.radiantReady ? (
              <Badge variant="outline" className="text-green-500 border-green-500/30 text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Gotowy
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground text-xs">
                Oczekuje
              </Badge>
            )}
          </div>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Dire</p>
          <p className="font-medium">{session.direTeam.teamName}</p>
          <div className="flex items-center gap-1 mt-1">
            {session.readyState.direReady ? (
              <Badge variant="outline" className="text-green-500 border-green-500/30 text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Gotowy
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground text-xs">
                Oczekuje
              </Badge>
            )}
          </div>
        </div>
      </div>

      {session.validationErrors.length > 0 && (
        <div className="mt-3 p-2 rounded-lg bg-red-500/10">
          <p className="text-xs font-medium text-red-500 mb-1">Problemy:</p>
          {session.validationErrors.map((err, i) => (
            <p key={i} className="text-xs text-red-400">
              • {err}
            </p>
          ))}
        </div>
      )}

      {session.error && (
        <div className="mt-3 p-2 rounded-lg bg-red-500/10">
          <p className="text-xs font-medium text-red-500">Błąd: {session.error.message}</p>
        </div>
      )}
    </div>
  );
}
