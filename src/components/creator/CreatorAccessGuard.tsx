'use client';

// Gate for /creator and /creator/new.
//
// Both routes previously had no auth check at all. A non-permitted user could
// fill in the whole wizard, press Publish, and get a generic "Wystąpił błąd"
// when the Firestore write was rejected — with no indication that the problem
// was permissions rather than their input.

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Loader2, ShieldAlert, LogIn } from 'lucide-react';

type AccessState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'denied' }
  | { status: 'allowed'; isSuperAdmin: boolean };

export function CreatorAccessGuard({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const [access, setAccess] = useState<AccessState>({ status: 'loading' });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setAccess({ status: 'anonymous' });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/creator/access', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (cancelled) return;
        setAccess(
          data.canCreate
            ? { status: 'allowed', isSuperAdmin: !!data.isSuperAdmin }
            : { status: 'denied' }
        );
      } catch (err) {
        console.error('[CreatorAccessGuard] access check failed', err);
        if (!cancelled) setAccess({ status: 'denied' });
      }
    })();

    return () => { cancelled = true; };
  }, [user, authLoading]);

  if (authLoading || access.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Sprawdzanie uprawnień...</span>
        </div>
      </div>
    );
  }

  if (access.status === 'anonymous') {
    return (
      <Shell
        icon={<LogIn className="h-8 w-8 text-primary" />}
        title="Zaloguj się"
        body="Tworzenie turnieju wymaga zalogowanego konta."
      >
        <button
          onClick={() => signInWithGoogle()}
          className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
        >
          Zaloguj przez Google
        </button>
      </Shell>
    );
  }

  if (access.status === 'denied') {
    return (
      <Shell
        icon={<ShieldAlert className="h-8 w-8 text-destructive" />}
        title="Brak uprawnień"
        body={
          'Twoje konto nie ma jeszcze uprawnień do tworzenia turniejów. ' +
          'Poproś administratora platformy o dodanie Cię do listy organizatorów — ' +
          'zajmuje to chwilę i robi się to w panelu administracyjnym dowolnego turnieju.'
        }
      >
        <Link
          href="/"
          className="px-6 py-3 rounded-lg border border-border font-medium hover:bg-muted transition-colors"
        >
          Wróć na stronę główną
        </Link>
      </Shell>
    );
  }

  return <>{children}</>;
}

function Shell({
  icon, title, body, children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center bg-card border border-border rounded-xl p-8 shadow-lg">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
          {icon}
        </div>
        <h1 className="text-2xl font-bold mb-2">{title}</h1>
        <p className="text-sm text-muted-foreground mb-6">{body}</p>
        {children}
      </div>
    </div>
  );
}
