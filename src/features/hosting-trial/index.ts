// hosting-trial: throwaway endpoints for the WP-06 measurements (docs/overhaul/spikes/WP-06.md).
// Owns the bearer-token check and the two trial actions: invalidate a tournament's cached data,
// and time database reads from a function. Delete this folder and src/app/api/platform/trial
// once the trial's decision is made; nothing else imports them.
// Entry points: checkTrialAccess (pure); invalidateTournament and probeDatabase in commands.ts.

export { checkTrialAccess, type TrialAccess } from './secret';
