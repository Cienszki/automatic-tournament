// drizzle-kit: generates SQL migrations in /drizzle from the table definitions.
//   npm run db:generate            after changing a table in src/platform/db/schema
//   npm run db:generate -- --custom --name <name>   for SQL drizzle cannot express (roles, policies)
// Generating needs no database. Migrations are applied by src/platform/db/migrate.ts.

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/platform/db/schema/index.ts',
  out: './drizzle',
  schemaFilter: ['app', 'bot'],
  strict: true,
  verbose: true,
});
