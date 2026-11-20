// Command-line options shared by the database scripts.

export interface DbArgs {
  /** --database <url>; else DATABASE_URL; else the local PGlite folder. */
  database?: string;
  remote: boolean;
  staging: boolean;
  /** --phase <tournament>=<phase>, repeatable (db:seed). */
  phases: Record<string, string>;
  /** --only <tournament>, repeatable (db:seed). */
  only: string[];
}

export function parseDbArgs(argv: string[]): DbArgs {
  const args: DbArgs = { remote: false, staging: false, phases: {}, only: [] };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) throw new Error(`${key} needs a value`);
      return value;
    };
    if (key === '--database') args.database = next();
    else if (key === '--remote') args.remote = true;
    else if (key === '--staging') args.staging = true;
    else if (key === '--phase') {
      const [name, phase] = next().split('=');
      if (!name || !phase) throw new Error('--phase takes <tournament>=<phase>');
      args.phases[name] = phase;
    } else if (key === '--only') args.only.push(next());
    else throw new Error(`Unknown option ${key}`);
  }
  return args;
}

export const databaseUrlFrom = (args: DbArgs): string | undefined => args.database ?? process.env.DATABASE_URL;
