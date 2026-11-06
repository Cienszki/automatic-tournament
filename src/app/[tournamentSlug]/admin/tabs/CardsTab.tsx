"use client";

// Admin → Karty: the card game's settings (packs after each round, the "how to get more cards"
// text, Twitch channels) and giving packs by hand (Discord contests, Twitch subs, channel points).
// Talks to /api/manage/cards.

import React, { useCallback, useEffect, useState } from 'react';
import { GalleryVerticalEnd, Gift, Loader2, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTournament } from '@/context/TournamentContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { roundWord, type CardSettings } from '@/lib/card-lab/settings';
import { count } from '@/lib/plural';

interface Found { uid: string; name: string; discord: string | null; avatar: string | null }
interface Grant { id: string; kind: 'round' | 'admin'; label: string | null; reason: string | null; n: number; uids: number; names: string[]; at: number }

function Pic({ src, name }: { src: string | null; name: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover shrink-0" />
    : <span className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center bg-white/10 text-sm font-bold">{name.slice(0, 1).toUpperCase()}</span>;
}

const packs = (n: number) => count(n, 'paczka', 'paczki', 'paczek');
const when = (at: number) => (at ? new Date(at).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

export function CardsTab() {
  const { user } = useAuth();
  const { tournament, theme } = useTournament();
  const { toast } = useToast();
  const [settings, setSettings] = useState<CardSettings | null>(null);
  const [channelsText, setChannelsText] = useState('');
  const [fallback, setFallback] = useState('');
  const [history, setHistory] = useState<Grant[]>([]);
  const [saving, setSaving] = useState(false);
  // Giving packs
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Found[]>([]);
  const [picked, setPicked] = useState<Found[]>([]);
  const [n, setN] = useState(1);
  const [reason, setReason] = useState('');
  const [giving, setGiving] = useState(false);

  const call = useCallback(async (method: 'GET' | 'PUT' | 'POST', arg?: string | object) => {
    const token = await user!.getIdToken();
    const qs = method === 'GET' ? `?tournamentId=${encodeURIComponent(tournament!.id)}${arg ? `&q=${encodeURIComponent(String(arg))}` : ''}` : '';
    const r = await fetch(`/api/manage/cards${qs}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify({ tournamentId: tournament!.id, ...(arg as object) }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Coś poszło nie tak');
    return j;
  }, [user, tournament]);

  useEffect(() => {
    if (!user || !tournament?.id) return;
    call('GET').then(j => { setSettings(j.settings); setChannelsText(j.settings.twitchChannels.join(', ')); setFallback(j.defaultHowTo); setHistory(j.grants); })
      .catch(e => toast({ title: 'Błąd', description: e.message, variant: 'destructive' }));
  }, [user, tournament?.id, call, toast]);

  // Search as you type
  useEffect(() => {
    const v = q.trim();
    if (v.length < 2) { setFound([]); return; }
    const t = setTimeout(() => call('GET', v).then(j => setFound(j.found ?? [])).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q, call]);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const twitchChannels = channelsText.split(/[\s,]+/).map(c => c.replace(/^https?:\/\/(www\.)?twitch\.tv\//i, '').replace(/\/.*$/, '')).filter(Boolean);
      const j = await call('PUT', { settings: { ...settings, twitchChannels } });
      setSettings(j.settings); setChannelsText(j.settings.twitchChannels.join(', '));
      toast({ title: 'Zapisano' });
    } catch (e) { toast({ title: 'Nie zapisano', description: (e as Error).message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const give = async () => {
    setGiving(true);
    try {
      const j = await call('POST', { uids: picked.map(p => p.uid), n, reason });
      setHistory(j.grants);
      toast({ title: `Dano ${packs(n)}`, description: picked.map(p => p.name).join(', ') });
      setPicked([]); setReason(''); setQ(''); setFound([]);
    } catch (e) { toast({ title: 'Nie dano paczek', description: (e as Error).message, variant: 'destructive' }); }
    finally { setGiving(false); }
  };

  const w = roundWord(tournament?.type);
  const chosen = new Set(picked.map(p => p.uid));
  if (!settings) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground m-6" />;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <GalleryVerticalEnd className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Gra karciana
          </CardTitle>
          <CardDescription className="font-logik">Każdy gracz dostaje 10 paczek na start. Reszta zależy od tych ustawień.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="round-packs">Paczki dla wszystkich po {w.after}</Label>
            <Input id="round-packs" type="number" min={0} max={20} value={settings.roundPacks} className="w-28"
              onChange={e => setSettings({ ...settings, roundPacks: Math.max(0, Math.min(20, Math.round(Number(e.target.value) || 0))) })} />
            <p className="text-xs text-muted-foreground">Dostaje je każdy, kto ma już karty, gdy wszystkie mecze są rozegrane i znamy {w.team}. 0 = wyłączone.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="how-to">„Jak zdobyć więcej kart?”</Label>
            <Textarea id="how-to" rows={5} value={settings.howTo} placeholder={fallback} maxLength={1500}
              onChange={e => setSettings({ ...settings, howTo: e.target.value })} />
            <p className="text-xs text-muted-foreground">Gracze widzą to po najechaniu na „Jak zdobyć więcej kart?” nad talią. Puste pole = tekst podpowiedzi.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="twitch">Kanały na Twitchu</Label>
            <Input id="twitch" value={channelsText} placeholder="np. dota2inhouse, innykanal" onChange={e => setChannelsText(e.target.value)} />
            <p className="text-xs text-muted-foreground">Kanały, które transmitują ten turniej. Na razie tylko je zapisujemy: paczki za punkty kanału dawaj niżej.</p>
          </div>
          <Button onClick={save} disabled={saving} style={{ backgroundColor: theme.primaryColor }} className="text-white">
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Zapisz
          </Button>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <Gift className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Daj paczki
          </CardTitle>
          <CardDescription className="font-logik">Za konkursy na Discordzie, suba albo punkty kanału na Twitchu. Gracz dostaje powiadomienie z powodem.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Nick albo nazwa na Discordzie…" />
            {found.length > 0 && (
              <div className="mt-2 divide-y divide-border border-y border-border">
                {found.map(f => (
                  <button key={f.uid} type="button" disabled={chosen.has(f.uid) || picked.length >= 50}
                    onClick={() => { setPicked(p => [...p, f]); setQ(''); setFound([]); }}
                    className="w-full flex items-center gap-3 py-2 text-left hover:bg-white/5 disabled:opacity-50">
                    <Pic src={f.avatar} name={f.name} />
                    <span className="flex-1 min-w-0">
                      <span className="block font-bold truncate">{f.name}</span>
                      {f.discord && <span className="block text-xs text-muted-foreground">@{f.discord}</span>}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: theme.primaryColor }}>{chosen.has(f.uid) ? 'Wybrany' : 'Wybierz'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {picked.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {picked.map(p => (
                <span key={p.uid} className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-2 py-1 bg-white/5 text-sm">
                  <Pic src={p.avatar} name={p.name} />{p.name}
                  <button type="button" aria-label={`Usuń ${p.name}`} onClick={() => setPicked(x => x.filter(y => y.uid !== p.uid))} className="opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-3 items-end">
            <div className="space-y-2">
              <Label htmlFor="grant-n">Paczek każdemu</Label>
              <Input id="grant-n" type="number" min={1} max={50} value={n} className="w-24" onChange={e => setN(Math.max(1, Math.min(50, Math.round(Number(e.target.value) || 1))))} />
            </div>
            <div className="space-y-2 flex-1">
              <Label htmlFor="grant-why">Za co</Label>
              <Input id="grant-why" value={reason} maxLength={140} placeholder="np. konkurs na Discordzie" onChange={e => setReason(e.target.value)} />
            </div>
          </div>
          <Button onClick={give} disabled={giving || !picked.length} style={{ backgroundColor: theme.primaryColor }} className="text-white">
            {giving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {picked.length ? `Daj ${packs(n)} · ${count(picked.length, 'osoba', 'osoby', 'osób')}` : 'Daj paczki'}
          </Button>

          {history.length > 0 && (
            <div className="pt-2">
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Ostatnio</div>
              <div className="divide-y divide-border">
                {history.map(g => (
                  <div key={g.id} className="py-2 text-sm flex gap-3">
                    <span className="text-muted-foreground tabular-nums shrink-0 w-28">{when(g.at)}</span>
                    <span className="min-w-0">
                      <b>{packs(g.n)}</b>{' '}
                      {g.kind === 'round'
                        ? <>dla wszystkich ({g.uids}) · {g.label}</>
                        : <>· {g.names.join(', ')}{g.reason ? <span className="text-muted-foreground"> · {g.reason}</span> : null}</>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
