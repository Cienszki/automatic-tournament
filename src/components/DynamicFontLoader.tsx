"use client";

import { useEffect } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { getGoogleFontUrl } from '@/lib/google-fonts';
import { injectCustomFontStyles } from '@/lib/dynamic-fonts';

/**
 * Dynamic Font Loader Component
 * Dynamically loads Google Fonts based on tournament configuration
 */
export function DynamicFontLoader() {
  const { tournament } = useTournament();

  useEffect(() => {
    if (!tournament?.customFonts || tournament.customFonts.length === 0) {
      return;
    }

    // Create link elements for each custom font
    const linkElements: HTMLLinkElement[] = [];

    tournament.customFonts.forEach((font: any) => {
      if (font.type === 'google') {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = getGoogleFontUrl(font.family, font.variants || ['400', '700']);
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
        linkElements.push(link);
      }
    });

    // Inject CSS classes for Tailwind
    injectCustomFontStyles(tournament.customFonts);

    // Cleanup function to remove font links when component unmounts
    return () => {
      linkElements.forEach(link => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      });
      
      // Remove custom font styles
      const customStyle = document.getElementById('custom-fonts-style');
      if (customStyle) {
        customStyle.remove();
      }
    };
  }, [tournament?.customFonts]);

  return null; // This component doesn't render anything
}
