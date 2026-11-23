// Where the import may write, and the refusals that keep it from writing anywhere else (WP-33
// point 8). It writes only to PostgreSQL: a local database (an in-process PGlite folder, or a
// PostgreSQL on this machine), the staging database, or the new production database, each named
// by an environment variable. It never reads or writes Firestore, and it refuses to start while
// Firebase service-account credentials are in the environment, so it cannot be run next to them
// by mistake.

export type TargetName = 'local' | 'staging' | 'production';

export type Target =
  | { name: 'local'; driver: 'pglite'; dir: string }
  | { name: TargetName; driver: 'postgres'; url: string; host: string };

export interface TargetRequest {
  target: string;
  /** `--db`: a PGlite data folder for the local target. */
  db?: string;
  anonymize: boolean;
  env: Record<string, string | undefined>;
}

/** Environment variables that name the databases the import may write to. */
export const TARGET_ENV = {
  local: 'LOCAL_DATABASE_URL',
  staging: 'STAGING_DATABASE_URL',
  production: 'NEW_PRODUCTION_DATABASE_URL',
} as const;

const CREDENTIAL_ENV = ['FIREBASE_SERVICE_ACCOUNT_BASE64', 'GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_SERVICE_ACCOUNT'];
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
export const DEFAULT_PGLITE_DIR = '.local/import-db';

export class TargetRefused extends Error {}

function parseUrl(url: string, variable: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new TargetRefused(`${variable} is not a URL`);
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new TargetRefused(`${variable} must be a postgres:// URL, not ${parsed.protocol}`);
  }
  return parsed;
}

/** The Supabase project a URL names: `db.<ref>.supabase.co`, or the pooler's user `postgres.<ref>`. */
function supabaseRef(url: URL): string | null {
  const host = /^db\.([a-z0-9]+)\.supabase\.co$/i.exec(url.hostname);
  if (host) return host[1].toLowerCase();
  const user = /^postgres\.([a-z0-9]+)$/i.exec(decodeURIComponent(url.username));
  return user ? user[1].toLowerCase() : null;
}

/**
 * Whether two URLs name the same database: the same host (any case), port (5432 when none is
 * given) and database name, or the same Supabase project, whose pooler and direct addresses have
 * different hosts, ports and users.
 */
export function sameDatabase(a: string, b: string): boolean {
  let x: URL;
  let y: URL;
  try {
    x = new URL(a);
    y = new URL(b);
  } catch {
    return a === b;
  }
  const refX = supabaseRef(x);
  if (refX && refX === supabaseRef(y)) return true;
  const key = (u: URL) => [u.hostname.toLowerCase(), u.port || '5432', decodeURIComponent(u.pathname.replace(/^\//, '')) || decodeURIComponent(u.username)].join('|');
  return key(x) === key(y);
}

/** The database to write to, or a `TargetRefused` with the reason. */
export function resolveTarget(req: TargetRequest): Target {
  const present = CREDENTIAL_ENV.filter((k) => req.env[k]);
  if (present.length) {
    throw new TargetRefused(`refusing to run with Firebase credentials in the environment (${present.join(', ')}); the import never needs them`);
  }
  if (req.target !== 'local' && req.target !== 'staging' && req.target !== 'production') {
    throw new TargetRefused(`unknown target "${req.target}": use local, staging or production`);
  }
  const name = req.target;
  if (name === 'staging' && !req.anonymize) throw new TargetRefused('the staging target requires --anonymize');
  if (name === 'production' && req.anonymize) throw new TargetRefused('--anonymize is for staging; the new production database gets the real data');
  if (name !== 'local' && req.db) throw new TargetRefused('--db names a local PGlite folder and is only for the local target');

  if (name === 'local') {
    const url = req.env[TARGET_ENV.local];
    if (!url) return { name, driver: 'pglite', dir: req.db ?? DEFAULT_PGLITE_DIR };
    if (req.db) throw new TargetRefused(`give either --db or ${TARGET_ENV.local}, not both`);
    const host = parseUrl(url, TARGET_ENV.local).hostname;
    if (!LOCAL_HOSTS.has(host)) throw new TargetRefused(`${TARGET_ENV.local} must point at this machine, not ${host}`);
    return { name, driver: 'postgres', url, host };
  }

  const variable = TARGET_ENV[name];
  const url = req.env[variable];
  if (!url) throw new TargetRefused(`the ${name} target needs ${variable}`);
  const host = parseUrl(url, variable).hostname;
  if (LOCAL_HOSTS.has(host)) throw new TargetRefused(`${variable} points at this machine; use the local target`);
  const other = name === 'staging' ? req.env[TARGET_ENV.production] : req.env[TARGET_ENV.staging];
  if (other && sameDatabase(other, url)) throw new TargetRefused(`${TARGET_ENV.staging} and ${TARGET_ENV.production} are the same database`);
  if (/firebase|firestore|googleapis\.com/i.test(host)) throw new TargetRefused(`${variable} looks like a Firebase address (${host})`);
  return { name, driver: 'postgres', url, host };
}
