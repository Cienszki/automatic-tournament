'use client';

// Super-admin management of the `tournamentCreators` allowlist.
//
// Deliberately kept separate from the tournament-admins block: that grant is
// scoped to one tournament, this one is platform-wide ("may create NEW
// tournaments"). Presenting them together would blur two different scopes.
//
// Renders nothing for non-super-admins.

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTournament } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, UserPlus, Trash2, X, KeyRound } from 'lucide-react';

interface CreatorEntry {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  addedAt?: string | null;
}

export function TournamentCreatorsManager() {
  const { user } = useAuth();
  const { theme } = useTournament();
  const { toast } = useToast();

  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [checked, setChecked] = useState(false);
  const [creators, setCreators] = useState<CreatorEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [found, setFound] = useState<CreatorEntry | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const authedFetch = useCallback(async (input: string, init?: RequestInit) => {
    if (!user) throw new Error('not signed in');
    const token = await user.getIdToken();
    return fetch(input, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  }, [user]);

  // Gate on super admin, reusing the same endpoint the wizard guard uses.
  useEffect(() => {
    if (!user) { setChecked(true); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await authedFetch('/api/creator/access');
        const data = await res.json();
        if (cancelled) return;
        setIsSuperAdmin(!!data.isSuperAdmin);
      } catch {
        if (!cancelled) setIsSuperAdmin(false);
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user, authedFetch]);

  const loadCreators = useCallback(async () => {
    if (!isSuperAdmin) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await authedFetch('/api/admin/tournament-creators');
      const data = await res.json();
      setCreators(data.creators ?? []);
    } catch (err) {
      console.error('[creators] load failed', err);
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, authedFetch]);

  useEffect(() => { if (checked) loadCreators(); }, [checked, loadCreators]);

  if (!checked || !isSuperAdmin) return null;

  const handleSearch = async () => {
    if (!email.trim()) return;
    setSearching(true);
    setSearchError('');
    setFound(null);
    try {
      const res = await authedFetch('/api/admin/search-user', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (data.success && data.user) setFound(data.user);
      else setSearchError(data.error || 'Nie znaleziono użytkownika o tym adresie e-mail');
    } catch {
      setSearchError('Błąd podczas wyszukiwania');
    } finally {
      setSearching(false);
    }
  };

  const handleGrant = async () => {
    if (!found) return;
    if (creators.some(c => c.uid === found.uid)) {
      toast({ title: 'Ten użytkownik już może tworzyć turnieje' });
      return;
    }
    setBusy('grant');
    try {
      const res = await authedFetch('/api/admin/tournament-creators', {
        method: 'POST',
        body: JSON.stringify({ uid: found.uid }),
      });
      if (!res.ok) throw new Error('failed');
      setFound(null);
      setEmail('');
      await loadCreators();
      toast({
        title: 'Uprawnienia nadane',
        description: `${found.displayName || found.email} może teraz tworzyć turnieje.`,
      });
    } catch {
      toast({ title: 'Błąd', description: 'Nie udało się nadać uprawnień.', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const handleRevoke = async (entry: CreatorEntry) => {
    if (!window.confirm(
      `Odebrać ${entry.displayName || entry.email || entry.uid} prawo tworzenia nowych turniejów?\n\n` +
      `Turnieje, które już utworzył(a), pozostaną nietknięte.`
    )) return;
    setBusy(entry.uid);
    try {
      const res = await authedFetch(
        `/api/admin/tournament-creators?uid=${encodeURIComponent(entry.uid)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('failed');
      await loadCreators();
      toast({ title: 'Uprawnienia odebrane' });
    } catch {
      toast({ title: 'Błąd', description: 'Nie udało się odebrać uprawnień.', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
          <KeyRound className="h-5 w-5" style={{ color: theme.primaryColor }} />
          Kto może tworzyć turnieje
        </CardTitle>
        <CardDescription className="font-logik">
          Lista obejmuje całą platformę, nie tylko ten turniej. Osoby z tej listy mogą
          przejść przez kreatora i utworzyć własny turniej — stają się jego
          administratorami, ale nie zyskują dostępu do innych turniejów.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Adres e-mail konta Google"
            className="flex-1 min-w-[220px] font-logik"
          />
          <Button onClick={handleSearch} disabled={searching || !email.trim()} variant="outline">
            {searching ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Search className="h-4 w-4 mr-1.5" />}
            Szukaj
          </Button>
        </div>

        {searchError && (
          <p className="text-sm text-destructive font-logik">{searchError}</p>
        )}

        {found && (
          <div className="p-4 rounded-lg border border-border bg-background/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {found.photoURL && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={found.photoURL} alt="" className="w-10 h-10 rounded-full shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-logik-extended-bold truncate">{found.displayName || found.email}</p>
                <p className="text-sm text-muted-foreground font-logik truncate">{found.email}</p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                onClick={handleGrant}
                disabled={busy === 'grant'}
                size="sm"
                style={{ backgroundColor: theme.primaryColor }}
                className="font-logik"
              >
                {busy === 'grant'
                  ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  : <UserPlus className="h-4 w-4 mr-1" />}
                Pozwól tworzyć turnieje
              </Button>
              <Button onClick={() => setFound(null)} variant="ghost" size="sm">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground font-logik flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Ładowanie...
            </p>
          ) : creators.length === 0 ? (
            <p className="text-sm text-muted-foreground font-logik">
              Na razie tylko administratorzy platformy mogą tworzyć turnieje.
            </p>
          ) : (
            creators.map(c => (
              <div
                key={c.uid}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {c.photoURL && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.photoURL} alt="" className="w-8 h-8 rounded-full shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-logik text-sm truncate">{c.displayName || c.email || c.uid}</p>
                    {c.email && (
                      <p className="text-xs text-muted-foreground font-logik truncate">{c.email}</p>
                    )}
                  </div>
                </div>
                <Button
                  onClick={() => handleRevoke(c)}
                  disabled={busy === c.uid}
                  variant="ghost"
                  size="sm"
                  className="text-destructive shrink-0"
                >
                  {busy === c.uid
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
