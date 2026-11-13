import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The bot's tests. vitest is not a dependency of bot-worker: it comes from the
// repository root's node_modules (CI runs `npm ci` in both places). No test talks to
// Steam, Firestore or the network: the Dota client and the database are fakes
// (src/testing/).
export default defineConfig({
  test: {
    root: fileURLToPath(new URL('.', import.meta.url)),
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 20_000,
    // Timers are faked per test where needed; a real Steam login never happens.
    restoreMocks: true,
  },
});
