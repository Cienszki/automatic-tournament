"use client";

import { useEffect } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { getFontFamily } from '@/lib/dynamic-fonts';

interface ThemeFontApplierProps {
  /** Called once the theme font CSS has been injected into the document. */
  onReady?: () => void;
}

export function ThemeFontApplier({ onReady }: ThemeFontApplierProps) {
  const { tournament } = useTournament();

  useEffect(() => {
    if (!tournament?.theme) {
      // No theme — nothing to apply, signal ready immediately.
      onReady?.();
      return;
    }

    const { theme } = tournament;
    const customFonts = tournament.customFonts || [];

    // Get font families for each typography setting
    const headerFont = theme.headerFont 
      ? getFontFamily(theme.headerFont, customFonts)
      : null;
    
    const bodyFont = theme.bodyFont 
      ? getFontFamily(theme.bodyFont, customFonts)
      : null;
    
    const textFont = theme.textFont 
      ? getFontFamily(theme.textFont, customFonts)
      : null;
    
    const readableFont = theme.readableFont 
      ? getFontFamily(theme.readableFont, customFonts)
      : null;
    
    const rulesContentFont = theme.rulesContentFont 
      ? getFontFamily(theme.rulesContentFont, customFonts)
      : null;

    let cancelled = false;
    const createdObjectUrls: string[] = [];

    async function applyFonts() {
      // For uploaded custom fonts with remote URLs, fetch as blob and create
      // an object URL so the @font-face src is treated as same-origin — this
      // bypasses the CORS restriction that browsers enforce when CSS tries to
      // load a font directly from a cross-origin URL.
      const remoteFonts = customFonts.filter(
        font => font.path && (font.path.startsWith('http://') || font.path.startsWith('https://'))
      );

      const fontFaceRules: string[] = [];
      for (const font of remoteFonts) {
        try {
          const res = await fetch(font.path!, { mode: 'cors' });
          if (!res.ok || cancelled) break;
          const blob = await res.blob();
          const objectUrl = URL.createObjectURL(blob);
          createdObjectUrls.push(objectUrl);
          const ext = font.path!.split('?')[0].split('.').pop()?.toLowerCase() || 'ttf';
          const format = ext === 'woff2' ? 'woff2' : ext === 'woff' ? 'woff' : ext === 'otf' ? 'opentype' : 'truetype';
          fontFaceRules.push(
            `@font-face { font-family: '${font.family}'; src: url('${objectUrl}') format('${format}'); font-display: swap; }`
          );
        } catch {
          // Silently skip fonts that fail to load
        }
      }

      if (cancelled) return;

      // Remove existing theme font styles
      const existingStyle = document.getElementById('theme-fonts-style');
      if (existingStyle) {
        existingStyle.remove();
      }

      // Create CSS to apply fonts
      const cssRules: string[] = [...fontFaceRules];

    // Apply header font to headings and CTA/button elements that use
    // tournament-specific Tailwind font utility classes (font-logik-*, font-neon-*, etc.).
    // Without this, interactive elements keep their hardcoded PDL fonts even when
    // a different tournament theme is active.
    if (headerFont) {
      cssRules.push(`
        h1, h2, h3, h4, h5, h6,
        .font-heading {
          font-family: ${headerFont} !important;
        }
      `);

      // Override ALL elements that use font-logik*, font-neon*, font-space* classes,
      // not just anchors and buttons — most text in components uses these on divs/spans/p.
      cssRules.push(`
        *[class*="font-logik"],
        *[class*="font-neon"],
        *[class*="font-space"] {
          font-family: ${headerFont} !important;
        }
      `);
    }

    // Apply body/text font to body and paragraphs
    if (bodyFont || textFont) {
      const font = textFont || bodyFont;
      cssRules.push(`
        body,
        body p,
        body span,
        .font-body,
        .font-text,
        *[class*="font-body"] {
          font-family: ${font} !important;
        }
      `);
    }

    // Spans (and anchors) nested inside headings or explicit font utility
    // classes should inherit rather than be overridden by the body span rule.
    if (headerFont) {
      cssRules.push(`
        h1 span, h2 span, h3 span, h4 span, h5 span, h6 span,
        .font-heading span,
        h1 a, h2 a, h3 a, h4 a, h5 a, h6 a,
        .font-heading a,
        [class*="font-logik"] span,
        [class*="font-neon"] span,
        [class*="font-space"] span,
        [class*="font-logik"] a,
        [class*="font-neon"] a,
        [class*="font-space"] a {
          font-family: inherit !important;
        }
      `);
    }

    // Apply readable font to specific content areas
    if (readableFont) {
      cssRules.push(`
        article,
        article p,
        .prose,
        .prose p,
        .font-readable,
        .content-text,
        .font-logik-readable,
        .player-name,
        .player-nickname,
        p.font-readable,
        div.font-readable,
        *[class*="font-readable"] {
          font-family: ${readableFont} !important;
        }
      `);
    }

    // Apply rules content font to rules page paragraphs
    if (rulesContentFont) {
      cssRules.push(`
        .font-rules-content,
        p.font-rules-content,
        *[class*="font-rules-content"] {
          font-family: ${rulesContentFont} !important;
        }
      `);
    }

      // Inject styles into document
      if (cssRules.length > 0) {
        const style = document.createElement('style');
        style.id = 'theme-fonts-style';
        style.textContent = cssRules.join('\n');
        document.head.appendChild(style);
      }

      // Signal that fonts are injected and the page can be revealed.
      onReady?.();
    }

    applyFonts();

    // Cleanup on unmount
    return () => {
      cancelled = true;
      createdObjectUrls.forEach(url => URL.revokeObjectURL(url));
      const styleElement = document.getElementById('theme-fonts-style');
      if (styleElement) {
        styleElement.remove();
      }
    };
  }, [tournament, onReady]);

  return null;
}
