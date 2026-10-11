"use client";

// A diploma that is always exactly one A4 landscape sheet (297 × 210 mm).
//
// - The card has a fixed sheet size; the on-screen preview is the same card scaled to the
//   available width, so what you see is what prints.
// - Content that doesn't fit (long names, extra lines) is scaled down to fit the sheet instead
//   of overflowing — measured on the preview, applied to the print copy.
// - Printing uses a copy portalled to <body>; everything else is display:none'd, so the
//   printed document is just this one sheet (the old visibility:hidden approach kept the rest
//   of the page's height and repeated a position:fixed card on every page → 2+ pages).

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import type { TournamentTheme, DivisionConfig } from "@/types/tournament";

/** A4 landscape at CSS 96 dpi: 297 mm × 210 mm */
export const SHEET_WIDTH_PX = (297 / 25.4) * 96;
export const SHEET_HEIGHT_PX = (210 / 25.4) * 96;

const PRINT_CSS = `
  .diploma-print-portal { display: none; }
  @page { size: A4 landscape; margin: 0; }
  @media print {
    /* 0.5 mm under the paper height: a sheet of exactly 210 mm rounds to 794 px > 793.7 px
       and spills a sliver onto a second page. */
    html, body {
      margin: 0 !important; padding: 0 !important;
      width: 297mm !important; height: 209.5mm !important; min-height: 0 !important;
      overflow: hidden !important; background: #fff !important;
    }
    body > *:not(.diploma-print-portal) { display: none !important; }
    .diploma-print-portal {
      display: block !important;
      width: 297mm; height: 209.5mm; overflow: hidden;
      break-after: avoid; page-break-after: avoid;
    }
    .diploma-print-portal .diploma-card { height: 100% !important; }
    .diploma-print-portal, .diploma-print-portal * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
`;

export interface DiplomaContentProps {
  theme: TournamentTheme;
  tournamentName: string;
  playerName: string;
  teamName: string;
  /** "I. Miejsca" / "II. Miejsca" … or a custom freeform award title */
  place: string;
  /** True when place was typed in the custom field (no "za zajęcie" prefix) */
  isCustomPlace: boolean;
  date: string;
  organizerName: string;
  organizerLogoUrl?: string | null;
  division?: DivisionConfig | null;
  isPlaceholder?: boolean;
}

/** Preview (scaled to fit the page width) + the print copy. */
export function PrintableDiploma(props: DiplomaContentProps) {
  const [fitScale, setFitScale] = useState(1);
  const [previewScale, setPreviewScale] = useState(0.75);
  const [mounted, setMounted] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Preview: scale the fixed-size sheet to the available width
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const update = () => {
      if (wrap.clientWidth > 0) setPreviewScale(wrap.clientWidth / SHEET_WIDTH_PX); // 0 while printing
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // Content: shrink to fit the sheet when it's taller than the available area.
  // offsetHeight ignores transforms, so this measures the natural size.
  useLayoutEffect(() => {
    const area = areaRef.current;
    const content = contentRef.current;
    if (!area || !content) return;
    const update = () => {
      const style = getComputedStyle(area);
      const available = area.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const natural = content.offsetHeight;
      // When printing, the preview is display:none and measures 0 — keep the last real
      // value instead of resetting, or the print copy would come out unscaled.
      if (natural <= 0 || available <= 0) return;
      setFitScale(Math.min(1, available / natural));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(area);
    ro.observe(content);
    return () => ro.disconnect();
  }, []);

  return (
    <>
      <style>{PRINT_CSS}</style>

      <div
        ref={wrapRef}
        className="diploma-preview w-full max-w-[1123px] mx-auto relative"
        style={{ aspectRatio: "297 / 210", boxShadow: "0 40px 80px rgba(0,0,0,0.6)" }}
      >
        <div
          className="absolute top-0 left-0"
          style={{ width: SHEET_WIDTH_PX, height: SHEET_HEIGHT_PX, transform: `scale(${previewScale})`, transformOrigin: "top left" }}
        >
          <DiplomaCard {...props} fitScale={fitScale} areaRef={areaRef} contentRef={contentRef} />
        </div>
      </div>

      {mounted && createPortal(
        <div className="diploma-print-portal" aria-hidden="true">
          <DiplomaCard {...props} fitScale={fitScale} />
        </div>,
        document.body,
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// DiplomaCard — one A4 landscape sheet
// ---------------------------------------------------------------------------

function DiplomaCard({
  theme,
  tournamentName,
  playerName,
  teamName,
  place,
  isCustomPlace,
  date,
  organizerName,
  organizerLogoUrl = null,
  division = null,
  isPlaceholder = false,
  fitScale,
  areaRef,
  contentRef,
}: DiplomaContentProps & {
  fitScale: number;
  areaRef?: RefObject<HTMLDivElement>;
  contentRef?: RefObject<HTMLDivElement>;
}) {
  const primary = theme.primaryColor || "#8B1538";
  const secondary = theme.secondaryColor || "#D4AF37";
  const bg = theme.backgroundColor || "#0a0a0f";
  const text = theme.textColor || "#ffffff";
  const headerFont = theme.headerFont ? `var(${theme.headerFont})` : "inherit";
  const breakText = { overflowWrap: "anywhere" as const };

  return (
    <div
      className="diploma-card relative overflow-hidden"
      style={{
        width: "297mm",
        height: "210mm",
        background: bg,
        color: text,
        fontFamily: theme.bodyFont ? `var(${theme.bodyFont})` : "inherit",
      }}
    >
      {/* Inner frame (inside the sheet, so it survives printing edge-to-edge) */}
      <div
        className="absolute pointer-events-none"
        style={{ inset: 10, border: `1.5px solid ${secondary}50`, boxShadow: `0 0 0 6px ${bg}, 0 0 0 7.5px ${secondary}30` }}
        aria-hidden="true"
      />

      {/* Top accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{ background: `linear-gradient(90deg, transparent 0%, ${secondary} 30%, ${primary} 50%, ${secondary} 70%, transparent 100%)` }}
        aria-hidden="true"
      />

      <CornerOrnament position="top-left" primary={primary} secondary={secondary} />
      <CornerOrnament position="top-right" primary={primary} secondary={secondary} />
      <CornerOrnament position="bottom-left" primary={primary} secondary={secondary} />
      <CornerOrnament position="bottom-right" primary={primary} secondary={secondary} />

      {/* Subtle radial glow from top */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 80% 40% at 50% -10%, ${primary}15 0%, transparent 70%)` }}
        aria-hidden="true"
      />

      {/* ── Content area: centred, scaled down if it doesn't fit ───────────── */}
      <div
        ref={areaRef}
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ padding: "44px 88px 40px" }}
      >
        <div
          ref={contentRef}
          className="relative z-10 flex flex-col items-center w-full gap-5 text-center"
          style={{ transform: `scale(${fitScale})`, transformOrigin: "center center" }}
        >
          {/* Logo */}
          {theme.logoUrl && (
            <Image
              src={theme.logoUrl}
              alt={tournamentName}
              width={320}
              height={150}
              className="object-contain mb-1"
              style={{ maxHeight: 150, width: "auto", filter: "drop-shadow(0 0 24px rgba(255,255,255,0.15))" }}
              unoptimized
            />
          )}

          {/* ── DYPLOM ── */}
          <div>
            <h1
              className="uppercase leading-none"
              style={{
                fontFamily: headerFont,
                fontSize: 72,
                letterSpacing: "0.4em",
                marginRight: "-0.4em", // letter-spacing adds trailing space; keep the word centred
                color: secondary,
                textShadow: `0 0 40px ${secondary}60, 0 0 80px ${secondary}25`,
              }}
            >
              Dyplom
            </h1>
            <div className="flex items-center justify-center gap-3 mt-3">
              <DiamondRule color={secondary} />
            </div>
          </div>

          {/* ── Player name ── */}
          <p
            className="uppercase leading-tight mt-1"
            style={{
              fontFamily: headerFont,
              fontSize: 52,
              letterSpacing: "0.08em",
              color: text,
              textShadow: `0 0 30px ${text}20`,
              opacity: isPlaceholder ? 0.3 : 1,
              ...breakText,
            }}
          >
            {playerName}
          </p>

          {/* ── Team ── */}
          <div style={{ opacity: isPlaceholder ? 0.3 : 1 }}>
            <p className="text-sm tracking-[0.25em] uppercase" style={{ color: `${text}50` }}>
              reprezentującego drużynę
            </p>
            <p
              className="mt-1 text-2xl tracking-wide font-semibold"
              style={{ color: primary, fontFamily: headerFont, textShadow: `0 0 20px ${primary}50`, ...breakText }}
            >
              {teamName}
            </p>
          </div>

          {/* ── za zajęcie / place ── */}
          <div className="flex flex-col items-center gap-3 mt-1" style={{ opacity: isPlaceholder ? 0.3 : 1 }}>
            {!isCustomPlace && (
              <p className="text-sm tracking-[0.25em] uppercase" style={{ color: `${text}50` }}>
                za zajęcie
              </p>
            )}
            {/* Place badge — angular clip matching site CTAs */}
            <div
              className="px-12 py-3 max-w-full"
              style={{
                clipPath: "polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)",
                background: `${secondary}12`,
                outline: `1.5px solid ${secondary}70`,
                boxShadow: `inset 0 0 30px ${secondary}08, 0 0 30px ${secondary}20`,
              }}
            >
              <span
                className="uppercase"
                style={{
                  fontFamily: headerFont,
                  fontSize: 32,
                  letterSpacing: "0.25em",
                  color: secondary,
                  textShadow: `0 0 20px ${secondary}80`,
                  ...breakText,
                }}
              >
                {place}
              </span>
            </div>
          </div>

          {/* ── w turnieju ── */}
          <div className="flex flex-col items-center gap-0.5">
            <p className="text-sm tracking-[0.25em] uppercase font-normal" style={{ color: `${text}50` }}>
              w
            </p>
            <p className="text-2xl font-semibold tracking-wide" style={{ color: text, ...breakText }}>
              {tournamentName}
            </p>
          </div>

          {/* ── Division (league only) ── */}
          {division && (
            <p
              className="text-lg font-semibold tracking-[0.2em] uppercase -mt-2"
              style={{
                color: division.color || secondary,
                fontFamily: headerFont,
                textShadow: `0 0 20px ${division.color || secondary}60`,
              }}
            >
              Dywizja {division.name}
            </p>
          )}

          {/* ── Footer ── */}
          <div
            className="w-full flex justify-between items-end mt-4 pt-6 text-xs tracking-wider uppercase gap-6 text-left"
            style={{ borderTop: `1px solid ${secondary}20`, color: `${text}40` }}
          >
            <span className="min-w-0 truncate">{tournamentName}</span>
            <span className="shrink-0">{date}</span>
            {organizerLogoUrl ? (

              <img src={organizerLogoUrl} alt={organizerName} style={{ height: 22, objectFit: "contain", opacity: 0.7 }} />
            ) : (
              <span className="min-w-0 truncate" style={{ color: `${secondary}80` }}>{organizerName}</span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom accent bar */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent 0%, ${secondary}40 50%, transparent 100%)` }}
        aria-hidden="true"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// DiamondRule — decorative divider under DYPLOM
// ---------------------------------------------------------------------------

function DiamondRule({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-2" style={{ color }}>
      <div className="h-px w-24" style={{ background: `linear-gradient(to left, ${color}80, transparent)` }} />
      <span className="text-[10px] tracking-[0.3em] uppercase font-mono" style={{ color: `${color}90` }}>
        dla gracza
      </span>
      <div className="h-px w-24" style={{ background: `linear-gradient(to right, ${color}80, transparent)` }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// CornerOrnament — L-bracket with a primary-colored inner dot
// ---------------------------------------------------------------------------

function CornerOrnament({
  position,
  primary,
  secondary,
}: {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  primary: string;
  secondary: string;
}) {
  const isTop = position.startsWith("top");
  const isLeft = position.endsWith("left");
  const posClass =
    position === "top-left" ? "top-6 left-6"
      : position === "top-right" ? "top-6 right-6"
        : position === "bottom-left" ? "bottom-6 left-6"
          : "bottom-6 right-6";
  const d = isTop
    ? isLeft ? "M 22 2 L 2 2 L 2 22" : "M 6 2 L 26 2 L 26 22"
    : isLeft ? "M 22 26 L 2 26 L 2 6" : "M 6 26 L 26 26 L 26 6";
  const dotX = isLeft ? 22 : 6;
  const dotY = isTop ? 22 : 6;

  return (
    <div className={`absolute ${posClass}`} aria-hidden="true">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d={d} stroke={secondary} strokeWidth="1.5" />
        <circle cx={dotX} cy={dotY} r="1.5" fill={primary} />
      </svg>
    </div>
  );
}
