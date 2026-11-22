"use client";

// Back from linking a Discord that already has its own account (made by "Zaloguj przez Discord",
// with cards but no team or role): shows what would move here and merges after a yes. Where both
// accounts have cards for the same tournament, the person picks which collection stays.

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { count } from "@/lib/plural";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Pile { cards: number; packs: number; games: number }
interface Preview {
  discord: { username: string; name: string };
  tournaments: Array<{ key: string; name: string; other: Pile; mine: Pile | null }>;
  steam: "moves" | "dropped" | null;
}
type Keep = "mine" | "other";

const describe = (p: Pile) => [
  count(p.cards, "karta", "karty", "kart"),
  count(p.packs, "paczka", "paczki", "paczek"),
  ...(p.games ? [count(p.games, "mecz w rankingu", "mecze w rankingu", "meczów w rankingu")] : []),
].join(" · ");

async function call(method: "GET" | "POST", id: string, body?: object) {
  const token = await auth.currentUser!.getIdToken();
  const r = await fetch(method === "GET" ? `/api/account/merge?id=${encodeURIComponent(id)}` : "/api/account/merge", {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify({ id, ...body }) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Spróbuj jeszcze raz.");
  return j;
}

export function AccountMergeDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { toast } = useToast();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [keep, setKeep] = useState<Record<string, Keep>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { call("GET", id).then(setPreview).catch(e => setError((e as Error).message)); }, [id]);

  const both = preview?.tournaments.filter(t => t.mine) ?? [];
  const ready = !!preview && both.every(t => keep[t.key]);

  const merge = async () => {
    setBusy(true); setError(null);
    try {
      await call("POST", id, { keep });
      toast({ title: "Konta połączone", description: "Discord jest teraz połączony z tym kontem." });
      onClose();
      window.location.reload();
    } catch (e) { setError((e as Error).message); setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={o => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Połączyć konta?</DialogTitle>
          <DialogDescription>
            {preview
              ? <>Discord <b>@{preview.discord.username}</b> ma już osobne konto na stronie. Wszystko z niego przejdzie tutaj, a tamto konto zostanie usunięte.</>
              : error ? null : "Wczytuję tamto konto…"}
          </DialogDescription>
        </DialogHeader>

        {preview && (
          <div className="divide-y border-y text-sm">
            {preview.tournaments.map(t => t.mine ? (
              <div key={t.key} className="py-3">
                <div className="font-bold">{t.name}: zostaw jedną kolekcję kart</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {([["mine", "Na tym koncie", t.mine], ["other", "Z Discorda", t.other]] as const).map(([k, label, p]) => (
                    <button key={k} type="button" onClick={() => setKeep({ ...keep, [t.key]: k })}
                      className={`text-left rounded-md border px-3 py-2 transition-colors ${keep[t.key] === k ? "border-primary text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
                      <span className={`block font-bold ${keep[t.key] === k ? "text-primary" : ""}`}>{label}</span>
                      <span className="block text-xs">{describe(p)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div key={t.key} className="flex items-baseline justify-between gap-3 py-3">
                <span className="font-bold">Karty · {t.name}</span>
                <span className="text-muted-foreground text-right">{describe(t.other)}</span>
              </div>
            ))}
            {preview.steam && (
              <div className="flex items-baseline justify-between gap-3 py-3">
                <span className="font-bold">Steam</span>
                <span className="text-muted-foreground text-right">{preview.steam === "moves" ? "przejdzie tutaj" : "zostanie odłączony, to konto ma już swój"}</span>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm font-bold text-destructive">{error}</p>}

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} disabled={busy} className="h-10 px-4 rounded-md font-bold text-muted-foreground hover:text-foreground disabled:opacity-50">Anuluj</button>
          <button type="button" onClick={merge} disabled={!ready || busy}
            className="h-10 px-5 rounded-md font-bold bg-primary text-primary-foreground transition-[filter] hover:brightness-110 disabled:opacity-50">
            {busy ? "Łączę…" : "Połącz konta"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
