"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { AlertCircle, CheckCircle2, Copy, Image as ImageIcon, Link2, Loader2, Play, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { HeroVideo } from '@/components/tournament/HeroVideo';
import {
  HERO_LAYOUT_SLOTS,
  HERO_SLOT_VIDEO_SHAPE,
  checkExternalVideoUrl,
  checkHeroUploadFile,
  checkHeroVideoMetadata,
  checkHeroVideoSize,
  loadVideoMetadata,
  type HeroVideoCheck,
} from '@/lib/hero-video';
import { buildHeroVideoHostingPrompt } from '@/lib/hero-video-hosting-prompt';
import { parseBunnyStreamLink, resolveBunnyStreamLink } from '@/lib/bunny-stream-link';
import { fetchHeroVideoStatus, uploadHeroVideoToBunny } from '@/lib/hero-video-bunny-client';
import {
  uploadTournamentHeroLeftImage,
  uploadTournamentHeroRightImage,
  uploadTournamentPromotionalImage,
} from '@/lib/storage';
import type { HeroLayout, HeroMediaSlot, HeroSlotMedia, HeroSlotVideo } from '@/types/tournament';

type HeroMedia = Partial<Record<HeroMediaSlot, HeroSlotMedia>>;

interface HeroPanelsEditorProps {
  layout: HeroLayout;
  tournamentSlug: string;
  tournamentName: string;
  heroMedia: HeroMedia;
  /** A state setter: async upload results are applied as updaters so they can't clobber later edits. */
  onHeroMediaChange: Dispatch<SetStateAction<HeroMedia>>;
  crt: boolean;
  onCrtChange: (crt: boolean) => void;
  logoUrl: string;
  promoImageUrl: string;
  onPromoImageUrlChange: (url: string) => void;
  leftImageUrl: string;
  onLeftImageUrlChange: (url: string) => void;
  rightImageUrl: string;
  onRightImageUrlChange: (url: string) => void;
  /** Super admins upload to the platform's Bunny library; everyone else pastes a link. */
  canUploadToBunny: boolean;
  getToken: () => Promise<string>;
  /** Reported so the tab can delete uploads that end up unused when it saves. */
  onBunnyVideoUploaded: (videoId: string) => void;
}

const SLOT_LABELS: Record<HeroMediaSlot, (layout: HeroLayout) => string> = {
  logo: (layout) => (layout === 'three-images' ? 'Środek — logo' : 'Lewy panel — logo'),
  promo: () => 'Prawy panel — obraz promocyjny',
  left: () => 'Lewy panel',
  right: () => 'Prawy panel',
  full: () => 'Wideo',
};

const SLOT_UPLOAD_TITLES: Record<HeroMediaSlot, string> = {
  logo: 'logo',
  promo: 'promo',
  left: 'lewy panel',
  right: 'prawy panel',
  full: 'pełna szerokość',
};

/**
 * Per-panel editor for the home page hero: for each panel the chosen layout
 * renders, an image/video switch and the matching field. Lives outside
 * GeneralTab to keep that file from growing further; GeneralTab owns the state
 * and saves it.
 */
export function HeroPanelsEditor(props: HeroPanelsEditorProps) {
  const { layout, heroMedia, onHeroMediaChange, crt, onCrtChange } = props;
  const slots = HERO_LAYOUT_SLOTS[layout];

  const updateSlot = (slot: HeroMediaSlot, patch: Partial<HeroSlotMedia>) =>
    onHeroMediaChange((prev) => ({ ...prev, [slot]: { ...prev[slot], ...patch } }));

  const anyVideo = slots.some((slot) => slot === 'full' || heroMedia[slot]?.type === 'video');

  return (
    <div className="space-y-4 pt-2">
      {slots.map((slot) => {
        const isVideo = slot === 'full' || heroMedia[slot]?.type === 'video';
        return (
          <div key={slot} className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Label className="font-logik-extended-bold">{SLOT_LABELS[slot](layout)}</Label>
              {slot !== 'full' && (
                <SegmentedToggle
                  value={isVideo ? 'video' : 'image'}
                  options={[['image', 'Obraz'], ['video', 'Wideo']]}
                  onChange={(type) => updateSlot(slot, { type })}
                />
              )}
            </div>
            {isVideo ? (
              <HeroVideoField
                slot={slot}
                crt={crt}
                value={heroMedia[slot]?.video}
                onChange={(video) => updateSlot(slot, { video })}
                canUploadToBunny={props.canUploadToBunny}
                getToken={props.getToken}
                uploadTitle={`${props.tournamentName} — ${SLOT_UPLOAD_TITLES[slot]}`}
                onBunnyVideoUploaded={props.onBunnyVideoUploaded}
              />
            ) : (
              <SlotImage slot={slot} {...props} />
            )}
          </div>
        );
      })}

      {anyVideo && (
        <div className="flex items-center gap-3">
          <Switch checked={crt} onCheckedChange={onCrtChange} id="hero-video-crt" />
          <Label htmlFor="hero-video-crt" className="font-logik cursor-pointer">
            Efekt monitora CRT na wideo (linie, winieta, migotanie)
          </Label>
        </div>
      )}
    </div>
  );
}

function SegmentedToggle<T extends string>({ value, options, onChange }: {
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border p-1 gap-1">
      {options.map(([option, label]) => (
        <Button
          key={option}
          type="button"
          size="sm"
          variant={value === option ? 'default' : 'ghost'}
          onClick={() => onChange(option)}
          className="font-logik h-7"
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

function SlotImage({ slot, ...props }: { slot: HeroMediaSlot } & HeroPanelsEditorProps) {
  switch (slot) {
    case 'logo':
      return (
        <div className="flex items-center gap-3">
          <div className="h-20 w-32 rounded-xl border-2 border-border overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
            {props.logoUrl
              ? <img src={props.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
              : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground font-logik">
            Wyświetlane jest logo główne — ustawiasz je wyżej, w sekcji logo.
          </p>
        </div>
      );
    case 'promo':
      return (
        <HeroImageField
          value={props.promoImageUrl}
          onChange={props.onPromoImageUrlChange}
          upload={(file) => uploadTournamentPromotionalImage(file, props.tournamentSlug)}
          placeholder="URL obrazu promocyjnego..."
          hint="Obraz wyświetlany na stronie głównej turnieju obok logo. Najlepiej w proporcjach 16:9 lub 3:2."
        />
      );
    case 'left':
      return (
        <HeroImageField
          value={props.leftImageUrl}
          onChange={props.onLeftImageUrlChange}
          upload={(file) => uploadTournamentHeroLeftImage(file, props.tournamentSlug)}
          placeholder="URL lewego obrazu..."
          hint="Wyrównany do lewej krawędzi ekranu. Zalecany format portretowy lub kwadratowy."
        />
      );
    case 'right':
      return (
        <HeroImageField
          value={props.rightImageUrl}
          onChange={props.onRightImageUrlChange}
          upload={(file) => uploadTournamentHeroRightImage(file, props.tournamentSlug)}
          placeholder="URL prawego obrazu..."
          hint="Wyrównany do prawej krawędzi ekranu. Zalecany format portretowy lub kwadratowy."
        />
      );
    case 'full':
      return null;
  }
}

function HeroImageField({ value, onChange, upload, placeholder, hint }: {
  value: string;
  onChange: (url: string) => void;
  upload: (file: File) => Promise<string>;
  placeholder: string;
  hint: string;
}) {
  const [uploading, setUploading] = useState(false);

  const pick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/webp,image/jpeg';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        onChange(await upload(file));
      } catch (err) {
        console.error('Hero image upload failed:', err);
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {value ? (
          <div className="h-20 w-32 rounded-xl border-2 border-border overflow-hidden bg-muted flex-shrink-0">
            <img src={value} alt="" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="h-20 w-32 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/50 flex-shrink-0">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 space-y-2">
          <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="font-logik" />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={uploading} onClick={pick} className="font-logik">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
              Prześlij plik
            </Button>
            {value && (
              <Button variant="ghost" size="sm" onClick={() => onChange('')} className="text-destructive">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground font-logik">{hint}</p>
    </div>
  );
}

type UploadPhase =
  | { kind: 'idle' }
  | { kind: 'uploading'; progress: number }
  | { kind: 'processing'; progress: number }
  | { kind: 'failed'; message: string };

const POLL_INTERVAL_MS = 4000;
const POLL_GIVE_UP_MS = 20 * 60 * 1000;

/**
 * A panel's video: upload to the platform's Bunny library (super admins) or a
 * link to a file the organizer hosts (everyone).
 */
function HeroVideoField({ slot, crt, value, onChange, canUploadToBunny, getToken, uploadTitle, onBunnyVideoUploaded }: {
  slot: HeroMediaSlot;
  crt: boolean;
  value: HeroSlotVideo | undefined;
  onChange: (video: HeroSlotVideo | undefined) => void;
  canUploadToBunny: boolean;
  getToken: () => Promise<string>;
  uploadTitle: string;
  onBunnyVideoUploaded: (videoId: string) => void;
}) {
  const [mode, setMode] = useState<'upload' | 'link'>(
    canUploadToBunny && (value?.bunnyVideoId || !value?.url) ? 'upload' : 'link',
  );
  const effectiveMode = canUploadToBunny ? mode : 'link';
  // No preview for a link already known not to be a playable file (e.g. YouTube).
  const previewable = !!value?.url && !checkExternalVideoUrl(value.url).error;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row items-start gap-4">
        {previewable ? (
          /* Real component, so the preview shows the edge fade and CRT exactly as visitors will. */
          <HeroVideo
            src={value!.url}
            poster={value!.posterUrl || undefined}
            crt={crt}
            className="w-56 aspect-video rounded-lg bg-black/60 flex-shrink-0"
          />
        ) : (
          <div className="w-56 aspect-video rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/50 flex-shrink-0">
            <Play className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-3">
          {canUploadToBunny && (
            <SegmentedToggle
              value={mode}
              options={[['upload', 'Prześlij plik'], ['link', 'Link do pliku']]}
              onChange={setMode}
            />
          )}
          {effectiveMode === 'upload' ? (
            <BunnyUpload
              value={value}
              onChange={onChange}
              getToken={getToken}
              uploadTitle={uploadTitle}
              onBunnyVideoUploaded={onBunnyVideoUploaded}
            />
          ) : (
            <ExternalLink slot={slot} value={value} onChange={onChange} />
          )}
          {!value?.url && (
            <p className="text-xs text-muted-foreground font-logik">
              {slot === 'full'
                ? 'Dopóki nie ma wideo, strona pokazuje układ „Logo + Obraz promocyjny”.'
                : 'Dopóki nie ma wideo, panel pokazuje obraz.'}
            </p>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground font-logik">
        {HERO_SLOT_VIDEO_SHAPE[slot]} Wideo jest zawsze wyciszone i zapętlone. Krawędzie wygaszamy i efekt CRT nakładamy
        na stronie, więc użyj czystego materiału bez własnych ramek.
      </p>
    </div>
  );
}

function BunnyUpload({ value, onChange, getToken, uploadTitle, onBunnyVideoUploaded }: {
  value: HeroSlotVideo | undefined;
  onChange: (video: HeroSlotVideo | undefined) => void;
  getToken: () => Promise<string>;
  uploadTitle: string;
  onBunnyVideoUploaded: (videoId: string) => void;
}) {
  const [phase, setPhase] = useState<UploadPhase>({ kind: 'idle' });
  const [warnings, setWarnings] = useState<string[]>([]);
  // Polling outlives renders; stop it if the tab goes away mid-encode.
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const busy = phase.kind === 'uploading' || phase.kind === 'processing';

  const waitForEncode = async (videoId: string) => {
    const started = Date.now();
    while (alive.current && Date.now() - started < POLL_GIVE_UP_MS) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      if (!alive.current) return;
      const status = await fetchHeroVideoStatus(videoId, getToken);
      if (status.state === 'failed') {
        const reason = status.failureReason ? `: ${status.failureReason}` : '';
        setPhase({
          kind: 'failed',
          message: `Bunny nie zdołał przetworzyć tego pliku${reason}. Spróbuj wyeksportować go jako MP4 (H.264).`,
        });
        return;
      }
      if (status.state === 'ready' && status.url) {
        onChange({ url: status.url, mobileUrl: status.mobileUrl, posterUrl: status.posterUrl, bunnyVideoId: videoId });
        setPhase({ kind: 'idle' });
        return;
      }
      setPhase({ kind: 'processing', progress: status.progress });
    }
    if (alive.current) {
      setPhase({ kind: 'failed', message: 'Przetwarzanie trwa podejrzanie długo. Odśwież stronę za kilka minut i prześlij ponownie.' });
    }
  };

  const pick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const check = checkHeroUploadFile(file);
      if (check.error) {
        setPhase({ kind: 'failed', message: check.error });
        return;
      }
      setWarnings([]);
      // Best effort — the browser may not decode e.g. a HEVC .mov; Bunny will.
      const objectUrl = URL.createObjectURL(file);
      loadVideoMetadata(objectUrl, 5000)
        .then((meta) => { if (meta && alive.current) setWarnings(checkHeroVideoMetadata({ duration: meta.duration })); })
        .finally(() => URL.revokeObjectURL(objectUrl));

      try {
        setPhase({ kind: 'uploading', progress: 0 });
        const videoId = await uploadHeroVideoToBunny(file, uploadTitle, getToken, (p) => {
          if (alive.current) setPhase({ kind: 'uploading', progress: p });
        });
        onBunnyVideoUploaded(videoId);
        if (!alive.current) return;
        setPhase({ kind: 'processing', progress: 0 });
        await waitForEncode(videoId);
      } catch (err) {
        console.error('Hero video upload failed:', err);
        if (alive.current) {
          setPhase({ kind: 'failed', message: err instanceof Error ? err.message : 'Nie udało się przesłać wideo.' });
        }
      }
    };
    input.click();
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={pick} className="font-logik">
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
          {phase.kind === 'uploading'
            ? `Przesyłanie… ${Math.round(phase.progress * 100)}%`
            : phase.kind === 'processing'
              ? `Przetwarzanie… ${phase.progress}%`
              : value?.url ? 'Zmień wideo' : 'Prześlij wideo'}
        </Button>
        {value?.url && !busy && (
          <Button variant="ghost" size="sm" onClick={() => onChange(undefined)} className="text-destructive">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {phase.kind === 'processing' && (
        <p className="text-xs text-muted-foreground font-logik">
          Bunny kompresuje wideo i tworzy wersję na telefony — zwykle trwa to do kilku minut. Nie zamykaj tej strony.
        </p>
      )}
      {phase.kind === 'failed' && <Note tone="error">{phase.message}</Note>}
      {warnings.map((w) => <Note key={w} tone="warning">{w}</Note>)}
      <p className="text-xs text-muted-foreground font-logik">
        Wideo trafia na konto Bunny platformy i jest tam automatycznie kompresowane — możesz wgrać surowy plik z
        edytora. Pętla 10–20 s w zupełności wystarczy.
      </p>
    </div>
  );
}

type LinkCheck =
  | { kind: 'idle' }
  | { kind: 'checking'; label: string }
  | { kind: 'done'; result: HeroVideoCheck; playable: boolean };

function ExternalLink({ slot, value, onChange }: {
  slot: HeroMediaSlot;
  value: HeroSlotVideo | undefined;
  onChange: (video: HeroSlotVideo | undefined) => void;
}) {
  const url = value?.bunnyVideoId ? '' : value?.url ?? '';
  const posterUrl = value?.bunnyVideoId ? '' : value?.posterUrl ?? '';
  const [check, setCheck] = useState<LinkCheck>({ kind: 'idle' });
  const [copied, setCopied] = useState(false);
  // The MP4 a pasted Bunny Stream link was converted to, and what to tell the organizer about it.
  const [converted, setConverted] = useState<{ url: string; note: string } | null>(null);

  // Typing replaces any uploaded (Bunny) video with the organizer's own link;
  // the Bunny file is deleted when the tab saves.
  // The phone rendition belongs to the link it was found for: kept while only
  // the thumbnail is edited, dropped as soon as the link itself changes.
  const setLink = (next: { url?: string; posterUrl?: string }) => {
    const nextUrl = next.url ?? url;
    const nextPoster = next.posterUrl ?? posterUrl;
    const mobileUrl = next.url === undefined && !value?.bunnyVideoId ? value?.mobileUrl : undefined;
    onChange(nextUrl || nextPoster ? { url: nextUrl, mobileUrl, posterUrl: nextPoster || undefined } : undefined);
  };

  // Debounced. A Bunny Stream link is first swapped for its MP4 (plus thumbnail
  // and phone rendition); that URL change re-runs this effect, which then
  // validates the MP4 like any other link: static checks, then actually load it.
  useEffect(() => {
    const trimmed = url.trim();
    if (!trimmed) { setCheck({ kind: 'idle' }); return; }

    const bunny = parseBunnyStreamLink(trimmed);
    if (bunny && converted?.url !== trimmed) {
      let cancelled = false;
      const timer = setTimeout(async () => {
        setCheck({ kind: 'checking', label: 'Wykryto link Bunny Stream — szukam pliku MP4…' });
        const resolved = await resolveBunnyStreamLink(bunny);
        if (cancelled) return;
        if (!resolved.ok) {
          setCheck({ kind: 'done', playable: false, result: { error: resolved.error, warnings: [] } });
          return;
        }
        setConverted({
          url: resolved.url,
          note: `Link Bunny zamieniony na plik MP4 (${resolved.height}p)${resolved.mobileUrl ? ' z lżejszą wersją na telefony' : ''}.`,
        });
        onChange({ url: resolved.url, mobileUrl: resolved.mobileUrl, posterUrl: posterUrl || resolved.posterUrl });
      }, 600);
      return () => { cancelled = true; clearTimeout(timer); };
    }

    const staticCheck = checkExternalVideoUrl(trimmed);
    if (staticCheck.error) { setCheck({ kind: 'done', result: staticCheck, playable: false }); return; }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setCheck({ kind: 'checking', label: 'Sprawdzam link…' });
      const meta = await loadVideoMetadata(trimmed);
      if (cancelled) return;
      if (!meta) {
        setCheck({
          kind: 'done',
          playable: false,
          result: { error: 'Nie udało się odtworzyć wideo z tego linku. Sprawdź, czy otwarty w oknie incognito od razu odtwarza plik.', warnings: [] },
        });
        return;
      }
      const warnings = [...staticCheck.warnings, ...checkHeroVideoMetadata({ duration: meta.duration, width: meta.width })];
      // File size is only readable when the host sends CORS headers.
      try {
        const head = await fetch(trimmed, { method: 'HEAD' });
        warnings.push(...checkHeroVideoSize(Number(head.headers.get('content-length')) || undefined));
      } catch { /* no CORS — skip */ }
      if (!cancelled) setCheck({ kind: 'done', playable: true, result: { warnings } });
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
    // Keyed on the link only: onChange/posterUrl/converted are read at the time it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(buildHeroVideoHostingPrompt(slot));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Clipboard write failed:', err);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => setLink({ url: e.target.value })}
          placeholder="https://…/wideo.mp4"
          className="font-logik"
        />
        {url && (
          <Button variant="ghost" size="sm" onClick={() => onChange(undefined)} className="text-destructive">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <Input
        value={posterUrl}
        onChange={(e) => setLink({ posterUrl: e.target.value })}
        placeholder="Link do miniatury (opcjonalnie) — https://…/miniatura.jpg"
        className="font-logik"
      />
      {check.kind === 'checking' && (
        <p className="text-xs text-muted-foreground font-logik flex items-center gap-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> {check.label}
        </p>
      )}
      {converted && converted.url === url && (
        <p className="text-xs text-muted-foreground font-logik flex items-start gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 mt-px flex-shrink-0" /> {converted.note}
        </p>
      )}
      {check.kind === 'done' && check.playable && (
        <p className="text-xs text-emerald-500 font-logik flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" /> Wideo się odtwarza.
        </p>
      )}
      {check.kind === 'done' && check.result.error && <Note tone="error">{check.result.error}</Note>}
      {check.kind === 'done' && check.result.warnings.map((w) => <Note key={w} tone="warning">{w}</Note>)}

      <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
        <p className="text-xs text-muted-foreground font-logik flex items-start gap-1.5">
          <Link2 className="h-3.5 w-3.5 mt-px flex-shrink-0" />
          Wideo hostujesz sam — wklej bezpośredni link do pliku .mp4. Film w Bunny Stream? Wklej dowolny link do niego
          („Direct play URL” albo „HLS Playlist URL”) — sami znajdziemy plik MP4 i miniaturę. Nie wiesz jak przygotować
          wideo? Kliknij przycisk, wklej skopiowany tekst do dowolnego czatu AI (ChatGPT, Claude, Gemini…), a
          przeprowadzi Cię przez kompresję, wybór hostingu i sprawdzenie linku krok po kroku.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={copyPrompt} className="font-logik">
          {copied ? <CheckCircle2 className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
          {copied ? 'Skopiowano!' : 'Kopiuj instrukcję dla AI'}
        </Button>
      </div>
    </div>
  );
}

function Note({ tone, children }: { tone: 'error' | 'warning'; children: React.ReactNode }) {
  return (
    <p className={`text-xs font-logik flex items-start gap-1.5 ${tone === 'error' ? 'text-destructive' : 'text-amber-500'}`}>
      <AlertCircle className="h-3.5 w-3.5 mt-px flex-shrink-0" />
      {children}
    </p>
  );
}
