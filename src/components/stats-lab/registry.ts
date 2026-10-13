import dynamic from 'next/dynamic';

// The stats-view prototypes, lazily loaded so the home page only pulls the one asked for
// with ?stats=N.
export const STATS_REDESIGNS = [
  dynamic(() => import('./designs/D01Records'), { ssr: false }),
  dynamic(() => import('./designs/D02Podium'), { ssr: false }),
  dynamic(() => import('./designs/D03HeroMosaic'), { ssr: false }),
  dynamic(() => import('./designs/D04Cards'), { ssr: false }),
  dynamic(() => import('./designs/D05Duel'), { ssr: false }),
  dynamic(() => import('./designs/D06Pulse'), { ssr: false }),
  dynamic(() => import('./designs/D07Fingerprints'), { ssr: false }),
  dynamic(() => import('./designs/D08Achievements'), { ssr: false }),
  dynamic(() => import('./designs/D09Lab'), { ssr: false }),
  dynamic(() => import('./designs/D10Stories'), { ssr: false }),
  dynamic(() => import('./designs/D11Draft'), { ssr: false }),
  dynamic(() => import('./designs/D12Constellation'), { ssr: false }),
  dynamic(() => import('./designs/D13Sides'), { ssr: false }),
  dynamic(() => import('./designs/D14Clock'), { ssr: false }),
  dynamic(() => import('./designs/D15TeamOfWeek'), { ssr: false }),
  dynamic(() => import('./designs/D16Dossier'), { ssr: false }),
  dynamic(() => import('./designs/D17Race'), { ssr: false }),
  dynamic(() => import('./designs/D18Crosstab'), { ssr: false }),
  dynamic(() => import('./designs/D19HigherLower'), { ssr: false }),
  dynamic(() => import('./designs/D20Numbers'), { ssr: false }),
];
