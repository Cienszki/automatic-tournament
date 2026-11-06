// The card game's settings of a tournament (Admin → Karty), stored on the tournament document as
// `cardSettings` (public: the cards page reads the "how to get more cards" text from it). Written
// only through /api/manage/cards.

import { count } from '@/lib/plural';

export interface CardSettings {
  /** Shown when hovering "Jak zdobyć więcej kart?" on the cards page; empty = the default text */
  howTo: string;
  /** Packs everyone with a collection gets when a round / week is over and its team is known (0 = off) */
  roundPacks: number;
  /** Twitch channels that stream this tournament (for pack drops while a match is live; not used yet) */
  twitchChannels: string[];
}

export const ROUND_PACKS_MAX = 20;
export const TWITCH_LOGIN = /^[a-zA-Z0-9_]{3,25}$/;

/** What a round is called in this tournament: league kolejka, Swiss round, otherwise a calendar week */
export function roundWord(type?: string): { after: string; team: string; teamOf: string } {
  if (type === 'league') return { after: 'każdej kolejce', team: 'drużynę kolejki', teamOf: 'drużyny kolejki' };
  // The site calls it "Drużyna kolejki" in Swiss too
  if (type === 'swiss') return { after: 'każdej rundzie', team: 'drużynę kolejki', teamOf: 'drużyny kolejki' };
  return { after: 'każdym tygodniu', team: 'drużynę tygodnia', teamOf: 'drużyny tygodnia' };
}

export function defaultHowTo(type: string | undefined, roundPacks: number): string {
  const w = roundWord(type);
  return [
    'Na start dostajesz 10 paczek.',
    roundPacks > 0 ? `Po ${w.after}, gdy znamy ${w.team}, każdy gracz dostaje ${count(roundPacks, 'paczkę', 'paczki', 'paczek')}.` : '',
    'Paczki chowają się też na stronie turnieju: kto z niej korzysta, czasem jakąś znajdzie.',
    'Rozdajemy je również w konkursach na naszym Discordzie.',
  ].filter(Boolean).join('\n');
}

/** The settings with defaults filled in, from whatever the tournament document holds */
export function cardSettingsOf(t: { type?: string; cardSettings?: Partial<CardSettings> | null } | null | undefined): CardSettings {
  const s = t?.cardSettings ?? {};
  const roundPacks = Number.isInteger(s.roundPacks) && s.roundPacks! >= 0 ? Math.min(ROUND_PACKS_MAX, s.roundPacks!) : 3;
  return {
    howTo: typeof s.howTo === 'string' ? s.howTo : '',
    roundPacks,
    twitchChannels: Array.isArray(s.twitchChannels) ? s.twitchChannels.filter(c => typeof c === 'string' && TWITCH_LOGIN.test(c)) : [],
  };
}

/** The text players see: the admin's, or the default one */
export const howToText = (t: Parameters<typeof cardSettingsOf>[0]) => {
  const s = cardSettingsOf(t);
  return s.howTo.trim() || defaultHowTo(t?.type, s.roundPacks);
};
