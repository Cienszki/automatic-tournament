import { describe, expect, it } from 'vitest';
import * as L from './runner-logic';
import type { LobbySlot, SeriesFormat, TeamAssignment } from './types';

function team(teamId: string, ids: string[], extra: Partial<TeamAssignment> = {}): TeamAssignment {
  return {
    teamId,
    teamName: `Team ${teamId}`,
    expectedPlayers: ids.map((id) => ({ steamId32: id, nickname: `nick-${id}` })),
    ...extra,
  };
}

const rosters = { radiantTeam: team('A', ['1', '2']), direTeam: team('B', ['3', '4']) };

function series(format: SeriesFormat, winners: Array<'A' | 'B'>, totalGames: number) {
  const seriesScore = { A: winners.filter((w) => w === 'A').length, B: winners.filter((w) => w === 'B').length };
  return { ...rosters, seriesFormat: format, totalGames, seriesScore, completedGameIds: winners.map((_, i) => 100 + i) };
}

describe('toLobbyCreateSettings', () => {
  it('maps the admin strings to GC enums and carries the series fields from the session', () => {
    const s = L.toLobbyCreateSettings(
      { gameMode: 'all_pick', serverRegion: 'europe_east', visibility: 'unlisted', pauseSetting: 'disabled', leagueId: 77, dotaTvDelay: 300 },
      { lobbySeriesType: 1, lobbyRadiantWins: 1, lobbyDireWins: 0 },
    );
    expect(s).toEqual({
      gameMode: 1, serverRegion: 8, visibility: 2, dotaTvDelay: 300, seriesType: 1, leagueId: 77,
      cheatsEnabled: false, fillWithBots: false, allowSpectators: true, pauseSetting: 2,
      selectionPriorityRules: 1, radiantSeriesWins: 1, direSeriesWins: 0,
    });
  });

  it('falls back to Captains Mode, Europe West, public, unlimited pauses and coin toss when unset', () => {
    const s = L.toLobbyCreateSettings({}, {});
    expect(s).toMatchObject({ gameMode: 2, serverRegion: 3, visibility: 0, pauseSetting: 0, dotaTvDelay: 120, seriesType: 0, selectionPriorityRules: 1 });
  });

  it('keeps Manual selection priority (0) instead of treating it as unset', () => {
    expect(L.toLobbyCreateSettings({ selectionPriorityRules: 0 }, {}).selectionPriorityRules).toBe(0);
  });
});

describe('roster identity', () => {
  it('authorizes both rosters, coaches and the whitelist', () => {
    const s = { radiantTeam: team('A', ['1'], { coachSteamId32: '9' }), direTeam: team('B', ['3']) };
    expect([...L.getAllAuthorizedSteamIds(s, [{ steamId32: '50' }])].sort()).toEqual(['1', '3', '50', '9']);
  });

  it('finds the expected side of a player, or null for a stranger', () => {
    expect(L.getExpectedTeamSide(rosters, '2')).toBe('radiant');
    expect(L.identifyPlayerTeam(rosters, '4')).toBe('dire');
    expect(L.getExpectedTeamSide(rosters, '99')).toBeNull();
  });

  it('returns the roster nickname, or the id itself for a stranger', () => {
    expect(L.getPlayerNickname(rosters, '3')).toBe('nick-3');
    expect(L.getPlayerNickname(rosters, '99')).toBe('99');
  });
});

describe('ready and unready commands', () => {
  it.each([
    ['!ready', true], ['  !READY ', true], ['!r', true], ['!ready now', false], ['ready', false],
  ])('%j is a ready command: %s', (message, expected) => {
    expect(L.isReadyCommand(message, ['!ready', '!r'])).toBe(expected);
  });

  it('treats a missing command list as no commands', () => {
    expect(L.isReadyCommand('!ready', undefined)).toBe(false);
    expect(L.isUnreadyCommand('!unready', undefined)).toBe(false);
    expect(L.isUnreadyCommand('!UNREADY', ['!unready'])).toBe(true);
  });
});

describe('evaluateEnforcement', () => {
  const players: LobbySlot[] = [
    { steamId32: '1', teamSide: 'radiant', name: 'one' },
    { steamId32: '66', teamSide: 'dire', name: '  Intruder ' },
    { steamId32: '67', teamSide: 'spectator', name: null },
    { steamId32: '68', teamSide: 'unassigned', name: 'pool' },
    { steamId32: '69', teamSide: 'broadcaster', name: 'caster' },
    { steamId32: '0', teamSide: 'radiant' },
    { steamId32: '50', teamSide: 'dire', name: 'whitelisted' },
  ];

  it('kicks strangers in team, spectator and pool slots, never broadcasters, empty slots or the whitelist', () => {
    const a = L.evaluateEnforcement(rosters, players, { autoKickUnauthorized: true }, [{ steamId32: '50' }]);
    expect(a.kickPlayers).toEqual([
      { steamId32: '66', reason: 'not_registered' },
      { steamId32: '67', reason: 'not_registered' },
      { steamId32: '68', reason: 'not_registered' },
    ]);
    // A chat line only for slot and spectator kicks, named by the trimmed Steam name or the id.
    expect(a.chatMessages).toEqual([
      'Player Intruder is not registered for this match and has been removed.',
      'Player Steam32 67 is not registered for this match and has been removed.',
    ]);
  });

  it('does nothing when auto-kick is off or there is no config', () => {
    expect(L.evaluateEnforcement(rosters, players, { autoKickUnauthorized: false }).kickPlayers).toEqual([]);
    expect(L.evaluateEnforcement(rosters, players, null).kickPlayers).toEqual([]);
  });
});

describe('seating', () => {
  it('reports the one side a whole team sits on', () => {
    const live: LobbySlot[] = [{ steamId32: '1', teamSide: 'dire' }, { steamId32: '2', teamSide: 'dire' }];
    expect(L.teamSeatedSide(rosters.radiantTeam, live)).toBe('dire');
  });

  it('returns null while a player is missing or not on a team slot', () => {
    expect(L.teamSeatedSide(rosters.radiantTeam, [{ steamId32: '1', teamSide: 'radiant' }])).toBeNull();
    expect(L.teamSeatedSide(rosters.radiantTeam, [{ steamId32: '1', teamSide: 'radiant' }, { steamId32: '2', teamSide: 'spectator' }])).toBeNull();
  });

  it('returns null and names the team when it is split across sides', () => {
    const live: LobbySlot[] = [{ steamId32: '1', teamSide: 'radiant' }, { steamId32: '2', teamSide: 'dire' }];
    expect(L.teamSeatedSide(rosters.radiantTeam, live)).toBeNull();
    expect(L.findSplitTeams(rosters, live)).toEqual(['Team A']);
  });

  it('counts presence from the live list, else from lastLobbyPlayers', () => {
    expect(L.computeTeamPresence(rosters, [{ steamId32: '1' }, { steamId32: '3' }, { steamId32: '4' }])).toEqual({ radiant: 1, dire: 2 });
    expect(L.computeTeamPresence({ ...rosters, lastLobbyPlayers: [{ steamId32: '2', teamSide: 'radiant' }] })).toEqual({ radiant: 1, dire: 0 });
  });
});

describe('calculateSeriesResult', () => {
  it.each<[SeriesFormat, Array<'A' | 'B'>, number, boolean, string | null, boolean]>([
    // format, game winners, totalGames, decided, winner, draw
    ['bo1', [], 1, false, null, false],
    ['bo1', ['B'], 1, true, 'B', false],
    ['bo3', ['A'], 3, false, null, false],
    ['bo3', ['A', 'B'], 3, false, null, false],
    ['bo3', ['A', 'B', 'A'], 3, true, 'A', false],
    ['bo3', ['B', 'B'], 3, true, 'B', false],
    ['bo5', ['A', 'A', 'B', 'B'], 5, false, null, false],
    ['bo5', ['A', 'A', 'B', 'B', 'B'], 5, true, 'B', false],
    // BO2: both games are always played; 1:1 is a draw.
    ['bo2', ['A'], 2, false, null, false],
    ['bo2', ['A', 'A'], 2, true, 'A', false],
    ['bo2', ['A', 'B'], 2, true, null, true],
  ])('%s with winners %j of %i games: decided=%s winner=%s draw=%s', (format, winners, total, decided, winner, draw) => {
    const r = L.calculateSeriesResult(series(format, winners, total));
    expect(r.decided).toBe(decided);
    expect(r.winnerId).toBe(winner);
    expect(r.isDraw).toBe(draw);
    expect(r.gamesPlayed).toBe(winners.length);
  });

  it('counts a forfeited game (match id 0) like a played one', () => {
    const s = { ...series('bo3', ['A'], 3), completedGameIds: [0], seriesScore: { A: 1, B: 0 } };
    expect(L.getNextGameNumber(s)).toBe(2);
  });

  it('ends a series that ran out of games level as a draw', () => {
    const r = L.calculateSeriesResult(series('bo3', ['A', 'B'], 2));
    expect(r).toMatchObject({ decided: true, isDraw: true, winnerId: null });
  });

  it('gives the next game number, or null once decided', () => {
    expect(L.getNextGameNumber(series('bo3', ['A', 'B'], 3))).toBe(3);
    expect(L.getNextGameNumber(series('bo3', ['A', 'A'], 3))).toBeNull();
  });

  it('formats the score as radiant team first', () => {
    expect(L.formatSeriesScore({ ...rosters, seriesScore: { A: 2, B: 1 } })).toBe('Team A 2 - 1 Team B');
    expect(L.formatSeriesScore({ ...rosters, seriesScore: {} })).toBe('Team A 0 - 0 Team B');
  });
});

describe('chat templates', () => {
  it('merges per-bot overrides on top of the tournament messages', () => {
    const cfg = { chatMessages: { welcomeMessage: 'hi', allReadyMessage: 'go' }, perBotMessages: { bot1: { welcomeMessage: 'yo' } } };
    expect(L.getEffectiveChatMessages(cfg, 'bot1')).toEqual({ welcomeMessage: 'yo', allReadyMessage: 'go' });
    expect(L.getEffectiveChatMessages(cfg, 'bot2')).toEqual({ welcomeMessage: 'hi', allReadyMessage: 'go' });
    expect(L.getEffectiveChatMessages(null, 'bot1')).toEqual({});
  });

  it('fills the three ready-check placeholders and blanks missing ones', () => {
    expect(L.applyPlaceholders('{player_name} of {team_name}: {missing} {other}', { player_name: 'Ana', team_name: 'A' }))
      .toBe('Ana of A:  {other}');
    expect(L.applyPlaceholders(undefined, {})).toBe('');
  });

  it('fills late-arrival tokens and leaves unknown ones intact', () => {
    expect(L.applyLatePlaceholders('{late_team} late {minutes}m, {unknown}', { late_team: 'B', minutes: '10' }))
      .toBe('B late 10m, {unknown}');
  });
});
