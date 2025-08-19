import type { PlayerRole, TournamentPlayer } from "@/lib/definitions";

export type PlayerSelectionCardProps = {
  role: PlayerRole;
  playersByRole: Record<PlayerRole, TournamentPlayer[]>;
  selectedLineup: Partial<Record<PlayerRole, TournamentPlayer>>;
  onPlayerSelect: (role: PlayerRole, playerId: string) => void;
};
