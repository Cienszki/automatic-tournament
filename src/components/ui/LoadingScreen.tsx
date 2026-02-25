"use client";

import Image from 'next/image';

interface LoadingScreenProps {
  /** Use true for full-page loading, false for inline section loading */
  fullPage?: boolean;
  /** Override the logo shown. Defaults to pd2ih logo. */
  logoUrl?: string;
  /** Optional label shown below the bar */
  label?: string;
}

/**
 * Unified loading screen used across the entire site.
 * Uses CSS variables so it automatically adapts to the active tournament theme.
 */
export function LoadingScreen({
  fullPage = true,
  logoUrl = '/logos/pd2ih/pd2ih-logo.png',
  label,
}: LoadingScreenProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center bg-background ${
        fullPage ? 'fixed inset-0 z-10' : 'min-h-[400px]'
      }`}
    >
      <div className="flex flex-col items-center gap-7">
        {/* Logo */}
        <Image
          src={logoUrl}
          alt="Logo"
          width={64}
          height={64}
          priority
          className="opacity-80 select-none"
        />

        {/* Shimmer sweep bar */}
        <div className="relative w-40 h-px bg-border overflow-hidden">
          <div className="loading-sweep absolute inset-0 bg-gradient-to-r from-transparent via-primary to-transparent" />
        </div>

        {label && (
          <p className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">
            {label}
          </p>
        )}
      </div>
    </div>
  );
}
