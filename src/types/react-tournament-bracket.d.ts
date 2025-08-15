// src/types/react-tournament-bracket.d.ts

declare module 'react-tournament-bracket' {
  export interface BracketProps {
    rounds: Round[];
    roundTitleComponent?: React.ComponentType<any>;
    bracketClassName?: string;
  }

  export interface Round {
    title: string;
    seeds: Seed[];
  }

  export interface Seed {
    id: number | string;
    date: string;
    teams: SeedTeam[];
  }

  export interface SeedTeam {
    name: string;
    score?: number;
  }

  export const Bracket: React.ComponentType<BracketProps>;
  export const RoundHeader: React.ComponentType<any>;
  export const SingleLineSeed: React.ComponentType<any>;
}
