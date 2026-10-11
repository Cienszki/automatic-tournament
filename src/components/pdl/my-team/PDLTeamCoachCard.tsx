'use client';

import { useState } from 'react';
import { GraduationCap, Loader2, Lock, Pencil, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTournament } from '@/context/TournamentContext';
import type { CoachLock } from '@/lib/coach-rules';

const MAX_NICKNAME = 32;

interface PDLTeamCoachCardProps {
  /** Current team coach nickname (team.coach.nickname) */
  coachNickname: string | null;
  isCaptain: boolean;
  /** Whether changes are currently blocked (e.g. a match within 24 h) */
  lock: CoachLock;
  /** One-line rule for this tournament, shown under the title */
  ruleSummary: string;
  /** Save a nickname, or null to remove the coach */
  onSave: (nickname: string | null) => Promise<void>;
}

/**
 * Team-level coach ("Elastycznie" / "Zgłaszani przed sezonem"): one coach for the team that
 * stays until changed. Captains enter only a nickname.
 */
export function PDLTeamCoachCard({ coachNickname, isCaptain, lock, ruleSummary, onSave }: PDLTeamCoachCardProps) {
  const { theme } = useTournament();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const primary = theme?.primaryColor || '#8B1538';
  const canEdit = isCaptain && !lock.locked;

  const run = async (value: string | null) => {
    setSaving(true);
    try {
      await onSave(value);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const submit = () => {
    const nickname = draft.trim().slice(0, MAX_NICKNAME);
    if (!nickname || nickname === coachNickname) {
      setEditing(false);
      return;
    }
    run(nickname);
  };

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `color-mix(in srgb, ${primary} 20%, transparent)`, color: primary }}>
          <GraduationCap className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <h3
              className="text-sm uppercase tracking-[0.15em]"
              style={{ color: 'var(--tournament-heading)', fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined }}
            >
              Trener drużyny
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--tournament-secondary-text)' }}>
              {ruleSummary}
            </p>
          </div>

          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                value={draft}
                maxLength={MAX_NICKNAME}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); submit(); }
                  if (e.key === 'Escape') setEditing(false);
                }}
                placeholder="Nick trenera"
                aria-label="Nick trenera"
                disabled={saving}
                className="h-9 max-w-xs bg-white/5 border-white/10 text-white"
              />
              <Button size="icon" className="h-9 w-9" style={{ backgroundColor: primary }} onClick={submit} disabled={saving || !draft.trim()} aria-label="Zapisz trenera">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-9 w-9 text-white/60" onClick={() => setEditing(false)} disabled={saving} aria-label="Anuluj">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {coachNickname ? (
                <span className="font-logik-extended-bold text-base" style={{ color: 'var(--tournament-primary-text)' }}>
                  {coachNickname}
                </span>
              ) : (
                <span className="text-sm" style={{ color: 'var(--tournament-secondary-text)' }}>
                  Brak trenera — drużyna gra bez trenera.
                </span>
              )}
              {canEdit && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-white/60 hover:text-white hover:bg-white/5"
                    onClick={() => { setDraft(coachNickname ?? ''); setEditing(true); }}
                    disabled={saving}
                  >
                    {coachNickname ? <Pencil className="h-3.5 w-3.5 mr-1" /> : <GraduationCap className="h-3.5 w-3.5 mr-1" />}
                    <span className="text-xs">{coachNickname ? 'Zmień' : 'Dodaj trenera'}</span>
                  </Button>
                  {coachNickname && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-red-400/70 hover:text-red-400 hover:bg-red-500/10"
                      onClick={() => run(null)}
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                      <span className="text-xs">Usuń</span>
                    </Button>
                  )}
                </>
              )}
            </div>
          )}

          {isCaptain && lock.locked && lock.reason && (
            <p className="flex items-start gap-1.5 text-xs text-amber-300/90">
              <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {lock.reason}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
