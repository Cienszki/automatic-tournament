// Every view the stats hub can show: its title (shown in the hub header), where it sits
// (overview gallery, "play" column or the advanced index), and a lazy loader. Kept free of the
// views' own code so the hub and the preloader can read it without pulling any view in.

import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowUpDown, Award, Ban, ChartCandlestick, ChartNoAxesColumn, CircleHelp, Clapperboard, Crosshair, Crown, Fingerprint,
  Flag, Flame, FlaskConical, Grid3x3, History, Layers, LayoutGrid, ListOrdered, Map as MapIcon, Medal, Sparkles, Swords,
  TrendingUp, Trophy, UserSearch, Users,
} from 'lucide-react';
import type { Model } from '@/lib/stats-lab/derive';
import type { Asset } from './assets';

export type ViewModule = { default: ComponentType; assets?: (model: Model) => Asset[] };

export type PageGroup = 'main' | 'play' | 'players' | 'teams' | 'heroes' | 'records';

export interface StatsPage {
  id: string;
  title: string;
  /** One line for the dropdown and the advanced index */
  blurb: string;
  group: PageGroup;
  icon: LucideIcon;
  load: () => Promise<ViewModule>;
}

export const PAGES: StatsPage[] = [
  // ── Overview gallery ────────────────────────────────────────────────
  { id: 'rankingi', title: 'Rankingi', blurb: 'Punkty fantasy na każdej pozycji i ranking drużyn', group: 'main', icon: Trophy, load: () => import('./pages/Rankings') },
  { id: 'rekordy', title: 'Rekordy', blurb: 'Najlepsze pojedyncze występy i kto ich goni', group: 'main', icon: Medal, load: () => import('@/components/stats-lab/designs/D01Records') },
  { id: 'liderzy', title: 'Liderzy', blurb: 'Podium w każdej statystyce — średnio, łącznie, w jednej grze', group: 'main', icon: Crown, load: () => import('@/components/stats-lab/designs/D02Podium') },
  { id: 'bohaterowie', title: 'Bohaterowie', blurb: 'Kto rządzi draftem: picki, bany i skuteczność', group: 'main', icon: Swords, load: () => import('@/components/stats-lab/designs/D03HeroMosaic') },
  { id: 'historie', title: 'Historie', blurb: 'Najlepsze momenty sezonu jako relacje', group: 'main', icon: Clapperboard, load: () => import('@/components/stats-lab/designs/D10Stories') },
  { id: 'osiagniecia', title: 'Osiągnięcia', blurb: 'Brąz, srebro i złoto — kto co już zdobył', group: 'main', icon: Award, load: () => import('@/components/stats-lab/designs/D08Achievements') },
  { id: 'elo', title: 'Ranking Elo', blurb: 'Siła drużyn po każdej grze i szanse w meczu', group: 'main', icon: TrendingUp, load: () => import('@/components/stats-lab/designs/D23Elo') },

  // ── Play ───────────────────────────────────────────────────────────
  { id: 'karty', title: 'Karty', blurb: 'Otwieraj paczki, zbieraj karty graczy i drużyn, wygrywaj pojedynki', group: 'play', icon: Layers, load: () => import('./pages/Cards') },
  { id: 'dotadle', title: 'Dotadle', blurb: 'Zgadnij gracza, bohatera i drużynę dnia', group: 'play', icon: Grid3x3, load: () => import('./pages/Dotadle') },
  { id: 'kto-to', title: 'Kto to?', blurb: 'Quiz z liczb sezonu — im mniej podpowiedzi, tym więcej punktów', group: 'play', icon: CircleHelp, load: () => import('./pages/Quiz') },
  { id: 'wyzej-nizej', title: 'Wyżej czy niżej', blurb: 'Która liczba jest większa? Graj na serię', group: 'play', icon: ArrowUpDown, load: () => import('@/components/stats-lab/designs/D19HigherLower') },

  // ── Advanced ───────────────────────────────────────────────────────
  { id: 'dossier', title: 'Dossier gracza', blurb: 'Radar, dziennik gier, pula bohaterów i rekordy osobiste', group: 'players', icon: UserSearch, load: () => import('@/components/stats-lab/designs/D16Dossier') },
  { id: 'gielda', title: 'Giełda graczy', blurb: 'Forma jako kurs akcji — wzrosty, spadki, blue chipy', group: 'players', icon: ChartCandlestick, load: () => import('@/components/stats-lab/designs/D21Stocks') },
  { id: 'tiery', title: 'Lista tierów', blurb: 'S–D z danych — i Twoja własna lista do porównania', group: 'players', icon: ListOrdered, load: () => import('@/components/stats-lab/designs/D22TierList') },
  { id: 'blizniacy', title: 'Bliźniacy', blurb: 'Kto gra najbardziej jak Ty — i kto zupełnie inaczej', group: 'players', icon: Users, load: () => import('@/components/stats-lab/designs/D75Twins') },
  { id: 'wyscig', title: 'Wyścig', blurb: 'Sezon gra po grze jako wyścig słupków', group: 'players', icon: Flag, load: () => import('@/components/stats-lab/designs/D17Race') },
  { id: 'druzyna-tygodnia', title: 'Drużyna tygodnia', blurb: 'Najlepszy gracz każdej pozycji na mapie', group: 'teams', icon: MapIcon, load: () => import('@/components/stats-lab/designs/D15TeamOfWeek') },
  { id: 'odciski', title: 'Odciski drużyn', blurb: 'Styl gry każdej drużyny na tle reszty ligi', group: 'teams', icon: Fingerprint, load: () => import('@/components/stats-lab/designs/D07Fingerprints') },
  { id: 'kolekcja', title: 'Kolekcja bohaterów', blurb: 'Iloma bohaterami zagrała każda drużyna', group: 'teams', icon: LayoutGrid, load: () => import('./pages/TeamHeroes') },
  { id: 'draft', title: 'Pokój draftu', blurb: 'Co wybierano w każdym kroku draftu', group: 'heroes', icon: Ban, load: () => import('@/components/stats-lab/designs/D11Draft') },
  { id: 'meta', title: 'Meta tygodnia', blurb: 'Kto rośnie, a kto spada w drafcie', group: 'heroes', icon: Flame, load: () => import('@/components/stats-lab/designs/D59Meta') },
  { id: 'konstelacja', title: 'Konstelacja', blurb: 'Bohaterowie grani razem i przeciwko sobie', group: 'heroes', icon: Sparkles, load: () => import('@/components/stats-lab/designs/D12Constellation') },
  { id: 'kronika', title: 'Kronika rekordów', blurb: 'Jak padał każdy rekord, krok po kroku', group: 'records', icon: History, load: () => import('@/components/stats-lab/designs/D26RecordChronicle') },
  { id: 'laboratorium', title: 'Laboratorium', blurb: 'Dowolne dwie statystyki na wykresie albo w tabeli', group: 'records', icon: FlaskConical, load: () => import('@/components/stats-lab/designs/D09Lab') },
];

export const PAGE_BY_ID = new Map(PAGES.map(p => [p.id, p]));

export const GROUP_LABEL: Record<PageGroup, string> = {
  main: 'Przegląd',
  play: 'Zagraj',
  players: 'Gracze',
  teams: 'Drużyny',
  heroes: 'Bohaterowie i draft',
  records: 'Rekordy i dane',
};

export const ADVANCED_GROUPS: PageGroup[] = ['players', 'teams', 'heroes', 'records'];

/** The two hub screens that are not pages of their own */
export const OVERVIEW = { id: 'przeglad', title: 'Statystyki', icon: ChartNoAxesColumn } as const;
export const ADVANCED = { id: 'zaawansowane', title: 'Zaawansowane', icon: FlaskConical } as const;

/**
 * The captains' match-preparation tool (draft prep, "Briefing" version). A view of the hub, but
 * not one of PAGES: it loads its own data per match, so the preloader leaves it alone.
 */
export const MATCH_PREP = {
  id: 'przygotowanie', title: 'Przygotowanie do meczu', blurb: 'Nowe narzędzie dla kapitanów', icon: Crosshair,
  load: () => import('@/components/draft-prep/pages/P2Briefing'),
} as const;

/** Old standalone route of the tool — only the unused overview variants (overviews/) still link it */
export const MATCH_PREP_PATH = '/draft-prep-2';
