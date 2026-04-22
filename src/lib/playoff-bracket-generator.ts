import type { PlayoffMatch, PlayoffMatchFormat, PlayoffBracketType } from './definitions';

export interface BracketConfig {
  format: 'single-elimination' | 'double-elimination';
  upperBracketTeams: number;
  lowerBracketTeams: number;
  defaultFormat: PlayoffMatchFormat;
  semifinalFormat: PlayoffMatchFormat;
  finalFormat: PlayoffMatchFormat;
  grandFinalFormat: PlayoffMatchFormat;
}

/** Generate abbreviated match code: U1A, L2C, GF, etc. */
export function getMatchCode(
  bracketType: PlayoffBracketType,
  round: number,
  position: number,
): string {
  if (bracketType === 'final') return 'GF';
  const prefix = bracketType === 'upper' ? 'U' : 'L';
  const posLetter = String.fromCharCode(64 + position); // A=1, B=2, …
  return `${prefix}${round}${posLetter}`;
}

function createMatch(
  overrides: Partial<PlayoffMatch> & {
    id: string;
    bracketType: PlayoffBracketType;
    round: number;
    position: number;
    format: PlayoffMatchFormat;
  },
): PlayoffMatch {
  const now = new Date().toISOString();
  return {
    status: 'scheduled',
    createdAt: now,
    updatedAt: now,
    code: getMatchCode(overrides.bracketType, overrides.round, overrides.position),
    ...overrides,
  };
}

/** Main entry — generates a complete bracket structure. */
export function generateBracket(config: BracketConfig): PlayoffMatch[] {
  if (config.format === 'single-elimination') {
    return generateSingleElimination(config);
  }
  return generateDoubleElimination(config);
}

// ─── Single Elimination ────────────────────────────────────────────────

function generateSingleElimination(config: BracketConfig): PlayoffMatch[] {
  const matches: PlayoffMatch[] = [];
  const n = config.upperBracketTeams;
  const totalRounds = Math.ceil(Math.log2(n));

  for (let r = 1; r <= totalRounds; r++) {
    const matchCount = Math.max(Math.ceil(n / Math.pow(2, r)), 1);
    const isFinal = r === totalRounds;
    const isSemi = r === totalRounds - 1;

    for (let p = 1; p <= matchCount; p++) {
      const matchId = `ub-r${r}-p${p}`;

      let nextWinnerMatchId: string | undefined;
      let nextWinnerSlot: 'teamA' | 'teamB' | undefined;

      if (!isFinal) {
        nextWinnerMatchId = `ub-r${r + 1}-p${Math.ceil(p / 2)}`;
        nextWinnerSlot = p % 2 === 1 ? 'teamA' : 'teamB';
      }

      const format = isFinal
        ? config.grandFinalFormat
        : isSemi
          ? config.semifinalFormat
          : config.defaultFormat;

      matches.push(
        createMatch({
          id: matchId,
          bracketType: isFinal ? 'final' : 'upper',
          round: r,
          position: p,
          format,
          nextWinnerMatchId,
          nextWinnerSlot,
        }),
      );
    }
  }

  return matches;
}

// ─── Double Elimination ────────────────────────────────────────────────

function generateDoubleElimination(config: BracketConfig): PlayoffMatch[] {
  const matches: PlayoffMatch[] = [];
  const ubTeams = config.upperBracketTeams;
  const ubRounds = Math.ceil(Math.log2(ubTeams));
  const lbTotalRounds = 2 * (ubRounds - 1);

  // ── Upper Bracket ──────────────────────────────────────────────────
  for (let r = 1; r <= ubRounds; r++) {
    const matchCount = Math.ceil(ubTeams / Math.pow(2, r));
    const isUBFinal = r === ubRounds;
    const isSemi = r === ubRounds - 1;

    for (let p = 1; p <= matchCount; p++) {
      const matchId = `ub-r${r}-p${p}`;

      let nextWinnerMatchId: string | undefined;
      let nextWinnerSlot: 'teamA' | 'teamB' | undefined;
      let nextLoserMatchId: string | undefined;
      let nextLoserSlot: 'teamA' | 'teamB' | undefined;

      // Winner advancement
      if (!isUBFinal) {
        nextWinnerMatchId = `ub-r${r + 1}-p${Math.ceil(p / 2)}`;
        nextWinnerSlot = p % 2 === 1 ? 'teamA' : 'teamB';
      } else {
        nextWinnerMatchId = 'gf';
        nextWinnerSlot = 'teamA';
      }

      // Loser drops to LB
      if (r === 1) {
        // UB R1 losers pair up in LB R1
        const lbPos = Math.ceil(p / 2);
        nextLoserMatchId = `lb-r1-p${lbPos}`;
        nextLoserSlot = p % 2 === 1 ? 'teamA' : 'teamB';
      } else if (!isUBFinal) {
        // UB Rk (k≥2) losers → LB drop-down round R(2*(k-1))
        const lbDropRound = 2 * (r - 1);
        nextLoserMatchId = `lb-r${lbDropRound}-p${p}`;
        nextLoserSlot = 'teamB';
      } else {
        // UB Final loser → LB Final
        nextLoserMatchId = `lb-r${lbTotalRounds}-p1`;
        nextLoserSlot = 'teamB';
      }

      const format = isUBFinal
        ? config.finalFormat
        : isSemi
          ? config.semifinalFormat
          : config.defaultFormat;

      matches.push(
        createMatch({
          id: matchId,
          bracketType: 'upper',
          round: r,
          position: p,
          format,
          nextWinnerMatchId,
          nextWinnerSlot,
          nextLoserMatchId,
          nextLoserSlot,
        }),
      );
    }
  }

  // ── Lower Bracket ──────────────────────────────────────────────────
  for (let r = 1; r <= lbTotalRounds; r++) {
    const k = Math.ceil(r / 2);
    const matchCount = Math.max(Math.ceil(ubTeams / Math.pow(2, k + 1)), 1);
    const isOdd = r % 2 === 1;
    const isLBFinal = r === lbTotalRounds;

    for (let p = 1; p <= matchCount; p++) {
      const matchId = `lb-r${r}-p${p}`;

      let nextWinnerMatchId: string | undefined;
      let nextWinnerSlot: 'teamA' | 'teamB' | undefined;

      if (isLBFinal) {
        // LB Final winner → Grand Final
        nextWinnerMatchId = 'gf';
        nextWinnerSlot = 'teamB';
      } else if (isOdd) {
        // Reduction → next (drop-down) round, 1:1
        nextWinnerMatchId = `lb-r${r + 1}-p${p}`;
        nextWinnerSlot = 'teamA';
      } else {
        // Drop-down → next (reduction) round, 2:1 merge
        nextWinnerMatchId = `lb-r${r + 1}-p${Math.ceil(p / 2)}`;
        nextWinnerSlot = p % 2 === 1 ? 'teamA' : 'teamB';
      }

      matches.push(
        createMatch({
          id: matchId,
          bracketType: 'lower',
          round: r,
          position: p,
          format: isLBFinal ? config.finalFormat : config.defaultFormat,
          nextWinnerMatchId,
          nextWinnerSlot,
        }),
      );
    }
  }

  // ── Grand Final ────────────────────────────────────────────────────
  matches.push(
    createMatch({
      id: 'gf',
      bracketType: 'final',
      round: ubRounds + 1,
      position: 1,
      format: config.grandFinalFormat,
    }),
  );

  return matches;
}

// ─── Layout helpers ────────────────────────────────────────────────────

const CARD_HEIGHT = 108;
const CARD_GAP = 16;
const UNIT_HEIGHT = (CARD_HEIGHT + CARD_GAP) / 2; // 62px
const CARD_WIDTH = 272;
const CONNECTOR_WIDTH = 50;

export { CARD_HEIGHT, CARD_GAP, UNIT_HEIGHT, CARD_WIDTH, CONNECTOR_WIDTH };

/** Y-position (in units) for a match in the upper bracket / single elim. */
export function getUBYUnits(round: number, position: number): number {
  return (2 * position - 1) * Math.pow(2, round - 1) - 1;
}

/** Y-position (in units) for a match in the lower bracket. */
export function getLBYUnits(round: number, position: number): number {
  const k = Math.ceil(round / 2);
  return (position - 1) * Math.pow(2, k) + (Math.pow(2, k - 1) - 1);
}

export interface PositionedMatch {
  match: PlayoffMatch;
  x: number;
  y: number;
}

export interface ConnectorLine {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

/** Compute pixel positions for all matches in a bracket view (upper+final or lower). */
export function computeBracketLayout(
  matches: PlayoffMatch[],
  view: 'upper' | 'lower',
): { positions: PositionedMatch[]; connectors: ConnectorLine[]; totalWidth: number; totalHeight: number; roundCount: number } {
  // Separate matches by view
  const viewMatches = view === 'upper'
    ? matches.filter(m => m.bracketType === 'upper' || m.bracketType === 'final')
    : matches.filter(m => m.bracketType === 'lower');

  if (viewMatches.length === 0) {
    return { positions: [], connectors: [], totalWidth: 0, totalHeight: 0, roundCount: 0 };
  }

  // Group by round
  const roundMap = new Map<number, PlayoffMatch[]>();
  for (const m of viewMatches) {
    const round = m.round;
    if (!roundMap.has(round)) roundMap.set(round, []);
    roundMap.get(round)!.push(m);
  }
  roundMap.forEach(arr => arr.sort((a, b) => a.position - b.position));

  const rounds = Array.from(roundMap.keys()).sort((a, b) => a - b);
  const roundCount = rounds.length;

  // Map round number → visual column index (0-based)
  const roundToCol = new Map<number, number>();
  rounds.forEach((r, i) => roundToCol.set(r, i));

  // Compute positions
  const positions: PositionedMatch[] = [];
  let maxYUnits = 0;

  for (const m of viewMatches) {
    const col = roundToCol.get(m.round)!;
    const x = col * (CARD_WIDTH + CONNECTOR_WIDTH);

    let yUnits: number;
    if (view === 'upper') {
      yUnits = getUBYUnits(roundToCol.get(m.round)! + 1, m.position);
    } else {
      yUnits = getLBYUnits(roundToCol.get(m.round)! + 1, m.position);
    }

    const y = yUnits * UNIT_HEIGHT;
    maxYUnits = Math.max(maxYUnits, yUnits);
    positions.push({ match: m, x, y });
  }

  const totalHeight = maxYUnits * UNIT_HEIGHT + CARD_HEIGHT;
  const totalWidth = roundCount * CARD_WIDTH + (roundCount - 1) * CONNECTOR_WIDTH;

  // Compute connector lines
  const connectors: ConnectorLine[] = [];
  const posMap = new Map<string, PositionedMatch>();
  for (const p of positions) posMap.set(p.match.id, p);

  for (const pm of positions) {
    if (!pm.match.nextWinnerMatchId) continue;
    const target = posMap.get(pm.match.nextWinnerMatchId);
    if (!target) continue;

    connectors.push({
      fromX: pm.x + CARD_WIDTH,
      fromY: pm.y + CARD_HEIGHT / 2,
      toX: target.x,
      toY: target.y + CARD_HEIGHT / 2,
    });
  }

  return { positions, connectors, totalWidth, totalHeight, roundCount };
}
