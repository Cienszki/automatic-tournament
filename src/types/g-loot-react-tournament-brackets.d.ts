declare module '@g-loot/react-tournament-brackets' {
  export interface MatchParticipant {
    id: string;
    resultText?: string | null;
    isWinner?: boolean;
    status?: 'PLAYED' | 'NO_SHOW' | 'WALK_OVER' | 'NO_PARTY' | null;
    name: string;
  }

  export interface BracketMatch {
    id: string | number;
    name: string;
    nextMatchId?: string | number | null;
    nextLooserMatchId?: string | number | null;
    tournamentRoundText?: string;
    startTime?: string;
    state: 'NO_SHOW' | 'WALK_OVER' | 'NO_PARTY' | 'DONE' | 'SCORE_DONE';
    participants: MatchParticipant[];
  }

  export interface DoubleEliminationMatches {
    upper: BracketMatch[];
    lower: BracketMatch[];
  }

  export interface MatchComponentProps {
    match: BracketMatch;
    onMatchClick?: (match: BracketMatch) => void;
    onPartyClick?: (match: BracketMatch, party: MatchParticipant) => void;
    onMouseEnter?: (match: BracketMatch) => void;
    onMouseLeave?: (match: BracketMatch) => void;
    topWon?: boolean;
    bottomWon?: boolean;
    topHovered?: boolean;
    bottomHovered?: boolean;
    topText?: string;
    bottomText?: string;
    connectorColor?: string;
    computedStyles?: any;
    teamNameFallback?: string;
    resultFallback?: string;
  }

  export interface SVGWrapperProps {
    children: React.ReactNode;
    [key: string]: any;
  }

  export interface BracketProps {
    matches: BracketMatch[] | DoubleEliminationMatches;
    matchComponent?: React.ComponentType<MatchComponentProps>;
    svgWrapper?: React.ComponentType<SVGWrapperProps>;
    currentRound?: string;
    onMatchClick?: (match: BracketMatch) => void;
    onPartyClick?: (match: BracketMatch, party: MatchParticipant) => void;
    onMouseEnter?: (match: BracketMatch) => void;
    onMouseLeave?: (match: BracketMatch) => void;
  }

  export interface SVGViewerProps {
    width: number;
    height: number;
    background?: string;
    children: React.ReactNode;
    [key: string]: any;
  }

  export const SingleEliminationBracket: React.ComponentType<BracketProps>;
  export const DoubleEliminationBracket: React.ComponentType<BracketProps>;
  export const Match: React.ComponentType<MatchComponentProps>;
  export const SVGViewer: React.ComponentType<SVGViewerProps>;
  
  export const MATCH_STATES: {
    NO_SHOW: 'NO_SHOW';
    WALK_OVER: 'WALK_OVER';
    NO_PARTY: 'NO_PARTY';
    DONE: 'DONE';
    SCORE_DONE: 'SCORE_DONE';
  };
}
