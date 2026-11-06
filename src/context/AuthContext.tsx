"use client";

// Signing in: with Discord (our server does Discord's login and hands Firebase a one-time token) or
// with Google. `signIn()` — and `signInWithGoogle()`, which every older page still calls — opens the
// choice; when Discord login is not switched on yet it goes straight to Google.
// Also links Discord / Steam to the signed-in account (those return to the page they started on).

import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithCustomToken,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  /** Opens the sign-in choice (Discord / Google) */
  signIn: () => void;
  /** Same as signIn (kept for the pages that call it) */
  signInWithGoogle: () => Promise<void>;
  signInWithDiscord: () => Promise<void>;
  /** Straight to Google (no choice dialog): for pages that show both buttons themselves */
  signInGoogleDirect: () => Promise<void>;
  /** Discord login is set up (null = still checking) */
  discordLogin: boolean | null;
  /** Links Discord / Steam to the signed-in account; the browser comes back to this page */
  linkDiscord: () => Promise<void>;
  connectSteam: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const NONCE_KEY = "discord-login-nonce";

const DiscordMark = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
    <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.3 18.3 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.5C.5 9.2-.3 13.8.1 18.3a19.9 19.9 0 0 0 6 3l1.3-2.1a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.8 19.8 0 0 0 6-3c.5-5.2-.8-9.8-3.6-13.9ZM8 15.5c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z" />
  </svg>
);
const GoogleMark = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
    <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8.1Z" />
    <path fill="#34A853" d="M12 23c3 0 5.5-1 7.2-2.7l-3.5-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.2v2.8A11 11 0 0 0 12 23Z" />
    <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.2a11 11 0 0 0 0 9.9l3.6-2.8Z" />
    <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 0 0 2.2 7.1l3.6 2.8C6.7 7.3 9.1 5.4 12 5.4Z" />
  </svg>
);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [choosing, setChoosing] = useState(false);
  const [discordOn, setDiscordOn] = useState<boolean | null>(null);
  const { toast } = useToast();

  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setLoading(false); }), []);
  useEffect(() => { fetch("/api/login/providers").then(r => r.json()).then(p => setDiscordOn(!!p.discord)).catch(() => setDiscordOn(false)); }, []);

  const startSession = async (u: User) => {
    const idToken = await u.getIdToken();
    await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) });
  };

  // Back from Discord / Steam: finish the sign-in, or say what happened
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    const clean = () => {
      const u = new URL(window.location.href);
      ["konto", "powod", "steam"].forEach(k => u.searchParams.delete(k));
      u.hash = "";
      window.history.replaceState(null, "", u.pathname + u.search);
    };
    const token = hash.get("discord-login");
    if (token) {
      const expected = sessionStorage.getItem(NONCE_KEY);
      sessionStorage.removeItem(NONCE_KEY);
      clean();
      // Only a sign-in this browser started (stops someone signing you into their account)
      if (!expected || expected !== hash.get("n")) { toast({ title: "Logowanie przerwane", description: "Spróbuj zalogować się jeszcze raz.", variant: "destructive" }); return; }
      signInWithCustomToken(auth, token)
        .then(r => startSession(r.user))
        .then(() => toast({ title: "Zalogowano przez Discord" }))
        .catch(() => toast({ title: "Nie udało się zalogować", description: "Spróbuj jeszcze raz.", variant: "destructive" }));
      return;
    }
    const k = query.get("konto");
    if (k || query.get("steam")) {
      if (k === "discord") toast({ title: "Discord połączony" });
      else if (k === "steam") toast({ title: "Steam połączony" });
      else if (k === "blad") toast({ title: "Nie udało się", description: query.get("powod") ?? "Spróbuj jeszcze raz.", variant: "destructive" });
      if (query.get("steam") === "zajety") toast({ title: "To konto Steam jest już połączone z innym kontem", variant: "destructive" });
      clean();
    }
  }, [toast]);

  const google = useCallback(async () => {
    setChoosing(false);
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      if (result?.user) { await startSession(result.user); toast({ title: "Zalogowano" }); }
    } catch (error: any) {
      if (error.code !== "auth/popup-closed-by-user") toast({ title: "Nie udało się zalogować", description: "Spróbuj jeszcze raz.", variant: "destructive" });
    }
  }, [toast]);

  /** Starts a Discord / Steam round trip that comes back to this page */
  const goTo = useCallback(async (path: string, body: object, withToken: boolean) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (withToken) headers.Authorization = `Bearer ${await auth.currentUser!.getIdToken()}`;
    const r = await fetch(path, { method: "POST", headers, body: JSON.stringify({ origin: window.location.origin, next: window.location.pathname + window.location.search, ...body }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.url) { toast({ title: "Nie udało się", description: j.error ?? "Spróbuj jeszcze raz.", variant: "destructive" }); return; }
    window.location.href = j.url;
  }, [toast]);

  const signInWithDiscord = useCallback(async () => {
    const nonce = crypto.randomUUID();
    sessionStorage.setItem(NONCE_KEY, nonce);
    await goTo("/api/login/discord", { mode: "login", nonce }, false);
  }, [goTo]);
  const linkDiscord = useCallback(() => goTo("/api/login/discord", { mode: "link", nonce: crypto.randomUUID() }, true), [goTo]);
  const connectSteam = useCallback(() => goTo("/api/connect/steam", {}, true), [goTo]);

  const signIn = useCallback(() => { if (discordOn) setChoosing(true); else google(); }, [discordOn, google]);

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      await fetch("/api/session", { method: "DELETE" });
      toast({ title: "Wylogowano" });
    } catch {
      toast({ title: "Nie udało się wylogować", variant: "destructive" });
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signInWithGoogle: async () => signIn(), signInWithDiscord, signInGoogleDirect: google, discordLogin: discordOn, linkDiscord, connectSteam, signOut }}>
      {children}
      <Dialog open={choosing} onOpenChange={setChoosing}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Zaloguj się</DialogTitle>
            <DialogDescription className="sr-only">Wybierz, jak chcesz się zalogować</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <button type="button" onClick={() => { setChoosing(false); signInWithDiscord(); }}
              className="flex items-center justify-center gap-3 rounded-md h-12 font-bold text-white transition-[filter] hover:brightness-110" style={{ background: "#5865F2" }}>
              <DiscordMark />Przez Discord
            </button>
            <button type="button" onClick={google}
              className="flex items-center justify-center gap-3 rounded-md h-12 font-bold border transition-colors hover:bg-black/5 dark:hover:bg-white/5">
              <GoogleMark />Przez Google
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
