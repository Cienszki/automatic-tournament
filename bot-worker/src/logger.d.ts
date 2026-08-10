// Ambient declaration for the existing, un-sourced dist/logger.js — see
// bot-worker/REBUILD_PLAN.md and src/inhouse/core/VENDORED.md for why this
// repo has compiled JS with no TypeScript source to import from directly.
// This file is never emitted (declaration-only); at runtime, a compiled
// sibling under dist/inhouse/ resolves '../logger' to the real dist/logger.js
// sitting next to it, since outDir mirrors rootDir's layout.
export declare const logger: {
  debug(msg: string, data?: unknown): void;
  info(msg: string, data?: unknown): void;
  warn(msg: string, data?: unknown): void;
  error(msg: string, error?: unknown): void;
};
