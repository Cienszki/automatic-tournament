// Every table of the database. drizzle-kit reads this file to generate the migrations in /drizzle
// (drizzle.config.ts); docs/overhaul/SCHEMA.md describes each table in plain words.

export * from './platform';
export * from './organizations';
export * from './tournaments';
export * from './teams';
export * from './matches';
export * from './content';
export * from './cards';
export * from './bot';

export { app, bot } from './_columns';
