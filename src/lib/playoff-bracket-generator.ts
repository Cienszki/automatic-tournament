import type { PlayoffMatch, PlayoffMatchFormat, PlayoffBracketType } from './definitions';

/** Sentinel id prefix for the synthetic "BYE" placeholder team (auto-advance). */
export const BYE_TEAM_SENTINEL = '__PLAYOFF_BYE__';

/** Whether a team slot holds the synthetic BYE placeholder. */
export function isByeTeam(team?: { id?: string } | null): boolean {
  return !!team?.id?.startsWith(BYE_TEAM_SENTINEL);
}

/**
 * A match resolved by a bye: it is flagged `bye`, or either slot holds the
 * BYE placeholder (the opponent auto-advances, so the card is not shown).
 */
export function isByeMatch(match: {
  status?: string;
  teamA?: { id?: string } | null;
  teamB?: { id?: string } | null;
}): boolean {
  return match.status === 'bye' || isByeTeam(match.teamA) || isByeTeam(match.teamB);
}

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

export interface MirroredColumn {
  x: number;
  kind: 'upper' | 'lower' | 'final';
  round: number;
}

/**
 * Compute a "folded" layout: the bracket is split at its final. The final sits
 * in the middle; one semifinal's whole subtree flows left→center, the other's
 * subtree is mirrored on the right flowing right→center.
 *
 * Column order (left → right), for a 3-round-per-side bracket:
 *   R1 … R2 … Semifinal | Final | Semifinal … R2 … R1
 */
export function computeMirroredBracketLayout(matches: PlayoffMatch[]): {
  positions: PositionedMatch[];
  connectors: ConnectorLine[];
  columns: MirroredColumn[];
  totalWidth: number;
  totalHeight: number;
} {
  // Tighter gaps than the single-column view — the folded bracket packs cards
  // closer together while the connectors still reach cleanly between columns.
  const GAP_X = 26;
  const GAP_Y = 10;
  const STEP = CARD_WIDTH + GAP_X;
  const ROW = CARD_HEIGHT + GAP_Y;

  if (matches.length === 0) {
    return { positions: [], connectors: [], columns: [], totalWidth: 0, totalHeight: 0 };
  }

  const byId = new Map(matches.map(m => [m.id, m]));

  // Winner-advancement tree: children[T] = matches whose winner advances to T.
  const childMap = new Map<string, PlayoffMatch[]>();
  for (const m of matches) {
    const t = m.nextWinnerMatchId;
    if (t && byId.has(t)) {
      if (!childMap.has(t)) childMap.set(t, []);
      childMap.get(t)!.push(m);
    }
  }
  // Order children top→bottom: the winner filling `teamA` sits above `teamB`.
  const slotRank = (m: PlayoffMatch) => (m.nextWinnerSlot === 'teamB' ? 1 : 0);
  for (const arr of childMap.values()) {
    arr.sort((a, b) => slotRank(a) - slotRank(b) || a.position - b.position);
  }

  // Root = the terminal match (its winner does not advance within this set).
  // Prefer an explicit grand final; otherwise the deepest such match.
  const terminals = matches.filter(m => !m.nextWinnerMatchId || !byId.has(m.nextWinnerMatchId));
  const root =
    terminals.find(m => m.bracketType === 'final') ||
    [...terminals].sort((a, b) => b.round - a.round)[0] ||
    matches[0];

  const sideKind = (m: PlayoffMatch): 'upper' | 'lower' =>
    m.bracketType === 'lower' ? 'lower' : 'upper';

  interface SideNode { match: PlayoffMatch; depth: number; yRow: number }

  // Lay out one subtree: leaves stack top→bottom, each internal node is centred
  // between its children. depth 1 = the semifinal adjacent to the final.
  const layoutSide = (start?: PlayoffMatch): { nodes: SideNode[]; leaves: number; maxDepth: number } => {
    const nodes: SideNode[] = [];
    let leaf = 0;
    let maxDepth = 0;
    if (!start) return { nodes, leaves: 0, maxDepth: 0 };

    const visit = (m: PlayoffMatch, depth: number): number => {
      maxDepth = Math.max(maxDepth, depth);
      const kids = childMap.get(m.id) || [];
      let yRow: number;
      if (kids.length === 0) {
        yRow = leaf;
        leaf += 1;
      } else {
        const ys = kids.map(k => visit(k, depth + 1));
        yRow = (Math.min(...ys) + Math.max(...ys)) / 2;
      }
      nodes.push({ match: m, depth, yRow });
      return yRow;
    };

    visit(start, 1);
    return { nodes, leaves: leaf, maxDepth };
  };

  const rootKids = childMap.get(root.id) || [];
  const left = layoutSide(rootKids[0]);
  const right = layoutSide(rootKids[1]);

  const sideMaxDepth = Math.max(left.maxDepth, right.maxDepth, 0);
  const centerCol = sideMaxDepth; // the final's column

  const sideHeight = (leaves: number) => (leaves > 0 ? (leaves - 1) * ROW + CARD_HEIGHT : 0);
  const leftHeight = sideHeight(left.leaves);
  const rightHeight = sideHeight(right.leaves);
  const contentHeight = Math.max(leftHeight, rightHeight, CARD_HEIGHT);
  const leftYOffset = (contentHeight - leftHeight) / 2;
  const rightYOffset = (contentHeight - rightHeight) / 2;

  const positions: PositionedMatch[] = [];
  for (const n of left.nodes) {
    positions.push({ match: n.match, x: (centerCol - n.depth) * STEP, y: n.yRow * ROW + leftYOffset });
  }
  for (const n of right.nodes) {
    positions.push({ match: n.match, x: (centerCol + n.depth) * STEP, y: n.yRow * ROW + rightYOffset });
  }
  // Final in the centre column, vertically centred (aligns with both semifinals).
  positions.push({ match: root, x: centerCol * STEP, y: contentHeight / 2 - CARD_HEIGHT / 2 });

  // ── Connectors (winner links); direction depends on which side the target is ──
  const posMap = new Map<string, PositionedMatch>();
  for (const p of positions) posMap.set(p.match.id, p);

  const connectors: ConnectorLine[] = [];
  for (const pm of positions) {
    const targetId = pm.match.nextWinnerMatchId;
    if (!targetId) continue;
    const target = posMap.get(targetId);
    if (!target) continue;

    if (target.x >= pm.x) {
      // flows rightward (left side, and into the final from the left)
      connectors.push({
        fromX: pm.x + CARD_WIDTH,
        fromY: pm.y + CARD_HEIGHT / 2,
        toX: target.x,
        toY: target.y + CARD_HEIGHT / 2,
      });
    } else {
      // flows leftward (mirrored right side, and into the final from the right)
      connectors.push({
        fromX: pm.x,
        fromY: pm.y + CARD_HEIGHT / 2,
        toX: target.x + CARD_WIDTH,
        toY: target.y + CARD_HEIGHT / 2,
      });
    }
  }

  // ── Column headers (one per distinct x) ──
  const colMap = new Map<number, MirroredColumn>();
  for (const n of left.nodes) {
    const x = (centerCol - n.depth) * STEP;
    if (!colMap.has(x)) colMap.set(x, { x, kind: sideKind(n.match), round: n.match.round });
  }
  for (const n of right.nodes) {
    const x = (centerCol + n.depth) * STEP;
    if (!colMap.has(x)) colMap.set(x, { x, kind: sideKind(n.match), round: n.match.round });
  }
  colMap.set(centerCol * STEP, { x: centerCol * STEP, kind: 'final', round: 0 });
  const columns = Array.from(colMap.values()).sort((a, b) => a.x - b.x);

  const totalCols = 2 * sideMaxDepth + 1;
  const totalWidth = totalCols * CARD_WIDTH + (totalCols - 1) * GAP_X;
  const totalHeight = contentHeight;

  return { positions, connectors, columns, totalWidth, totalHeight };
}
