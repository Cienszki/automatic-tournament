// Made-up names for seed teams and players. Nothing here names a real team, player or account.

export const TEAM_NAMES = [
  'Szare Wilki', 'Nocne Sowy', 'Ostatni Bastion', 'Leśne Duchy', 'Żelazna Pięść', 'Czerwone Smoki',
  'Białe Kruki', 'Złota Horda', 'Burzowe Ptaki', 'Kamienna Straż', 'Mroźny Oddech', 'Ognisty Krąg',
  'Cienie Północy', 'Dzikie Kocury', 'Srebrne Strzały', 'Rdzawe Topory', 'Wschodni Wiatr', 'Stalowe Szpony',
  'Senne Widma', 'Bursztynowa Armia', 'Głodne Jastrzębie', 'Pustynne Lisy', 'Morskie Diabły', 'Kruche Lody',
  'Gromowładni', 'Leniwe Niedźwiedzie', 'Zielona Mgła', 'Ciche Ostrza', 'Polarne Zorze', 'Wierne Psy',
  'Zbuntowani', 'Ostatnia Szansa', 'Dzwony Wieczorne', 'Kolejka Górska', 'Drużyna Pierścienia', 'Krzywe Lustra',
  'Szybkie Żółwie', 'Pełnia Księżyca', 'Mokre Skarpety', 'Złamane Włócznie', 'Wielka Siódemka', 'Nocna Zmiana',
  'Gorące Głowy', 'Zimne Dłonie', 'Rycerze Okrągłego Stołu', 'Bractwo Mgły', 'Królewska Gwardia', 'Piąta Kolumna',
  'Wilcze Stado', 'Ostatni Mohikanie', 'Biały Szum',
] as const;

const NICK_START = ['Mrok', 'Szept', 'Grom', 'Iskra', 'Kieł', 'Cień', 'Wir', 'Zgrzyt', 'Ryś', 'Puch', 'Brzask', 'Echo', 'Rdza', 'Szron', 'Żar', 'Bies'];
const NICK_END = ['', 'ek', 'us', 'o', 'ix', 'er', 'an', 'ka', 'ny', 'y', '_pl', '1337', '99', 'Z', 'Pro', 'ito'];

/** A nickname for player number `n` (0-based), different for every n below 256. */
export function nickname(n: number): string {
  return `${NICK_START[n % NICK_START.length]}${NICK_END[Math.floor(n / NICK_START.length) % NICK_END.length]}`;
}

/** A tag from a team name: the initials, or the first three letters. */
export function tagOf(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const raw = words.length > 1 ? words.map((w) => w[0]).join('') : name.slice(0, 3);
  return raw.toUpperCase().slice(0, 4);
}
