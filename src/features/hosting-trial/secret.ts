// The trial endpoints answer only a caller that sends PLATFORM_TRIAL_SECRET as a bearer token.
// Without the variable they do not exist (404), so a deployment that does not set it has none.

import { timingSafeEqual } from 'crypto';

export type TrialAccess = 'allowed' | 'disabled' | 'denied';

export function checkTrialAccess(authorization: string | null, secret: string | undefined): TrialAccess {
  if (!secret) return 'disabled';
  const given = Buffer.from((authorization ?? '').replace(/^Bearer\s+/i, ''));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected) ? 'allowed' : 'denied';
}
