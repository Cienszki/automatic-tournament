// vitest global setup: makes the migrated database copy once, before the test files start, so
// that parallel files do not each migrate a database of their own (src/platform/db/testing.ts).

import { ensureTemplate } from './testing';

export default async function setup(): Promise<void> {
  await ensureTemplate();
}
