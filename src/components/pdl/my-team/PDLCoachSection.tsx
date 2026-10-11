'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  GraduationCap,
  Loader2,
  ExternalLink,
  Pencil,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { COACH_CHANGE_LOCK_HOURS, isWithinCoachLock } from '@/lib/coach-rules';

interface CoachInfo {
  nickname: string;
  steamProfileUrl: string;
  assignedAt: string;
}

interface PDLCoachSectionProps {
  isCaptain: boolean;
  /** Current coach info for the team (from the nearest upcoming match) */
  currentCoach: CoachInfo | null;
  /** Scheduled date of the next match (used for 24h deadline check) */
  nextMatchDate?: string;
  /** Called to set/update coach for all upcoming matches */
  onSetCoach: (data: { nickname: string; steamProfileUrl: string }) => Promise<void>;
  /** Called to remove coach */
  onRemoveCoach: () => Promise<void>;
}

export function PDLCoachSection({
  isCaptain,
  currentCoach,
  nextMatchDate,
  onSetCoach,
  onRemoveCoach,
}: PDLCoachSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nickname, setNickname] = useState(currentCoach?.nickname || '');
  const [steamUrl, setSteamUrl] = useState(currentCoach?.steamProfileUrl || '');

  // Reporting closes 24 h before the match (rulebook) — changes are blocked, not just warned about
  const isLocked = isWithinCoachLock(nextMatchDate);

  const handleSubmit = async () => {
    if (!nickname.trim()) return;

    setLoading(true);
    try {
      await onSetCoach({
        nickname: nickname.trim(),
        steamProfileUrl: steamUrl.trim(),
      });
      setIsOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    setLoading(true);
    try {
      await onRemoveCoach();
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = () => {
    setNickname(currentCoach?.nickname || '');
    setSteamUrl(currentCoach?.steamProfileUrl || '');
    setIsOpen(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-pdl-gold" />
          <span className="text-sm font-logik-extended-bold text-white/80 uppercase tracking-wide">
            Trener
          </span>
        </div>

        {isCaptain && !isLocked && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={openEditDialog}
                className="text-white/40 hover:text-white hover:bg-white/5 h-7 px-2"
              >
                {currentCoach ? (
                  <Pencil className="w-3.5 h-3.5" />
                ) : (
                  <>
                    <GraduationCap className="w-3.5 h-3.5 mr-1" />
                    <span className="text-xs">Dodaj</span>
                  </>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0a0a0a] border-white/10 text-white max-w-md">
              <DialogHeader>
                <DialogTitle className="font-logik-extended-bold text-white">
                  {currentCoach ? 'Zmień trenera' : 'Dodaj trenera'}
                </DialogTitle>
                <DialogDescription className="text-white/60">
                  Trenera zgłaszasz do tego meczu — najpóźniej {COACH_CHANGE_LOCK_HOURS} h przed jego terminem.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white/80 text-sm">Nick trenera</Label>
                  <Input
                    placeholder="Rozpoznawalny nick"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white/80 text-sm">Profil Steam trenera <span className="text-white/40">(opcjonalnie)</span></Label>
                  <Input
                    placeholder="https://steamcommunity.com/profiles/..."
                    value={steamUrl}
                    onChange={(e) => setSteamUrl(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
              </div>

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
                  disabled={!nickname.trim() || loading}
                  className="bg-pdl-crimson hover:bg-pdl-crimson/80 text-white font-logik-extended-bold"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <GraduationCap className="w-4 h-4 mr-2" />}
                  {currentCoach ? 'Zapisz zmiany' : 'Dodaj trenera'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Current coach display */}
      {currentCoach ? (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-4 h-4 text-pdl-gold" />
            </div>
            <div className="min-w-0">
              <p className="font-logik-extended-bold text-white text-sm truncate">
                {currentCoach.nickname}
              </p>
              {currentCoach.steamProfileUrl && (
              <a
                href={currentCoach.steamProfileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-pdl-gold hover:text-pdl-gold/80 flex items-center gap-1"
              >
                Profil Steam <ExternalLink className="w-3 h-3" />
              </a>
              )}
            </div>
          </div>

          {isCaptain && !isLocked && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10 h-7 w-7 p-0"
              onClick={handleRemove}
              disabled={loading}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.01] p-3 text-center">
          <p className="text-xs text-white/30 font-logik">
            {isCaptain && !isLocked ? 'Opcjonalnie — kliknij "Dodaj", aby zgłosić trenera' : 'Brak zgłoszonego trenera'}
          </p>
        </div>
      )}

      {isCaptain && isLocked && (
        <p className="text-xs text-amber-300/90 font-logik">
          Zgłoszenia trenera na ten mecz są zamknięte ({COACH_CHANGE_LOCK_HOURS} h przed meczem).
        </p>
      )}
    </div>
  );
}
