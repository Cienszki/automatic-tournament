"use client";

import { useEffect } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { getFontFamily } from '@/lib/dynamic-fonts';

/**
 * ThemeFontApplier Component
 * Applies tournament theme fonts to the document root
 * This ensures all text on the page uses the selected fonts
 */
export function ThemeFontApplier() {
  const { tournament } = useTournament();

  useEffect(() => {
    if (!tournament?.theme) {
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

    // Remove existing theme font styles
    const existingStyle = document.getElementById('theme-fonts-style');
    if (existingStyle) {
      existingStyle.remove();
    }

    // Create CSS to apply fonts
    const cssRules: string[] = [];

    // Apply header font to headings
    if (headerFont) {
      cssRules.push(`
        h1, h2, h3, h4, h5, h6,
        .font-heading {
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

    // Cleanup on unmount
    return () => {
      const styleElement = document.getElementById('theme-fonts-style');
      if (styleElement) {
        styleElement.remove();
      }
    };
  }, [tournament]);

  return null;
}
