// Who casts a match: `match.casters`, written only by the server (/api/casters). The first caster to
// take a match is its main caster (their stream is the one shown); later ones are co-casters. When
// the main caster drops out, the earliest co-caster takes over; the main caster can hand over.

export interface MatchCaster {
  uid: string;
  name: string;
  avatar: string | null;
  /** Stream URL (any platform), from the caster's account */
  stream: string | null;
  /** For the lobby bot's invite */
  steamId32: string | null;
  main: boolean;
}

/** The main caster (older matches without the flag: the first one) */
export const mainCaster = (list?: MatchCaster[] | null): MatchCaster | null =>
  list?.length ? list.find(c => c.main) ?? list[0] : null;

export const coCasters = (list?: MatchCaster[] | null): MatchCaster[] => {
  const main = mainCaster(list);
  return (list ?? []).filter(c => c !== main);
};

/** Keeps exactly one main caster: the one flagged, else the earliest */
export function withMain(list: MatchCaster[], mainUid?: string): MatchCaster[] {
  const uid = mainUid ?? list.find(c => c.main)?.uid ?? list[0]?.uid;
  return list.map(c => ({ ...c, main: c.uid === uid }));
}

/** "Vanrood, co-caster: Steven" (names can't be declined, so no "ze Stevenem") */
export function castersLine(list?: MatchCaster[] | null): string {
  const main = mainCaster(list);
  if (!main) return '';
  const co = coCasters(list).map(c => c.name);
  return co.length ? `${main.name}, co-caster${co.length > 1 ? 'zy' : ''}: ${co.join(', ')}` : main.name;
}
