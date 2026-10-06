"use client";

import { cn } from "@/lib/utils";

/**
 * Light positions the ambient glows move between. Each entry: [primary blob, secondary blob],
 * as CSS top/left of the blob centre. Index 0 is the classic rules-page look
 * (primary top-right, secondary bottom-left).
 */
const LAYOUTS: { primary: [string, string]; secondary: [string, string] }[] = [
  { primary: ["10%", "90%"], secondary: ["90%", "10%"] },
  { primary: ["10%", "12%"], secondary: ["88%", "88%"] },
  { primary: ["0%", "55%"], secondary: ["95%", "35%"] },
  { primary: ["20%", "95%"], secondary: ["80%", "5%"] },
  { primary: ["5%", "30%"], secondary: ["90%", "75%"] },
  { primary: ["15%", "70%"], secondary: ["85%", "20%"] },
];

interface PageAtmosphereProps {
  primaryColor?: string;
  secondaryColor?: string;
  /** Picks one of the glow layouts; changing it animates the lights to a new spot */
  variant?: number;
  /** Soft spotlight behind the top-centre heading area (like the rules page title glow) */
  headingGlow?: boolean;
  /** Light theme (theme.themeStyle === 'light'): a black edge vignette would look dirty, keep it faint */
  light?: boolean;
  className?: string;
}

/**
 * Fixed, non-interactive background "atmosphere": an edge vignette plus two large blurred
 * colour glows in the theme colours. Must not be placed inside a transformed ancestor
 * (position: fixed would then follow that ancestor instead of the viewport).
 */
export function PageAtmosphere({
  primaryColor = "#3b82f6",
  secondaryColor = "#dc2626",
  variant = 0,
  headingGlow = false,
  light = false,
  className,
}: PageAtmosphereProps) {
  const layout = LAYOUTS[((variant % LAYOUTS.length) + LAYOUTS.length) % LAYOUTS.length];
  const blob = "absolute rounded-full -translate-x-1/2 -translate-y-1/2 transition-[top,left] duration-[1400ms] ease-in-out";

  return (
    <div className={cn("fixed inset-0 pointer-events-none z-0 overflow-hidden", className)} aria-hidden="true">
      {/* Edge vignette — the centre reads as lit */}
      <div
        className={cn("absolute inset-0", light ? "opacity-[0.12]" : "opacity-60")}
        style={{ background: "radial-gradient(ellipse at center, transparent 0%, transparent 40%, #000000 100%)" }}
      />

      {/* Ambient glows */}
      <div
        // min sizes: on phones 60vw is too small to survive a 200px blur
        className={cn(blob, "w-[60vw] h-[60vw] min-w-[520px] min-h-[520px] opacity-[0.05] blur-[200px]")}
        style={{ background: primaryColor, top: layout.primary[0], left: layout.primary[1] }}
      />
      <div
        className={cn(blob, "w-[42vw] h-[42vw] min-w-[400px] min-h-[400px] opacity-[0.04] blur-[160px]")}
        style={{ background: secondaryColor, top: layout.secondary[0], left: layout.secondary[1] }}
      />

      {headingGlow && (
        <div
          className="absolute top-[14%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[46vw] min-w-[320px] h-56 rounded-full blur-[120px]"
          // color-mix, not `${hex}1f`: theme colours may be hsl(...) strings
          style={{ background: `color-mix(in srgb, ${primaryColor} 12%, transparent)` }}
        />
      )}
    </div>
  );
}
