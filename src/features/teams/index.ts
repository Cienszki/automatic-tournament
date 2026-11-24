// teams: a tournament's teams and their rosters, as the public pages show them.
// Owns the team list (order, groups, roster order). Does not own registration or roster changes
// (WP-17, WP-18) or a team's own page (WP-09).
// Entry points: buildTeamList (pure); the server reads listTeams and getTeamList are in queries.ts.

export { buildTeamList, type TeamListItem, type TeamListMember, type TeamStatus } from './domain/team-list';
export { TeamsView } from './components/TeamsView';
