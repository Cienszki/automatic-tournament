'use client';

// Organizer dashboard — everything that spans an organiser's tournaments rather
// than sitting inside one of them.
//
// Redirects live here rather than in a tournament's own settings because they
// are a decision ABOUT A SERIES: "when someone opens /pdl, send them to whichever
// season is current". You can only make that call sensibly while looking at all
// your tournaments at once.
//
// Built as independent sections so more can be added without restructuring —
// prize pools, shared sponsors, cross-season stats and so on.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  fetchOrganizerTournaments,
  setTournamentRedirect,
  type OrganizerTournament,
} from '@/lib/api/tournaments';
import { isRedirectTargetValid, suggestNextInSeries } from '@/lib/slug-namespace';
import { cn } from '@/lib/utils';
import {
  Loader2, LogIn, Plus, ExternalLink, Settings, ArrowRight, CornerDownRight,
  Trophy, Info, Check, X,
} from 'lucide-react';

const TYPE_LABEL: Record<string, string> = {
  'mmr-limited': 'Limit MMR',
  'league': 'Liga',
  'swiss': 'Swiss',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Wersja robocza',
  registration: 'Rejestracja',
  active: 'W trakcie',
  completed: 'Zakończony',
  archived: 'Archiwum',
};

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  registration: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  active: 'bg-green-500/15 text-green-600 dark:text-green-400',
  completed: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400',
  archived: 'bg-zinc-500/10 text-muted-foreground',
};

export default function OrganizerPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuth();

  const [tournaments, setTournaments] = useState<OrganizerTournament[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/creator/access', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const access = await res.json().catch(() => ({}));
      setIsSuperAdmin(!!access.isSuperAdmin);
      setCanCreate(!!access.canCreate);

      const list = await fetchOrganizerTournaments(user.uid, {
        isSuperAdmin: !!access.isSuperAdmin,
      });
      setTournaments(list);
    } catch (err) {
      console.error('[organizer] load failed', err);
      setError('Nie udało się wczytać Twoich turniejów.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { if (!authLoading) load(); }, [authLoading, load]);

  const slugs = useMemo(() => tournaments.map(t => t.slug), [tournaments]);

  const handleRedirectChange = async (t: OrganizerTournament, target: string) => {
    const verdict = isRedirectTargetValid(
      t.slug,
      target,
      tournaments.map(x => ({ slug: x.slug, organizerId: x.organizerId }))
    );
    if (!verdict.ok) {
      setError(verdict.message);
      return;
    }

    setError(null);
    setSavingId(t.id);
    try {
      await setTournamentRedirect(t.id, target || null);
      setTournaments(prev =>
        prev.map(x => (x.id === t.id ? { ...x, redirectToSlug: target || null } : x))
      );
      setSavedId(t.id);
      setTimeout(() => setSavedId(null), 2000);
    } catch (err) {
      console.error('[organizer] redirect save failed', err);
      setError('Nie udało się zapisać przekierowania. Sprawdź uprawnienia.');
    } finally {
      setSavingId(null);
    }
  };

  // ── gates ─────────────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <Centered>
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Ładowanie...</span>
      </Centered>
    );
  }

  if (!user) {
    return (
      <Centered>
        <div className="text-center max-w-sm">
          <LogIn className="h-8 w-8 mx-auto mb-3 text-primary" />
          <h1 className="text-xl font-bold mb-2">Zaloguj się</h1>
          <p className="text-sm text-muted-foreground mb-5">
            Panel organizatora pokazuje turnieje, którymi zarządzasz.
          </p>
          <button
            onClick={() => signInWithGoogle()}
            className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Zaloguj przez Google
          </button>
        </div>
      </Centered>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-card/40 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Trophy className="h-6 w-6 text-primary" />
              Panel organizatora
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isSuperAdmin
                ? 'Widzisz wszystkie turnieje na platformie.'
                : 'Turnieje, których jesteś organizatorem.'}
            </p>
          </div>
          {canCreate && (
            <Link
              href="/creator"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nowy turniej
            </Link>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-10 max-w-5xl">
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-start gap-2">
            <X className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Section: tournaments ──────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold mb-1">Twoje turnieje</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {tournaments.length === 0
              ? 'Nie masz jeszcze żadnych turniejów.'
              : `${tournaments.length} ${tournaments.length === 1 ? 'turniej' : 'turnieje'}.`}
          </p>

          {tournaments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                {canCreate
                  ? 'Zacznij od utworzenia pierwszego turnieju.'
                  : 'Poproś administratora platformy o uprawnienia do tworzenia turniejów.'}
              </p>
              {canCreate && (
                <Link
                  href="/creator"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  <Plus className="h-4 w-4" /> Utwórz turniej
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {tournaments.map(t => (
                <div key={t.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    {t.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.logoUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted shrink-0" />
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">/{t.slug}</p>
                    </div>

                    {t.type && (
                      <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground shrink-0">
                        {TYPE_LABEL[t.type] ?? t.type}
                      </span>
                    )}
                    {t.status && (
                      <span className={cn(
                        'text-xs px-2 py-1 rounded shrink-0',
                        STATUS_STYLE[t.status] ?? 'bg-muted text-muted-foreground'
                      )}>
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                    )}

                    <div className="flex gap-2 shrink-0">
                      <Link
                        href={`/${t.slug}?noredirect=1`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Strona
                      </Link>
                      <Link
                        href={`/${t.slug}/admin`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
                      >
                        <Settings className="h-3.5 w-3.5" /> Panel
                      </Link>
                    </div>
                  </div>

                  {t.redirectToSlug && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                      <CornerDownRight className="h-3.5 w-3.5" />
                      Odwiedzający są przenoszeni na <span className="font-mono">/{t.redirectToSlug}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Section: redirects ────────────────────────────────────────── */}
        {tournaments.length > 1 && (
          <section>
            <h2 className="text-lg font-semibold mb-1">Przekierowania między edycjami</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Gdy zaczyna się nowy sezon, skieruj na niego stary adres. Kibice mogą zostawić
              zakładkę na <span className="font-mono">/{tournaments[tournaments.length - 1]?.slug}</span> i
              zawsze trafią na aktualną edycję.
            </p>

            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {tournaments.map(t => (
                <div key={t.id} className="p-4 flex flex-wrap items-center gap-3">
                  <span className="font-mono text-sm min-w-0 truncate flex-1">/{t.slug}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  <select
                    value={t.redirectToSlug ?? ''}
                    disabled={savingId === t.id}
                    onChange={e => handleRedirectChange(t, e.target.value)}
                    className="px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none min-w-[200px]"
                  >
                    <option value="">— bez przekierowania —</option>
                    {slugs.filter(s => s !== t.slug).map(s => (
                      <option key={s} value={s}>/{s}</option>
                    ))}
                  </select>
                  {savingId === t.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {savedId === t.id && <Check className="h-4 w-4 text-green-500" />}
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
              <p className="flex items-start gap-2">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  Przekierowanie <strong>nie dotyczy panelu administracyjnego</strong> — starą
                  edycją nadal zarządzasz normalnie przez „Panel”.
                </span>
              </p>
              <p className="pl-[22px]">
                Ścieżka jest zachowana: <span className="font-mono">/stary/druzyny</span> prowadzi
                na <span className="font-mono">/nowy/druzyny</span>.
              </p>
              <p className="pl-[22px]">
                Przekierowania nie łączą się w łańcuch — jeśli cel też ma przekierowanie,
                nie jest ono wykonywane.
              </p>
            </div>
          </section>
        )}

        {/* ── Section: series namespace ─────────────────────────────────── */}
        {tournaments.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-1">Twoje serie turniejów</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Adres turnieju rezerwuje całą serię. Nikt inny nie zajmie kolejnych edycji.
            </p>
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {tournaments.map(t => (
                <div key={t.id} className="p-4 flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-mono min-w-0 truncate flex-1">/{t.slug}-*</span>
                  <span className="text-muted-foreground">
                    następna edycja:{' '}
                    <span className="font-mono text-foreground">
                      /{suggestNextInSeries(t.slug, slugs)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-muted-foreground">{children}</div>
    </div>
  );
}
