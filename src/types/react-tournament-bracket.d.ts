// src/types/react-tournament-bracket.d.ts

declare module 'react-tournament-bracket' {
  export enum Side {
    HOME = "home",
    VISITOR = "visitor",
  }

  export type ID = string;

  export interface SideInfo {
    score?: {
      score: number;
    };
    seed?: {
      displayName: string;
      rank: number;
      sourceGame?: Game;
      sourcePool?: object;
    };
    team?: {
      id: ID;
      name: string;
    };
  }

  export interface Game {
    id: ID;
    name: string;
    bracketLabel?: string;
    scheduled: number;
    court?: {
      name: string;
      venue: {
        name: string;
      };
    };
    sides: {
      [side in Side]: SideInfo;
    };
  }

  export interface BracketProps {
    game: Game;
    homeOnTop?: boolean;
    gameDimensions?: {
      height: number;
      width: number;
    };
    svgPadding?: number;
    roundSeparatorWidth?: number;
  }

  export default class Bracket extends React.Component<BracketProps> {}
  export const BracketGame: React.ComponentType<any>;
  export const BracketGenerator: React.ComponentType<any>;
  export const Model: any;
}
