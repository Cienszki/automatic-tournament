"use client";

import React from 'react';
import { useTournament } from '@/context/TournamentContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { LogIn, KeyRound, CheckCircle2, Loader2 } from 'lucide-react';

/**
 * /[tournamentSlug]/newcaptain
 * A prospective captain logs in and enters the one-time code an admin sent them.
 * On success they become the captain of the associated team and the code is discarded.
 */
export default function NewCaptainPage() {
  const { tournament, theme, getTournamentPath } = useTournament();
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const { toast } = useToast();

  const [code, setCode] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState<{ teamName: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !tournament?.id || !code.trim()) return;

    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/captain-change/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: code.trim(), tournamentId: tournament.id }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toast({
          title: 'Nie udało się przejąć drużyny',
          description: data.error || 'Spróbuj ponownie.',
          variant: 'destructive',
        });
        return;
      }

      setDone({ teamName: data.teamName });
      toast({
        title: 'Gotowe!',
        description: `Jesteś teraz kapitanem drużyny ${data.teamName || ''}.`,
      });
    } catch (err) {
      toast({
        title: 'Błąd',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const Background = (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-60"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, transparent 40%, #000000 100%)',
        }}
      />
      <div
        className="absolute top-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full opacity-[0.04] blur-[200px]"
        style={{ background: theme?.primaryColor || '#8B1538' }}
      />
    </div>
  );

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="relative text-white overflow-x-hidden min-h-screen">
      {Background}
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12 py-16">
        <div className="text-center space-y-8">
          <h1 className="text-5xl lg:text-7xl font-logik-wide-black text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/50 tracking-tight uppercase">
            Nowy Kapitan
          </h1>
          <div className="max-w-md mx-auto rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 space-y-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );

  // Loading auth state
  if (authLoading) {
    return (
      <Shell>
        <Loader2 className="w-8 h-8 mx-auto animate-spin text-pdl-gold" />
      </Shell>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <Shell>
        <LogIn className="w-12 h-12 mx-auto text-pdl-gold" />
        <p className="text-white/60 font-logik">
          Zaloguj się, aby przejąć drużynę za pomocą kodu od administratora.
        </p>
        <Button
          onClick={signInWithGoogle}
          className="w-full bg-pdl-crimson hover:bg-pdl-crimson/80 text-white font-logik-extended-bold"
        >
          <LogIn className="mr-2 h-4 w-4" />
          Zaloguj się przez Google
        </Button>
      </Shell>
    );
  }

  // Success
  if (done) {
    return (
      <Shell>
        <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400" />
        <p className="text-white/80 font-logik">
          Jesteś teraz kapitanem drużyny{' '}
          <span className="font-logik-extended-bold text-white">{done.teamName}</span>.
        </p>
        <Button
          onClick={() => {
            window.location.href = getTournamentPath('/my-team');
          }}
          className="w-full bg-pdl-crimson hover:bg-pdl-crimson/80 text-white font-logik-extended-bold"
        >
          Przejdź do mojej drużyny
        </Button>
      </Shell>
    );
  }

  // Logged in — enter code
  return (
    <Shell>
      <KeyRound className="w-12 h-12 mx-auto text-pdl-gold" />
      <p className="text-white/60 font-logik">
        Wpisz jednorazowy kod, który otrzymałeś od administratora turnieju.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="np. AB7K9XQM"
          autoFocus
          maxLength={16}
          className="text-center text-2xl tracking-[0.3em] font-logik-extended-bold uppercase bg-white/[0.04] border-white/10 h-14"
        />
        <Button
          type="submit"
          disabled={submitting || !code.trim()}
          className="w-full bg-pdl-crimson hover:bg-pdl-crimson/80 text-white font-logik-extended-bold"
        >
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <KeyRound className="mr-2 h-4 w-4" />
          )}
          Przejmij drużynę
        </Button>
      </form>
    </Shell>
  );
}
