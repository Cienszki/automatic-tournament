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

export type DiplomaOrientation = "landscape" | "portrait";

/** A4 sheet in mm and in CSS px (96 dpi) for the given orientation. */
export function sheetSize(orientation: DiplomaOrientation) {
  const [wMm, hMm] = orientation === "portrait" ? [210, 297] : [297, 210];
  return { wMm, hMm, wPx: (wMm / 25.4) * 96, hPx: (hMm / 25.4) * 96 };
}

/**
 * Default "Save as PDF" name: diploma-[tournament]-[player]. Browsers take it from
 * document.title (and add ".pdf"), so it's returned without the extension.
 * Characters Windows/macOS don't allow in file names are dropped.
 */
export function diplomaFileName(tournamentName: string, playerName: string) {
  const clean = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();
  return ["diploma", clean(tournamentName), clean(playerName)].filter(Boolean).join("-");
}

/**
 * Colour with alpha (0x00–0xff, like a hex suffix). color-mix instead of `${color}80`:
 * theme colours may be hsl(...) strings, where a hex suffix is invalid CSS and silently dropped.
 */
function fade(color: string, alpha: number): string {
  return `color-mix(in srgb, ${color.trim()} ${Math.round((alpha / 255) * 100)}%, transparent)`;
}

function printCss(orientation: DiplomaOrientation) {
  const { wMm, hMm } = sheetSize(orientation);
  // Printed height is 0.5 mm under the paper: a sheet of exactly the paper height rounds up
  // (e.g. 210 mm -> 794 px > 793.7 px) and spills a sliver onto a second page.
  const printH = `${hMm - 0.5}mm`;
  return `
  .diploma-print-portal { display: none; }
  @page { size: A4 ${orientation}; margin: 0; }
  @media print {
    html, body {
      margin: 0 !important; padding: 0 !important;
      width: ${wMm}mm !important; height: ${printH} !important; min-height: 0 !important;
      overflow: hidden !important; background: #fff !important;
    }
    body > *:not(.diploma-print-portal) { display: none !important; }
    .diploma-print-portal {
      display: block !important;
      width: ${wMm}mm; height: ${printH}; overflow: hidden;
      break-after: avoid; page-break-after: avoid;
    }
    .diploma-print-portal .diploma-card { height: 100% !important; }
    .diploma-print-portal, .diploma-print-portal * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
`;
}

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
  /** A4 landscape (default) or portrait */
  orientation?: DiplomaOrientation;
  /** White paper: no page fill, dark text, no glows (saves ink; recommended for inkjets) */
  printOnWhite?: boolean;
}

/** Preview (scaled to fit the page width) + the print copy. */
export function PrintableDiploma(props: DiplomaContentProps) {
  const [fitScale, setFitScale] = useState(1);
  const [previewScale, setPreviewScale] = useState(0.75);
  const [mounted, setMounted] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const orientation = props.orientation ?? "landscape";
  const sheet = sheetSize(orientation);

  useEffect(() => setMounted(true), []);

  // Preview: scale the fixed-size sheet to the available width
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const update = () => {
      if (wrap.clientWidth > 0) setPreviewScale(wrap.clientWidth / sheet.wPx); // 0 while printing
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [sheet.wPx]);

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
      <style>{printCss(orientation)}</style>

      <div
        ref={wrapRef}
        className="diploma-preview w-full mx-auto relative"
        style={{
          aspectRatio: `${sheet.wMm} / ${sheet.hMm}`,
          maxWidth: orientation === "portrait" ? 720 : 1123,
          boxShadow: "0 40px 80px rgba(0,0,0,0.6)",
        }}
      >
        <div
          className="absolute top-0 left-0"
          style={{ width: sheet.wPx, height: sheet.hPx, transform: `scale(${previewScale})`, transformOrigin: "top left" }}
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
// DiplomaCard — one A4 sheet
// ---------------------------------------------------------------------------

/** Frame/ornaments sit this far in from the paper edge (~9 mm) — inside the area home printers can print. */
const SAFE_MARGIN_PX = 34;

/** Per-orientation layout: content padding (from the paper edge) and how big the tournament logo may get. */
const LAYOUT = {
  landscape: { padding: "70px 112px 58px", gapClass: "gap-4", logoMaxH: 185, logoMaxW: 560 },
  portrait: { padding: "96px 92px 72px", gapClass: "gap-7", logoMaxH: 280, logoMaxW: 560 },
} as const;

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
  orientation = "landscape",
  printOnWhite = false,
  fitScale,
  areaRef,
  contentRef,
}: DiplomaContentProps & {
  fitScale: number;
  areaRef?: RefObject<HTMLDivElement>;
  contentRef?: RefObject<HTMLDivElement>;
}) {
  const layout = LAYOUT[orientation];
  const primary = theme.primaryColor || "#8B1538";
  const themeSecondary = theme.secondaryColor || "#D4AF37";
  // "Białe tło": no page fill, dark text, no glows — only text, ornaments and logos use ink.
  // Light accents (e.g. gold) are darkened a little so they stay legible on white paper.
  const pageBg = printOnWhite ? "#ffffff" : theme.backgroundColor || "#0a0a0f";
  const text = printOnWhite ? "#1a1a1a" : theme.textColor || "#ffffff";
  const secondary = printOnWhite ? `color-mix(in srgb, ${themeSecondary.trim()} 78%, black)` : themeSecondary;
  const glow = (css: string) => (printOnWhite ? "none" : css);
  // Small labels / footer: faint on a dark page, but they need more ink to read on white paper
  const muted = fade(text, printOnWhite ? 0x99 : 0x50);
  const footerText = fade(text, printOnWhite ? 0x8c : 0x40);
  const headerFont = theme.headerFont ? `var(${theme.headerFont})` : "inherit";
  const breakText = { overflowWrap: "anywhere" as const };

  return (
    <div
      className="diploma-card relative overflow-hidden"
      style={{
        width: `${sheetSize(orientation).wMm}mm`,
        height: `${sheetSize(orientation).hMm}mm`,
        background: pageBg,
        color: text,
        fontFamily: theme.bodyFont ? `var(${theme.bodyFont})` : "inherit",
      }}
    >
      {/* Frame — inset from the paper edge so printer margins can't cut it */}
      <div
        className="absolute pointer-events-none"
        style={{
          inset: SAFE_MARGIN_PX,
          border: `1.5px solid ${fade(secondary, 0x50)}`,
          boxShadow: `0 0 0 6px ${pageBg}, 0 0 0 7.5px ${fade(secondary, 0x30)}`,
        }}
        aria-hidden="true"
      />

      {/* Accent lines along the top and bottom of the frame */}
      <div
        className="absolute h-[3px] pointer-events-none"
        style={{
          top: SAFE_MARGIN_PX - 1, left: SAFE_MARGIN_PX, right: SAFE_MARGIN_PX,
          background: `linear-gradient(90deg, transparent 0%, ${secondary} 30%, ${primary} 50%, ${secondary} 70%, transparent 100%)`,
        }}
        aria-hidden="true"
      />
      <div
        className="absolute h-[2px] pointer-events-none"
        style={{
          bottom: SAFE_MARGIN_PX - 1, left: SAFE_MARGIN_PX, right: SAFE_MARGIN_PX,
          background: `linear-gradient(90deg, transparent 0%, ${fade(secondary, 0x40)} 50%, transparent 100%)`,
        }}
        aria-hidden="true"
      />

      <CornerOrnament position="top-left" primary={primary} secondary={secondary} />
      <CornerOrnament position="top-right" primary={primary} secondary={secondary} />
      <CornerOrnament position="bottom-left" primary={primary} secondary={secondary} />
      <CornerOrnament position="bottom-right" primary={primary} secondary={secondary} />

      {/* Subtle radial glow from top (not on white paper — it would print as a haze) */}
      {!printOnWhite && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 80% 40% at 50% -10%, ${fade(primary, 0x15)} 0%, transparent 70%)` }}
          aria-hidden="true"
        />
      )}

      {/* ── Sheet layout: text block, logo centred in the space below it, footer at the bottom ── */}
      <div className="absolute inset-0 flex flex-col" style={{ padding: layout.padding }}>
        {/* Main content — scaled down as a whole if it doesn't fit its slot */}
        <div ref={areaRef} className="flex-1 min-h-0 flex flex-col items-center justify-center">
          <div
            ref={contentRef}
            className="relative z-10 shrink-0 flex flex-col items-center w-full text-center"
            // min-height 100%: the logo area below takes the remaining space and centres the logo
            style={{ minHeight: "100%", transform: `scale(${fitScale})`, transformOrigin: "center center" }}
          >
            <div className={`flex flex-col items-center w-full ${layout.gapClass}`}>
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
                    textShadow: glow(`0 0 40px ${fade(secondary, 0x60)}, 0 0 80px ${fade(secondary, 0x25)}`),
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
                className="uppercase leading-tight"
                style={{
                  fontFamily: headerFont,
                  fontSize: 52,
                  letterSpacing: "0.08em",
                  color: text,
                  textShadow: glow(`0 0 30px ${fade(text, 0x20)}`),
                  opacity: isPlaceholder ? 0.3 : 1,
                  ...breakText,
                }}
              >
                {playerName}
              </p>

              {/* ── Team ── */}
              <div style={{ opacity: isPlaceholder ? 0.3 : 1 }}>
                <p className="text-sm tracking-[0.25em] uppercase" style={{ color: muted }}>
                  reprezentującego drużynę
                </p>
                <p
                  className="mt-1 text-2xl tracking-wide font-semibold"
                  style={{ color: primary, fontFamily: headerFont, textShadow: glow(`0 0 20px ${fade(primary, 0x50)}`), ...breakText }}
                >
                  {teamName}
                </p>
              </div>

              {/* ── za zajęcie / place ── */}
              <div className="flex flex-col items-center gap-3" style={{ opacity: isPlaceholder ? 0.3 : 1 }}>
                {!isCustomPlace && (
                  <p className="text-sm tracking-[0.25em] uppercase" style={{ color: muted }}>
                    za zajęcie
                  </p>
                )}
                {/* Place badge — angular clip matching site CTAs */}
                <div
                  className="px-12 py-3 max-w-full"
                  style={{
                    clipPath: "polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)",
                    background: fade(secondary, 0x12),
                    outline: `1.5px solid ${fade(secondary, 0x70)}`,
                    boxShadow: glow(`inset 0 0 30px ${fade(secondary, 0x08)}, 0 0 30px ${fade(secondary, 0x20)}`),
                  }}
                >
                  <span
                    className="uppercase"
                    style={{
                      fontFamily: headerFont,
                      fontSize: 32,
                      letterSpacing: "0.25em",
                      color: secondary,
                      textShadow: glow(`0 0 20px ${fade(secondary, 0x80)}`),
                      ...breakText,
                    }}
                  >
                    {place}
                  </span>
                </div>
              </div>

              <p className="text-sm tracking-[0.25em] uppercase font-normal" style={{ color: muted }}>
                w turnieju
              </p>
            </div>

            {/* ── Tournament logo (or name), centred in the space between "w turnieju" and the footer ── */}
            <div className="flex-1 w-full flex flex-col items-center justify-center gap-3 py-3">
              {theme.logoUrl ? (
                <Image
                  src={theme.logoUrl}
                  alt={tournamentName}
                  width={layout.logoMaxW}
                  height={layout.logoMaxH}
                  className="object-contain"
                  style={{
                    maxHeight: layout.logoMaxH,
                    maxWidth: layout.logoMaxW,
                    width: "auto",
                    height: "auto",
                    filter: glow("drop-shadow(0 0 24px rgba(255,255,255,0.15))"),
                  }}
                  unoptimized
                />
              ) : (
                <p className="text-3xl font-semibold tracking-wide" style={{ color: text, fontFamily: headerFont, ...breakText }}>
                  {tournamentName}
                </p>
              )}

              {/* ── Division (league only) ── */}
              {division && (
                <p
                  className="text-lg font-semibold tracking-[0.2em] uppercase"
                  style={{
                    color: division.color || secondary,
                    fontFamily: headerFont,
                    textShadow: glow(`0 0 20px ${fade(division.color || secondary, 0x60)}`),
                  }}
                >
                  Dywizja {division.name}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer (pinned to the bottom): date left; organiser logo + name right ── */}
        <div
          className="relative z-10 w-full flex justify-between items-center mt-4 pt-5 text-xs tracking-wider uppercase gap-6 text-left shrink-0"
          style={{ borderTop: `1px solid ${fade(secondary, 0x20)}`, color: footerText }}
        >
          <span className="shrink-0">{date}</span>
          {(organizerLogoUrl || organizerName.trim()) && (
            <div className="flex items-center gap-2.5 min-w-0">
              {organizerLogoUrl && (
                <img
                  src={organizerLogoUrl}
                  alt=""
                  style={{ height: 24, maxWidth: 120, objectFit: "contain", opacity: 0.85, flexShrink: 0 }}
                />
              )}
              {organizerName.trim() && (
                <span className="min-w-0 truncate" style={{ color: printOnWhite ? secondary : fade(secondary, 0x99) }}>{organizerName}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DiamondRule — decorative divider under DYPLOM
// ---------------------------------------------------------------------------

function DiamondRule({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-2" style={{ color }}>
      <div className="h-px w-24" style={{ background: `linear-gradient(to left, ${fade(color, 0x80)}, transparent)` }} />
      <span className="text-[10px] tracking-[0.3em] uppercase font-mono" style={{ color: `${fade(color, 0x90)}` }}>
        dla gracza
      </span>
      <div className="h-px w-24" style={{ background: `linear-gradient(to right, ${fade(color, 0x80)}, transparent)` }} />
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
    position === "top-left" ? "top-[46px] left-[46px]"
      : position === "top-right" ? "top-[46px] right-[46px]"
        : position === "bottom-left" ? "bottom-[46px] left-[46px]"
          : "bottom-[46px] right-[46px]";
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
