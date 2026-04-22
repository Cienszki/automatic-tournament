"use client";

import Image from 'next/image';

interface LoadingScreenProps {
  /** Use true for full-page loading, false for inline section loading */
  fullPage?: boolean;
  /** Override the logo shown. Defaults to the PD2IH logo. */
  logoUrl?: string;
  /** Optional label shown below the bar */
  label?: string;
  /** Override the container element's className (disables fullPage class logic) */
  containerClassName?: string;
  /** When true, the screen fades out (used for unmount transition) */
  isLeaving?: boolean;
}

/**
 * Unified loading screen used across the entire site.
 *
 * Intentionally uses a stable neutral background regardless of which
 * tournament is loading — the theme CSS vars transition multiple times
 * during context initialisation which would cause visible flickers if we
 * read them here.  The background colour comes from the CSS variable
 * --tournament-background which is written synchronously by the blocking
 * <script> in the root layout (via sessionStorage cache) before React
 * hydrates, so it is already the correct value on the very first paint.
 */
export function LoadingScreen({
  fullPage = true,
  logoUrl,
  label,
  containerClassName,
  isLeaving = false,
}: LoadingScreenProps) {
  const resolvedLogoUrl = logoUrl ?? '/logos/pd2ih/pd2ih-logo.png';

  return (
    <div
      className={containerClassName ?? `flex flex-col items-center justify-center overflow-hidden ${
        fullPage ? 'fixed inset-0 z-[60]' : 'relative min-h-[400px]'
      } transition-opacity duration-[400ms] ${isLeaving ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      style={{ background: 'var(--tournament-background, hsl(240 17% 6%))' }}
    >
      {/* Vignette overlay — subtly darkens edges for depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 85% 75% at 50% 50%, transparent 25%, rgba(0,0,0,0.22) 100%)'
        }}
        aria-hidden="true"
      />

      <div className="flex flex-col items-center gap-7 relative z-10">
        {/* Logo with a soft ambient glow using the tournament primary colour */}
        <div className="relative flex items-center justify-center">
          <div
            className="absolute rounded-full blur-2xl"
            style={{
              width: '96px',
              height: '96px',
              background: 'var(--tournament-primary, var(--primary, rgba(139,21,56,0.4)))',
              opacity: 0.35,
            }}
            aria-hidden="true"
          />
          <Image
            src={resolvedLogoUrl}
            alt="Loading"
            width={64}
            height={64}
            priority
            unoptimized
            className="select-none relative z-10"
          />
        </div>

        {/* Shimmer sweep bar — uses primary colour so it's visible on both
            light themes (wiosenna) and dark themes (PDL). */}
        <div
          className="relative w-40 h-px overflow-hidden"
          style={{ background: 'var(--tournament-border, rgba(128,128,128,0.2))' }}
        >
          <div
            className="loading-sweep absolute inset-0"
            style={{
              // White fallback ensures visibility on the dark default background
              // (first visit, no sessionStorage). Tournament primary color is used
              // once --tournament-primary is set by the sessionStorage script.
              background: 'linear-gradient(90deg, transparent, var(--tournament-primary, rgba(255,255,255,0.85)), transparent)'
            }}
          />
        </div>

        {label && (
          <p
            className="text-[11px] tracking-[0.2em] uppercase"
            style={{ color: 'var(--tournament-muted, rgba(128,128,128,0.7))' }}
          >
            {label}
          </p>
        )}
      </div>
    </div>
  );
}

