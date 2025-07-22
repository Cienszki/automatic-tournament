// src/lib/definitions.ts

export type Team = {
  id: string;
  name: string;
  tag: string;
  logoUrl?: string;
  captainId: string;
  players: Player[];
  status: 'pending' | 'verified' | 'rejected';
  createdAt: string;
  openDotaTeamId?: number; 
};

export type Player = {
  id: string;
  nickname: string;
  role: 'core' | 'support' | 'captain';
  steamId: string;
  openDotaAccountId?: number;
};

// Represents a single game from OpenDota
export type Match = {
  id: string; // Corresponds to OpenDota's match_id
  teamA: { id: string; name: string; score: number, logoUrl?: string }; // Score is kills in this game
  teamB: { id: string; name: string; score: number, logoUrl?: string };
  teams: [string, string]; // Array of the two team IDs
  winnerId: string; // The ID of the winning team
  dateTime: string;
  status: 'completed';
  duration: number; // Duration of the game in seconds
  openDotaMatchUrl?: string;
};

// Represents a team's performance and rank within a specific group
export type GroupStanding = {
  teamId: string;
  teamName: string;
  teamLogoUrl?: string;
  matchesPlayed: number; // Total games played
  points: number; // Total games won
  wins: number; // Total games won
  losses: number; // Total games lost
  // Tie-breaker stats
  headToHead: { [opponentId: string]: number }; // Maps opponentId to games won against them
  neustadtlScore: number;
  status: 'pending' | 'upper_bracket' | 'lower_bracket' | 'eliminated' | 'awaiting_upper_bracket_tiebreaker' | 'awaiting_lower_bracket_tiebreaker';
};

// Represents a single group containing multiple teams
export type Group = {
  id: string;
  name: string;
  standings: { [teamId: string]: GroupStanding }; // A map of teamId to their standing
};


export type PlayoffMatch = {
  id: string;
  round: number;
  match: number;
  teams: (string | null)[];
  winner?: string;
};
export type PlayoffData = {
  upper: PlayoffMatch[][];
  lower: PlayoffMatch[][];
};


export type UserProfile = {
  id: string;
  username: string;
  avatarUrl: string;
  roles: ('admin' | 'captain')[];
  teamId?: string;
};

// OpenDota API Specific Types
export type OpenDotaMatch = {
  match_id: number;
  radiant_win: boolean;
  radiant_score: number;
  dire_score: number;
  start_time: number;
  duration: number;
  radiant_team?: { team_id: number; name: string; };
  dire_team?: { team_id: number; name: string; };
  players: OpenDotaPlayer[];
};

export type OpenDotaPlayer = {
  account_id: number;
  personaname: string;
  hero_id: number;
  kills: number;
  deaths: number;
  assists: number;
  gold_per_min: number;
  xp_per_min: number;
  net_worth: number;
  hero_damage: number;
  tower_damage: number;
  // ... other stats
};

export type OpenDotaHero = {
    id: number;
    name: string;
    localized_name: string;
    primary_attr: string;
    attack_type: string;
    roles: string[];
    img: string;
    icon: string;
    base_health: number;
    base_health_regen: number;
    base_mana: number;
    base_mana_regen: number;
    base_armor: number;
    base_mr: number;
    base_attack_min: number;
    base_attack_max: number;
    base_str: number;
    base_agi: number;
    base_int: number;
    str_gain: number;
    agi_gain: number;
    int_gain: number;
    attack_range: number;
    projectile_speed: number;
    attack_rate: number;
    move_speed: number;
    turn_rate: number;
    cm_enabled: boolean;
    legs: number;
};
  

export type FantasyData = {
    userId: string;
    participantName: string;
    currentLineup: FantasyLineup;
    totalFantasyPoints: number;
    lastUpdated: Date;
    roundId: string;
  };
  
  export type FantasyLineup = {
    core: string[];
    support: string[];
  };

  export type TournamentPlayer = Player & {
    teamId: string;
    teamName: string;

    teamTag: string;
  };

  export type PickemPrediction = {
    userId: string;
    predictions: {
        [key: string]: string[];
    };
    lastUpdated: Date;
  };
  export const PlayerRoles = ['core', 'support', 'captain'];


  export type CategoryDisplayStats = {
    [key: string]: {
      id: string;
      categoryName: string;
      title: string;
      icon: string;
      rankings: CategoryRankingDetail[];
      data: any[];
    }
  };

  export type CategoryRankingDetail = {
    rank: number;
    player: Player;
    teamName: string;
    value: number | string;

    heroName?: string;
    matchContext?: string;
    category: string;
  };

  export type TournamentHighlightRecord = {
    id: string;
    title: string;
    value: number | string;
    details: string;
    icon: string;

    category: string;
    player: Player;
  };

  export type PlayerPerformanceInMatch = {
    playerId: string;
    matchId: string;
    kills: number;
    deaths: number;
    assists: number;
gpm: number;
    xpm: number;
    netWorth: number;
    heroDamage: number;
    towerDamage: number;
    healing: number;
    wardsPlaced: number;
    fantasyPoints: number;
  };
  
  export type Announcement = {
    id: string;
    title: string;
    content: string;
    authorId: string;
    authorName: string;
    createdAt: Date;
  };
  
