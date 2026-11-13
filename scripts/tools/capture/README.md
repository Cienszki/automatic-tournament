# Capture tool

Reads a tournament from production Firestore through the public REST API, anonymously and read-only, into the export format, and builds the checked-in parity fixtures from it. The format, the commands and what each file holds are in `docs/overhaul/EXPORT_FORMAT.md`.

| File | Does |
|---|---|
| `capture.ts` | Walks one tournament (or Letnia's root collections, or the global ones) into `data-exports/<slug>/` |
| `reduce.ts` | Makes a fixture: personal data removed, user ids replaced by stable fake ids |
| `published/build.ts` | The old site's standings and stats hub numbers for a capture |
| `opendota.ts` | Records OpenDota match responses for fixture games |
| `lib/format.ts` | Reader, writer and line parser of the format |

Tests: `npx vitest run scripts/tools/capture`. Typecheck: `npm run typecheck` (this folder has its own `tsconfig.json`).
