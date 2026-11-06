// The kinds of notifications an account can get. Every one lands in the site's inbox (the bell);
// each person picks which of them also come as a Discord DM. Shared by the server and the bell.

export type NotifyType = 'schedule' | 'standin' | 'match_soon' | 'caster' | 'announcement';

export const NOTIFY_TYPES: Record<NotifyType, { label: string; hint: string; discord: boolean }> = {
  schedule: { label: 'Terminy meczów', hint: 'Propozycje nowego terminu i odpowiedzi na twoje', discord: true },
  standin: { label: 'Standini', hint: 'Prośby o standina i decyzje w ich sprawie', discord: true },
  match_soon: { label: 'Mecz za godzinę', hint: 'Przypomnienie z nazwą lobby', discord: true },
  caster: { label: 'Casterzy', hint: 'Kto poprowadzi transmisję twojego meczu', discord: true },
  announcement: { label: 'Ogłoszenia', hint: 'Wiadomości od organizatorów', discord: false },
};
export const NOTIFY_ORDER = Object.keys(NOTIFY_TYPES) as NotifyType[];
export const isNotifyType = (t: unknown): t is NotifyType => typeof t === 'string' && t in NOTIFY_TYPES;

/** One inbox item as the bell gets it */
export interface InboxItem {
  id: string;
  type: NotifyType;
  title: string;
  body: string;
  /** Path on our site (never another host) */
  href: string | null;
  tournament: string | null;
  at: string;
  read: boolean;
}

/** Why a Discord DM could not be sent the last time, shown next to the settings */
export type DmProblem = 'blocked' | 'no-server' | null;
