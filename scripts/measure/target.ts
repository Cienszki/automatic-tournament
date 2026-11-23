// Which database invalidation.ts may rename a team in: the rules of scripts/db/target.ts, plus the
// database's own word for what it is (app.platform_settings, "environment").
//
//   - A PostgreSQL address only: the local PGlite folder is held by `dev:local` while it runs, so
//     give the address it serves (postgres://postgres:postgres@127.0.0.1:54329/postgres).
//   - A local address whose database says "local" or "staging".
//   - A remote address whose database says "staging". Anything else, production above all, and a
//     database that says nothing, is refused.

import { describeTarget, type DatabaseTarget } from '../db/target';

export function assertMayRename(target: DatabaseTarget, environment: string | null): void {
  if (target.kind === 'pglite') {
    throw new Error('Give the PostgreSQL address of the database (dev:local serves the local folder on 127.0.0.1:54329).');
  }
  const allowed = target.local ? ['local', 'staging'] : ['staging'];
  if (environment === null || !allowed.includes(environment)) {
    throw new Error(
      `Refusing to rename a team in the ${describeTarget(target)}: its app.platform_settings row "environment" is ` +
      `${environment === null ? 'missing' : `"${environment}"`}; allowed: ${allowed.join(' or ')}.`,
    );
  }
}
