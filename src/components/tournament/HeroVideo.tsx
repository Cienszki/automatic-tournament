"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { readPlaybackEnvironment, shouldPlayHeroVideo } from '@/lib/hero-video';
import { useSignalHeroMediaReady } from '@/context/HeroMediaGateContext';

export type HeroVideoEdge = 'left' | 'right' | 'top' | 'bottom';
type Edge = HeroVideoEdge;

interface HeroVideoProps {
  /** The video's identity — what the loading gate waits for — and what wide screens play. */
  src: string;
  /** Lighter rendition for narrow screens, when one exists. */
  mobileSrc?: string;
  poster?: string;
  /**
   * The panel's own image. Shown when the video can't load at all (host down,
   * blocked by the host's domain allowlist) — the poster usually lives on the
   * same host and fails with it.
   */
  fallbackImage?: string;
  /** Scanlines + vignette + slow flicker drawn over the video in CSS. */
  crt: boolean;
  /** Edges that fade into the page. Defaults to all four; drop one for a panel that meets another at a seam. */
  fade?: readonly Edge[];
  /** Sizing of the masked box — the video always covers it. */
  className?: string;
}

const ALL_EDGES: readonly Edge[] = ['left', 'right', 'top', 'bottom'];

/**
 * Looping, muted background video for the home page hero.
 *
 * The look is done here rather than baked into the file: the edge fade is a CSS
 * mask (MP4 has no alpha channel, so a file can't fade into our background
 * image), and the CRT layer is plain gradients, which stay crisp at any size
 * and cost the compositor nothing. See `.hero-video` in globals.css.
 */
export function HeroVideo({ src, mobileSrc, poster, fallbackImage, crt, fade = ALL_EDGES, className }: HeroVideoProps) {
  const signalGate = useSignalHeroMediaReady();
  const signalReady = useCallback(() => signalGate(src), [signalGate, src]);
  // An unfaded edge is a 0% ramp in the mask (see .hero-video in globals.css).
  const fadeStyle = Object.fromEntries(
    ALL_EDGES.filter((edge) => !fade.includes(edge)).map((edge) => [`--hero-fade-${edge}`, '0%']),
  ) as React.CSSProperties;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // The home page only renders once the tournament has loaded on the client,
  // so reading browser state in the initializer can't cause a hydration mismatch.
  const [play] = useState(() => typeof window !== 'undefined' && shouldPlayHeroVideo(readPlaybackEnvironment()));
  const [narrow] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);
  const playSrc = narrow && mobileSrc ? mobileSrc : src;
  // Keyed by source so a new video (e.g. in the admin preview) gets a fresh try.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === playSrc;
  const handleVideoError = useCallback(() => {
    setFailedSrc(playSrc);
    signalReady();
  }, [playSrc, signalReady]);

  // Muted must be a DOM property before play() or autoplay policies reject it;
  // React's `muted` prop is not reliably applied in time.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    if (video.readyState >= 2) signalReady();
    video.play().catch(() => { /* autoplay refused — the poster stays up */ });
  }, [playSrc, signalReady]);

  // Stop decoding while the hero is scrolled away — the snap-scroll sections
  // stay mounted, and a hidden 1080p loop would keep a phone's GPU busy.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const video = videoRef.current;
    if (!wrapper || !video || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) video.play().catch(() => {});
      else video.pause();
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [playSrc]);

  return (
    <div ref={wrapperRef} className={cn('hero-video', className)} style={fadeStyle}>
      {play && !failed ? (
        <video
          ref={videoRef}
          key={playSrc}
          src={playSrc}
          poster={poster}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
          aria-hidden="true"
          onLoadedData={signalReady}
          onCanPlay={signalReady}
          onError={handleVideoError}
        />
      ) : (
        <StillImage
          // After a failed video the panel image goes first: the poster is
          // usually on the same host and fails the same way.
          candidates={failed ? [fallbackImage, poster] : [poster, fallbackImage]}
          onSettled={signalReady}
        />
      )}
      {crt && <div className="hero-video__crt" aria-hidden="true" />}
    </div>
  );
}

/**
 * Still frame instead of the video: the first candidate that loads. Renders
 * nothing (and just releases the loading gate) when none is available.
 */
function StillImage({ candidates, onSettled }: { candidates: (string | undefined)[]; onSettled: () => void }) {
  const urls = candidates.filter((url, i): url is string => !!url && candidates.indexOf(url) === i);
  const [index, setIndex] = useState(0);
  const src = urls[index];
  useEffect(() => { if (!src) onSettled(); }, [src, onSettled]);
  if (!src) return null;
  return (
    // Plain <img>: posters are already right-sized JPEGs.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src}
      alt=""
      aria-hidden="true"
      ref={(img) => { if (img?.complete && img.naturalWidth > 0) onSettled(); }}
      onLoad={onSettled}
      onError={() => (index + 1 < urls.length ? setIndex(index + 1) : onSettled())}
    />
  );
}
