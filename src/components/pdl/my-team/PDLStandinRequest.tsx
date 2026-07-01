'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEffect } from 'react';
import {
  UserPlus,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  Gavel,
  ExternalLink,
  ShieldAlert,
  Plus,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Player, PDLStandinRequest as PDLStandinRequestType, PDLStandinRequestStatus } from '@/lib/definitions';

// ─── Appeal info modal content ───
const APPEAL_RULES = [
  'Standin ma porównywalny lub niższy MMR niż gracz, którego zastępuje',
  'Standin jest osobiście znany administracji ligi',
  'Standin ma dobrą reputację w społeczności — nie jest znany z toksyczności ani problematycznego zachowania',
  'Standin nie jest zarejestrowany jako zawodnik żadnej innej drużyny w lidze',
  'Standin nie był jeszcze standinem dla tej drużyny w bieżącej rundzie',
];

interface PDLStandinRequestProps {
  matchId: string;
  myTeamId: string;
  players: Player[];
  isCaptain: boolean;
  existingRequests: PDLStandinRequestType[];
  /** Called when captain submits a new standin request */
  onSubmitRequest: (data: {
    matchId: string;
    replacedPlayerId: string;
    replacedPlayerNickname: string;
    replacedPlayerMmr?: number;
    standinNickname: string;
    standinSteamProfileUrl: string;
    standinMmr?: number;
    standinSmurfAccounts?: { steamProfileUrl: string }[];
    /** Games of the series this standin covers; omitted = whole series. */
    gameNumbers?: number[];
  }) => Promise<void>;
  /**
   * Number of games in the series (bo1=1, bo2=2, bo3=3, bo5=5). When > 1 a per-game
   * selector is shown so a standin can be requested for specific games only.
   */
  totalGames?: number;
  /** Called when opponent captain approves a standin request */
  onApproveRequest: (requestId: string) => Promise<void>;
  /** Called when opponent captain rejects a standin request */
  onRejectRequest: (requestId: string, reason?: string) => Promise<void>;
  /** Called when captain sends appeal to admin */
  onAppealRequest: (requestId: string) => Promise<void>;
  /** Called when captain cancels their own pending request */
  onCancelRequest?: (requestId: string) => Promise<void>;
  /** Whether we are the opponent approving (true) or the requesting team (false) */
  isOpponentView?: boolean;
  /**
   * When true, the match has already been completed so new standin requests
   * cannot be submitted — only existing ones can be approved / rejected.
   */
  isMatchCompleted?: boolean;
  /** When true, shows an MMR input field for standin proposals */
  isMmrLimited?: boolean;
  /**
   * All standin requests in the tournament — used to show approval history for
   * a standin replacing the same absent player across different matches.
   */  
  allTournamentRequests?: PDLStandinRequestType[];
  /** Maps match IDs to readable labels (e.g. "TeamA vs TeamB") for history display */
  matchNameMap?: Record<string, string>;
}

const statusConfig: Record<PDLStandinRequestStatus, { label: string; className: string; canPlay?: boolean; cannotPlay?: boolean; icon?: any }> = {
  pending: { label: 'Oczekuje na zgodę', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', canPlay: false },
  approved: { label: 'Zatwierdzony - może grać!', className: 'bg-green-500/20 text-green-400 border-green-500/30', canPlay: true, icon: CheckCircle },
  rejected: { label: 'Odrzucony - nie może grać', className: 'bg-red-500/20 text-red-400 border-red-500/30', canPlay: false, cannotPlay: true },
  appeal_pending: { label: 'Odwołanie u admina', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30', canPlay: false },
  appeal_approved: { label: 'Admin zatwierdził - może grać!', className: 'bg-green-500/20 text-green-400 border-green-500/30', canPlay: true, icon: CheckCircle },
  appeal_rejected: { label: 'Admin odrzucił - nie może grać', className: 'bg-red-500/20 text-red-400 border-red-500/30', canPlay: false, cannotPlay: true },
};

/**
 * Extracts steamId32 purely from a direct /profiles/STEAMID64/ URL (no API call).
 * Returns null for vanity /id/name/ URLs — those need async resolution.
 */
function extractSteamId32FromDirectUrl(url: string): string | null {
  const m = url.match(/\/profiles\/(\d{15,})/);
  if (!m) return null;
  try {
    return String(BigInt(m[1]) - 76561197960265728n);
  } catch {
    return null;
  }
}

export function PDLStandinRequestSection({
  matchId,
  myTeamId,
  players,
  isCaptain,
  existingRequests,
  onSubmitRequest,
  onApproveRequest,
  onRejectRequest,
  onAppealRequest,
  onCancelRequest,
  isOpponentView = false,
  allTournamentRequests,
  matchNameMap,
  isMmrLimited = false,
  totalGames = 1,
}: PDLStandinRequestProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAppealOpen, setIsAppealOpen] = useState(false);
  const [appealRequestId, setAppealRequestId] = useState<string | null>(null);
  const [appealConfirmed, setAppealConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState<string | null>(null);
  // Resolved steamId32 for standin requests that use vanity Steam URLs
  const [resolvedSteamId32s, setResolvedSteamId32s] = useState<Record<string, string>>({});

  // Form state
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [standinNickname, setStandinNickname] = useState('');
  const [standinSteamUrl, setStandinSteamUrl] = useState('');
  const [standinMmr, setStandinMmr] = useState('');
  const [standinSmurfUrls, setStandinSmurfUrls] = useState<string[]>([]);
  // Per-game scope: which games of the series the standin will play.
  const allGameNumbers = Array.from({ length: Math.max(1, totalGames) }, (_, i) => i + 1);

  const matchRequests = existingRequests.filter(r => r.matchId === matchId);

  // Games already covered by an existing (live) request for a given player, so we can prevent
  // two standins for the same player and the same game. Empty gameNumbers = whole series.
  const liveStatuses: PDLStandinRequestStatus[] = ['pending', 'approved', 'appeal_pending', 'appeal_approved'];
  const gamesTakenFor = (playerId: string): Set<number> => {
    const taken = new Set<number>();
    if (!playerId) return taken;
    for (const r of matchRequests) {
      if (r.replacedPlayerId !== playerId) continue;
      if (!liveStatuses.includes(r.status)) continue;
      const gns = (r.gameNumbers && r.gameNumbers.length) ? r.gameNumbers : allGameNumbers;
      for (const g of gns) taken.add(g);
    }
    return taken;
  };
  const gamesTakenForSelectedPlayer = gamesTakenFor(selectedPlayerId);

  // No games selected by default — captain must explicitly pick which games the standin plays.
  const [selectedGameNumbers, setSelectedGameNumbers] = useState<number[]>([]);

  const [submitError, setSubmitError] = useState('');

  const toggleGameNumber = (g: number) => {
    if (gamesTakenForSelectedPlayer.has(g)) return; // can't pick a game already covered
    setSubmitError('');
    setSelectedGameNumbers(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g].sort((a, b) => a - b)
    );
  };

  // True if two game-scopes overlap; empty list = whole series (overlaps everything).
  const gamesOverlap = (a: number[], b: number[]) =>
    a.length === 0 || b.length === 0 || a.some((g) => b.includes(g));
  const normalizeUrl = (u: string) => u.trim().toLowerCase().replace(/\/+$/, '');

  // For each opponent pending request, resolve its steamId32 via API if it's a vanity URL
  useEffect(() => {
    if (!isOpponentView) return;
    const pending = matchRequests.filter(r => r.status === 'pending');
    for (const req of pending) {
      if (resolvedSteamId32s[req.id]) continue; // already resolved
      const fromUrl = extractSteamId32FromDirectUrl(req.standinSteamProfileUrl);
      if (fromUrl) {
        // Direct URL — no API call needed, populate instantly
        setResolvedSteamId32s(prev => ({ ...prev, [req.id]: fromUrl }));
      } else if (req.standinSteamProfileUrl) {
        // Vanity URL — resolve via validate-steam endpoint
        fetch('/api/validate-steam', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ steamProfileUrl: req.standinSteamProfileUrl }),
        })
          .then(r => r.json())
          .then(data => {
            if (data.steamId32) {
              setResolvedSteamId32s(prev => ({ ...prev, [req.id]: data.steamId32 }));
            }
          })
          .catch(() => { /* silently ignore — links just won't show */ });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchRequests, isOpponentView]);

  const handleSubmit = async () => {
    if (!selectedPlayerId || !standinNickname.trim() || !standinSteamUrl.trim()) return;
    if (isMmrLimited && !standinMmr.trim()) return;
    if (totalGames > 1 && selectedGameNumbers.length === 0) return;

    const player = players.find(p => p.id === selectedPlayerId);
    if (!player) return;

    const filteredSmurfs = standinSmurfUrls.filter(u => u.trim());

    // Only send gameNumbers when it's a proper subset; a full selection = whole series (omit).
    const sortedGames = [...selectedGameNumbers].sort((a, b) => a - b);
    const gameNumbers = totalGames > 1 && sortedGames.length < totalGames ? sortedGames : undefined;

    // A single standin can't fill two slots: block proposing this person (same Steam URL) for
    // a DIFFERENT player in overlapping games. (Server re-checks by resolved steamId32.)
    const newGames = gameNumbers ?? allGameNumbers;
    const sameStandinOtherPlayer = matchRequests.find((r) =>
      liveStatuses.includes(r.status) &&
      r.replacedPlayerId !== selectedPlayerId &&
      normalizeUrl(r.standinSteamProfileUrl) === normalizeUrl(standinSteamUrl) &&
      gamesOverlap((r.gameNumbers && r.gameNumbers.length) ? r.gameNumbers : allGameNumbers, newGames)
    );
    if (sameStandinOtherPlayer) {
      setSubmitError(`Ten standin jest już zgłoszony za innego gracza (${sameStandinOtherPlayer.replacedPlayerNickname}) w tych grach.`);
      return;
    }
    setSubmitError('');

    setLoading(true);
    try {
      await onSubmitRequest({
        matchId,
        replacedPlayerId: selectedPlayerId,
        replacedPlayerNickname: player.nickname,
        replacedPlayerMmr: isMmrLimited ? player.mmr : undefined,
        standinNickname: standinNickname.trim(),
        standinSteamProfileUrl: standinSteamUrl.trim(),
        standinMmr: standinMmr.trim() ? Number(standinMmr.trim()) : undefined,
        standinSmurfAccounts: filteredSmurfs.length > 0 ? filteredSmurfs.map(u => ({ steamProfileUrl: u.trim() })) : undefined,
        gameNumbers,
      });
      setIsOpen(false);
      setSelectedPlayerId('');
      setStandinNickname('');
      setStandinSteamUrl('');
      setStandinMmr('');
      setStandinSmurfUrls([]);
      setSelectedGameNumbers([]);
    } catch (e) {
      // Server-side validation (e.g. standin already plays in this match) rejected it —
      // keep the dialog open and show why.
      setSubmitError((e as Error)?.message || 'Nie udało się zgłosić standina.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    setLoading(true);
    try {
      await onApproveRequest(requestId);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (requestId: string) => {
    setLoading(true);
    try {
      await onRejectRequest(requestId, rejectReason || undefined);
      setShowRejectInput(null);
      setRejectReason('');
    } finally {
      setLoading(false);
    }
  };

  const handleStartAppeal = (requestId: string) => {
    setAppealRequestId(requestId);
    setAppealConfirmed(false);
    setIsAppealOpen(true);
  };

  const handleConfirmAppeal = async () => {
    if (!appealRequestId) return;
    setLoading(true);
    try {
      await onAppealRequest(appealRequestId);
      setIsAppealOpen(false);
      setAppealRequestId(null);
      setAppealConfirmed(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Existing requests */}
      {matchRequests.length > 0 && (
        <div className="space-y-3">
          {matchRequests.map((request) => {
            const config = statusConfig[request.status];
            const canApproveReject = isOpponentView && request.status === 'pending';
            const canAppeal = !isOpponentView && request.status === 'rejected';
            const isResolved = ['approved', 'appeal_approved', 'appeal_rejected'].includes(request.status);

            return (
              <div
                key={request.id}
                className={cn(
                  'rounded-lg border p-4 space-y-3',
                  config.canPlay 
                    ? 'border-green-500/30 bg-green-500/5' 
                    : config.cannotPlay 
                    ? 'border-red-500/30 bg-red-500/5'
                    : isResolved 
                    ? 'border-white/5 bg-white/[0.01]' 
                    : 'border-white/10 bg-white/[0.03]'
                )}
              >
                {/* Success banner for approved standins */}
                {config.canPlay && (
                  <div className="rounded-md bg-green-500/20 border border-green-500/40 p-3 flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-logik-extended-bold text-green-400">
                        ✓ Ten standin może grać w meczu
                      </p>
                      <p className="text-xs text-green-400/80 mt-1">
                        {request.status === 'approved' 
                          ? 'Zatwierdzony przez kapitana przeciwnika'
                          : 'Zatwierdzony przez administrację po odwołaniu'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Warning banner for rejected standins */}
                {config.cannotPlay && (
                  <div className="rounded-md bg-red-500/20 border border-red-500/40 p-3 flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-logik-extended-bold text-red-400">
                        ✗ Ten standin NIE może grać w meczu
                      </p>
                      <p className="text-xs text-red-400/80 mt-1">
                        {request.status === 'rejected' 
                          ? 'Odrzucony przez kapitana przeciwnika. Możesz złożyć odwołanie do admina.'
                          : 'Odwołanie zostało odrzucone przez administrację.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Info banner for appeal pending */}
                {request.status === 'appeal_pending' && (
                  <div className="rounded-md bg-purple-500/20 border border-purple-500/40 p-3 flex items-start gap-3">
                    <Gavel className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-logik-extended-bold text-purple-400">
                        ⏳ Oczekiwanie na decyzję administracji
                      </p>
                      <p className="text-xs text-purple-400/80 mt-1">
                        Twoje odwołanie zostało przekazane do admina. Standin będzie mógł grać tylko jeśli admin je zatwierdzi.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <UserPlus className="w-4 h-4 text-white/60 flex-shrink-0" />
                      <span className="text-sm text-white/60">Standin:</span>
                      <span className="font-logik-extended-bold text-white">
                        {request.standinNickname}
                      </span>
                      <a
                        href={request.standinSteamProfileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-pdl-gold hover:text-pdl-gold/80 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    <p className="text-sm text-white/40">
                      Za: <span className="text-white/60">{request.replacedPlayerNickname}</span>
                      {request.replacedPlayerMmr !== undefined && (
                        <span className="text-white/40"> ({request.replacedPlayerMmr.toLocaleString()} MMR)</span>
                      )}
                    </p>
                    <p className="text-sm text-white/40">
                      Gry: <span className="text-white/60">
                        {request.gameNumbers && request.gameNumbers.length
                          ? request.gameNumbers.join(', ')
                          : 'cała seria'}
                      </span>
                    </p>
                    {request.standinMmr !== undefined && (
                      <p className="text-sm text-white/40">
                        MMR standina: <span className="text-white/60 font-logik-extended-bold">{request.standinMmr.toLocaleString()}</span>
                      </p>
                    )}
                  </div>

                  <Badge className={cn('flex-shrink-0 text-xs font-logik flex items-center gap-1', config.className)}>
                    {config.icon && <config.icon className="w-3 h-3" />}
                    {config.label}
                  </Badge>
                </div>

                {/* Rejection reason */}
                {request.rejectionReason && (
                  <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3">
                    <p className="text-xs text-red-400">
                      <span className="font-logik-extended-bold">Powód odrzucenia: </span>
                      {request.rejectionReason}
                    </p>
                  </div>
                )}

                {/* Admin note */}
                {request.appealAdminNote && (
                  <div className="rounded-md bg-purple-500/10 border border-purple-500/20 p-3">
                    <p className="text-xs text-purple-400">
                      <span className="font-logik-extended-bold">Notatka admina: </span>
                      {request.appealAdminNote}
                    </p>
                  </div>
                )}

                {/* Opponent captain actions */}
                {canApproveReject && (() => {
                  const steamId32 = resolvedSteamId32s[request.id] || null;
                  const openDotaUrl = steamId32 ? `https://www.opendota.com/players/${steamId32}` : null;
                  const dotabuffUrl = steamId32 ? `https://www.dotabuff.com/players/${steamId32}` : null;

                  // History: previous approvals of this standin replacing the same absent player
                  const previousApprovals = (allTournamentRequests || []).filter(r =>
                    r.standinSteamProfileUrl === request.standinSteamProfileUrl &&
                    r.replacedPlayerId === request.replacedPlayerId &&
                    r.matchId !== request.matchId &&
                    (r.status === 'approved' || r.status === 'appeal_approved')
                  );

                  return (
                    <div className="space-y-3">
                      {/* Info panel: profile links + history */}
                      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-3">
                        {/* External profile links */}
                        <div className="space-y-2">
                          <p className="text-[10px] font-logik-extended-bold text-white/40 uppercase tracking-widest">
                            Sprawdź gracza
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <a
                              href={request.standinSteamProfileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-[#1b2838] text-[#c7d5e0] hover:bg-[#2a475e] border border-white/10 transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Steam
                            </a>
                            {openDotaUrl ? (
                              <a
                                href={openDotaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-[#4a90d9]/10 text-[#4a90d9] hover:bg-[#4a90d9]/20 border border-[#4a90d9]/30 transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" />
                                OpenDota
                              </a>
                            ) : (
                              <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-white/[0.03] text-white/20 border border-white/5">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                OpenDota
                              </span>
                            )}
                            {dotabuffUrl ? (
                              <a
                                href={dotabuffUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-[#bf4b0b]/10 text-[#e87040] hover:bg-[#bf4b0b]/20 border border-[#bf4b0b]/30 transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Dotabuff
                              </a>
                            ) : (
                              <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-white/[0.03] text-white/20 border border-white/5">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Dotabuff
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Smurf accounts */}
                        {request.standinSmurfAccounts && request.standinSmurfAccounts.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10px] font-logik-extended-bold text-white/40 uppercase tracking-widest">
                              Konta smurf standina
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {request.standinSmurfAccounts.map((smurf, idx) => (
                                <a
                                  key={idx}
                                  href={smurf.steamProfileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-[#1b2838] text-[#c7d5e0] hover:bg-[#2a475e] border border-white/10 transition-colors"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Smurf {idx + 1}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Approval history for this standin replacing the same player */}
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-logik-extended-bold text-white/40 uppercase tracking-widest">
                            Historia za {request.replacedPlayerNickname}
                          </p>
                          {previousApprovals.length === 0 ? (
                            <p className="text-xs text-white/30">
                              Brak wcześniejszych zatwierdzeń
                            </p>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                                <p className="text-xs text-green-400 font-logik-extended-bold">
                                  Zatwierdzony {previousApprovals.length}× za tego gracza
                                </p>
                              </div>
                              <ul className="ml-5 space-y-0.5">
                                {previousApprovals.map(prev => {
                                  // Prefer labels denormalized on the request itself so history
                                  // renders "TeamA vs TeamB — date (gry …)" even when the match
                                  // isn't in the current team's loaded list.
                                  const teamsLabel = prev.matchTeamAName && prev.matchTeamBName
                                    ? `${prev.matchTeamAName} vs ${prev.matchTeamBName}`
                                    : matchNameMap?.[prev.matchId] ?? `Mecz ${prev.matchId.substring(0, 8)}…`;
                                  const dateLabel = prev.matchScheduledFor
                                    ? new Date(prev.matchScheduledFor).toLocaleDateString('pl-PL')
                                    : null;
                                  const gamesLabel = prev.gameNumbers && prev.gameNumbers.length
                                    ? `gry ${prev.gameNumbers.join(', ')}`
                                    : null;
                                  return (
                                    <li key={prev.id} className="text-xs text-white/40">
                                      • {teamsLabel}
                                      {dateLabel && <span className="text-white/30"> — {dateLabel}</span>}
                                      {gamesLabel && <span className="text-white/30"> ({gamesLabel})</span>}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Approve / Reject buttons */}
                      {showRejectInput === request.id ? (
                        <div className="space-y-2">
                          <Input
                            placeholder="Powód odrzucenia (opcjonalnie)"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="bg-white/5 border-white/10 text-white text-sm"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReject(request.id)}
                              disabled={loading}
                            >
                              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4 mr-1" />}
                              Potwierdź odrzucenie
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setShowRejectInput(null); setRejectReason(''); }}
                              className="text-white/60"
                            >
                              Anuluj
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handleApprove(request.id)}
                            disabled={loading}
                          >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                            Zatwierdź
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                            onClick={() => setShowRejectInput(request.id)}
                            disabled={loading}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Odrzuć
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Appeal button for rejected requests */}
                {canAppeal && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                    onClick={() => handleStartAppeal(request.id)}
                  >
                    <Gavel className="w-4 h-4 mr-1" />
                    Odwołaj się do admina
                  </Button>
                )}

                {/* Cancel button allows captain to remove request at any status */}
                {!isOpponentView && onCancelRequest && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                    onClick={async () => {
                      if (!loading) {
                        setLoading(true);
                        try {
                          await onCancelRequest(request.id);
                        } finally {
                          setLoading(false);
                        }
                      }
                    }}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <XCircle className="w-4 h-4 mr-1" />}
                    Anuluj prośbę
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Request new standin button (only for requesting team captain) */}
      {isCaptain && !isOpponentView && (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="border-white/10 text-white/60 hover:text-white hover:bg-white/5"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Zgłoś standina
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#0a0a0a] border-white/10 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="font-logik-extended-bold text-white">
                Zgłoś standina
              </DialogTitle>
              <DialogDescription className="text-white/60">
                Standin musi być zaakceptowany przez kapitana drużyny przeciwnej.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-white/80 text-sm">Zastępowany gracz</Label>
                <Select
                  value={selectedPlayerId}
                  onValueChange={(v) => {
                    setSelectedPlayerId(v);
                    setSubmitError('');
                    // Start with nothing selected — captain picks the games explicitly.
                    setSelectedGameNumbers([]);
                  }}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="Wybierz gracza" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    {players.map((player) => (
                      <SelectItem key={player.id} value={player.id} className="text-white">
                        {player.nickname} ({player.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {totalGames > 1 && (
                <div className="space-y-2">
                  <Label className="text-white/80 text-sm">Gry w serii</Label>
                  <p className="text-white/40 text-xs">
                    Zaznacz, w których grach serii zagra standin.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {allGameNumbers.map((g) => {
                      const taken = gamesTakenForSelectedPlayer.has(g);
                      const active = !taken && selectedGameNumbers.includes(g);
                      return (
                        <button
                          key={g}
                          type="button"
                          disabled={taken}
                          onClick={() => toggleGameNumber(g)}
                          className={cn(
                            'px-3 py-1.5 rounded-md text-sm border transition-all',
                            active
                              ? 'bg-pdl-gold/20 border-pdl-gold/50 text-pdl-gold font-logik-extended-bold'
                              : taken
                              ? 'border-white/5 text-white/20 cursor-not-allowed line-through'
                              : 'border-white/10 text-white/60 hover:text-white hover:border-white/30'
                          )}
                          title={taken ? 'Ta gra ma już zgłoszonego standina dla tego gracza' : undefined}
                        >
                          Gra {g}
                        </button>
                      );
                    })}
                  </div>
                  {selectedPlayerId && gamesTakenForSelectedPlayer.size >= allGameNumbers.length && (
                    <p className="text-red-400 text-xs">
                      Ten gracz ma już zgłoszonych standinów na wszystkie gry serii.
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-white/80 text-sm">Nick standina</Label>
                <Input
                  placeholder="Rozpoznawalny nick gracza"
                  value={standinNickname}
                  onChange={(e) => setStandinNickname(e.target.value)}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white/80 text-sm">Profil Steam standina</Label>
                <Input
                  placeholder="https://steamcommunity.com/profiles/..."
                  value={standinSteamUrl}
                  onChange={(e) => { setStandinSteamUrl(e.target.value); setSubmitError(''); }}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>

              {isMmrLimited && (
                <div className="space-y-2">
                  <Label className="text-white/80 text-sm">MMR standina</Label>
                  <Input
                    type="number"
                    placeholder="np. 4500"
                    value={standinMmr}
                    onChange={(e) => setStandinMmr(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                    min={0}
                    max={20000}
                  />
                </div>
              )}

              {isMmrLimited && (
                <div className="space-y-2">
                  <Label className="text-white/80 text-sm">Konta smurf standina</Label>
                  <p className="text-white/40 text-xs">Opcjonalnie — dodaj konta smurf standina, by przeciwnik mógł je zweryfikować.</p>
                  <div className="space-y-2">
                    {standinSmurfUrls.map((url, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <Input
                          value={url}
                          onChange={(e) => setStandinSmurfUrls(prev => prev.map((v, i) => i === idx ? e.target.value : v))}
                          placeholder="https://steamcommunity.com/profiles/..."
                          className="bg-white/5 border-white/10 text-white flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => setStandinSmurfUrls(prev => prev.filter((_, i) => i !== idx))}
                          className="p-2 rounded-md text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setStandinSmurfUrls(prev => [...prev, ''])}
                    className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-white/10 text-white/60 hover:text-white hover:border-white/30 hover:bg-white/5 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Dodaj konto smurf
                  </button>
                </div>
              )}
            </div>

            {submitError && (
              <p className="text-red-400 text-xs">{submitError}</p>
            )}

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setIsOpen(false)}
                className="text-white/60"
              >
                Anuluj
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!selectedPlayerId || !standinNickname.trim() || !standinSteamUrl.trim() || (isMmrLimited && !standinMmr.trim()) || (totalGames > 1 && selectedGameNumbers.length === 0) || loading}
                className="bg-pdl-crimson hover:bg-pdl-crimson/80 text-white font-logik-extended-bold"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                Wyślij prośbę
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Appeal confirmation dialog */}
      <Dialog open={isAppealOpen} onOpenChange={setIsAppealOpen}>
        <DialogContent className="bg-[#0a0a0a] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-logik-extended-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-purple-400" />
              Odwołanie do administracji
            </DialogTitle>
            <DialogDescription className="text-white/60">
              Przeczytaj uważnie poniższe zasady przed złożeniem odwołania.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-200 font-logik-extended-bold">
                  Admin może nadpisać decyzję kapitana przeciwnej drużyny WYŁĄCZNIE jeśli WSZYSTKIE poniższe warunki są spełnione:
                </p>
              </div>

              <ul className="space-y-2 ml-7">
                {APPEAL_RULES.map((rule, index) => (
                  <li key={index} className="text-sm text-white/70 flex items-start gap-2">
                    <span className="text-yellow-400 font-logik-extended-bold flex-shrink-0">
                      {index + 1}.
                    </span>
                    {rule}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-4">
              <p className="text-sm text-purple-200">
                <span className="font-logik-extended-bold">Ważne: </span>
                Po złożeniu odwołania musisz natychmiast skontaktować się z administracją
                (np. na Discordzie) i poinformować o złożonym odwołaniu.
              </p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={appealConfirmed}
                onChange={(e) => setAppealConfirmed(e.target.checked)}
                className="mt-1 rounded border-white/30 bg-white/5"
              />
              <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">
                Potwierdzam, że zapoznałem się z zasadami odwołania i natychmiast
                poinformuję administrację o złożonym odwołaniu.
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsAppealOpen(false)}
              className="text-white/60"
            >
              Anuluj
            </Button>
            <Button
              onClick={handleConfirmAppeal}
              disabled={!appealConfirmed || loading}
              className="bg-purple-600 hover:bg-purple-700 text-white font-logik-extended-bold"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Gavel className="w-4 h-4 mr-2" />}
              Złóż odwołanie
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
