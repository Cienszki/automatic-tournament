// src/lib/swiss/band-advisor.ts
//
// Suggests an MMR band for a Swiss tournament from the teams that actually
// registered, and shows the trade-off so the organiser can decide rather than
// trust a number blindly.
//
// Why a suggestion and not a rule: the right band depends on how the field is
// shaped. A tightly clustered field supports a narrow band; a thin, spread-out
// field does not, and forcing one there just produces rematches without
// improving match quality. Simulation across many field shapes put the best
// value at 1500 most of the time, and 1250 for tightly-packed fields — but the
// organiser knows things the numbers do not, so nothing here is enforced.
//
// Pure functions, no Firestore.

/** A candidate band with the consequences of choosing it. */
export interface BandOption {
  band: number;
  /** Share of all possible pairings that this band would permit. */
  pairingsAllowed: number;
  /** Teams with fewer than `rounds` opponents inside the band. */
  isolatedTeams: string[];
  /** Median number of eligible opponents per team. */
  medianOpponents: number;
  /** Share of possible pairings this band removes that were certain wins. */
  stompsRemoved: number;
}

export interface BandAdvice {
  /** Suggested band, or null when the field is too small/sparse to bother. */
  suggested: number | null;
  reason: string;
  options: BandOption[];
  /** Teams so far from the rest that no band can help them. */
  outliers: Array<{ teamId: string; seedMmr: number; nearestGap: number }>;
  fieldSummary: {
    teams: number;
    min: number;
    max: number;
    median: number;
    /** Width of the range holding the middle half of the field. */
    interquartileWidth: number;
  };
}

/** MMR gap at which the stronger side is a near-certainty to win. */
export const CERTAIN_WIN_GAP = 1500;

const CANDIDATE_BANDS = [750, 1000, 1250, 1500, 2000, 2500, 3000];

const median = (a: number[]) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const quantile = (a: number[], q: number) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

export interface SeededTeam { teamId: string; seedMmr: number }

/**
 * Work out a sensible band for this particular field.
 *
 * The suggestion balances two things that pull apart:
 *   - a narrower band means closer matches
 *   - too narrow and most teams run out of legal opponents, so the pairer has to
 *     break the band anyway and you get the rematches without the benefit
 *
 * The chosen value is the narrowest candidate where a clear majority of teams
 * still have enough opponents to fill the tournament.
 */
export function adviseBand(
  teams: SeededTeam[],
  rounds: number,
  opts: { coverage?: number } = {}
): BandAdvice {
  const coverage = opts.coverage ?? 0.65;
  const withMmr = teams.filter(t => Number.isFinite(t.seedMmr) && t.seedMmr > 0);
  const values = withMmr.map(t => t.seedMmr);

  const fieldSummary = {
    teams: withMmr.length,
    min: values.length ? Math.min(...values) : 0,
    max: values.length ? Math.max(...values) : 0,
    median: median(values),
    interquartileWidth: values.length ? quantile(values, 0.75) - quantile(values, 0.25) : 0,
  };

  if (withMmr.length < 4) {
    return {
      suggested: null,
      reason: 'Za mało drużyn ze średnim MMR, żeby ocenić sensowny zakres.',
      options: [],
      outliers: [],
      fieldSummary,
    };
  }

  const opponentsWithin = (team: SeededTeam, band: number) =>
    withMmr.filter(o => o.teamId !== team.teamId && Math.abs(o.seedMmr - team.seedMmr) <= band).length;

  // Every distinct pairing, used to express what a band allows/removes.
  const allPairs: Array<{ gap: number }> = [];
  for (let i = 0; i < withMmr.length; i++) {
    for (let j = i + 1; j < withMmr.length; j++) {
      allPairs.push({ gap: Math.abs(withMmr[i].seedMmr - withMmr[j].seedMmr) });
    }
  }
  const totalStomps = allPairs.filter(p => p.gap >= CERTAIN_WIN_GAP).length;

  const options: BandOption[] = CANDIDATE_BANDS.map(band => {
    const counts = withMmr.map(t => opponentsWithin(t, band));
    const allowed = allPairs.filter(p => p.gap <= band);
    const removedStomps = totalStomps
      ? allPairs.filter(p => p.gap >= CERTAIN_WIN_GAP && p.gap > band).length / totalStomps
      : 0;
    return {
      band,
      pairingsAllowed: allPairs.length ? allowed.length / allPairs.length : 0,
      isolatedTeams: withMmr.filter(t => opponentsWithin(t, band) < rounds).map(t => t.teamId),
      medianOpponents: median(counts),
      stompsRemoved: removedStomps,
    };
  });

  const satisfied = (band: number) =>
    withMmr.filter(t => opponentsWithin(t, band) >= rounds).length / withMmr.length;

  const suggested = CANDIDATE_BANDS.find(b => satisfied(b) >= coverage) ?? null;

  // Teams whose nearest neighbour is so far away that no realistic band reaches
  // them. Flagging these is more useful than widening the band for everyone.
  const outliers = withMmr
    .map(t => {
      const nearest = Math.min(
        ...withMmr.filter(o => o.teamId !== t.teamId).map(o => Math.abs(o.seedMmr - t.seedMmr))
      );
      return { teamId: t.teamId, seedMmr: t.seedMmr, nearestGap: nearest };
    })
    .filter(t => t.nearestGap > CERTAIN_WIN_GAP)
    .sort((a, b) => b.nearestGap - a.nearestGap);

  const reason = suggested
    ? `Przy zakresie ${suggested} większość drużyn (${Math.round(satisfied(suggested) * 100)}%) ` +
      `ma dość przeciwników na ${rounds} rund. Węższy zakres oznaczałby dużo powtórzonych par.`
    : 'Pole jest zbyt rozproszone — żaden zakres nie zapewni większości drużyn dość przeciwników.';

  return { suggested, reason, options, outliers, fieldSummary };
}
