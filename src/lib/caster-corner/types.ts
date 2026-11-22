// Shapes of the caster corner's data (GET /api/caster-corner) shared by the page and the brief.

import type { MatchCaster } from '@/lib/casters';
import type { DpStandin, DpTeam } from '@/lib/draft-prep/types';

export interface CornerMatch {
  id: string;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  status: string;
  scheduledFor: string | null;
  completedAt: string | null;
  bestOf: number;
  round: number | null;
  matchday: number | null;
  /** LAN qualifier group: A / B (Swiss) / F (Final) / P (placements) */
  stage: string | null;
  /** GSL slot o1 / o2 / w / l / d, or 'tb' */
  slot: string | null;
  isPlayoff: boolean;
  casters: MatchCaster[];
  lobby: { name: string; password: string | null } | null;
  standins: DpStandin[];
}

export interface CareerRef { key: string; name: string; short: string }

export interface CornerData {
  type: string | null;
  name: string;
  me: string;
  matches: CornerMatch[];
  rosters: DpTeam[];
  careers: CareerRef[];
}
