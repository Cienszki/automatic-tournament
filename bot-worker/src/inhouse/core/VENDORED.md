# Vendored — `@dota2inhouse/core`

These files are a **verbatim copy** of `packages/core/src/*` from the lobby bot
repo (`dota2-lobby-bot`), not a reimplementation. Vendored rather than
installed as a package for the same reason `dota2-community-site` vendors it
(see that repo's copy of this file): no package registry step in this
repo's build, and one less thing to break the Docker image over.

- **Source repo:** `dota2-lobby-bot`
- **Source path:** `packages/core/src/`
- **Copied from commit:** `a22f2434e78862d615953bc8aab241caa36d9ddf`
- **Package version:** `1.0.0`

The only change applied on copy: relative import specifiers had their `.js`
extension stripped (`from './types.js'` → `from './types'`) so they resolve
under this project's `moduleResolution: "node"` + CommonJS output. Nothing
else was edited.

Only three functions are actually exercised by the Inhouse Runner in M1:
`InhouseStore.createReservation`, `InhouseStore.computeSlots`, and the
`leaseAccount`/`renewLease`/`releaseAccount` trio from `lease.ts`.
`attendance.ts`, `awards.ts` and `steam-api.ts` are vendored for mechanical
re-sync parity with the website's copy but are **never called** — result
ingestion is entirely the website's job (see `docs/lobby-bot-integration.md`
§4 in the website repo); calling them here would double-count `gamesPlayed`.

## Why this must stay identical

Three functions are safety-critical and must not drift from the bot's copy —
drift produces bugs that only appear under load:

| Function | What breaks if it drifts |
|---|---|
| `InhouseStore.createReservation` | Overbooking — three people press Join at 9/10 and all three get a slot. |
| `InhouseStore.createModerationRecord` | A ban that silently doesn't enforce, because the index entries weren't written. |
| `InhouseStore.computeSlots` | A web joiner counted twice, so the lobby looks full at nine. |

## Re-syncing

When the bot's `packages/core` changes, re-copy and re-strip:

```bash
cp "<dota2-lobby-bot repo>/packages/core/src/"*.ts src/inhouse/core/
node -e "const fs=require('fs');const d='src/inhouse/core';for(const f of fs.readdirSync(d)){if(!f.endsWith('.ts'))continue;const p=d+'/'+f;fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace(/(from\s+'\.\.?\/[^']+?)\.js'/g,\"$1'\"));}"
```

Do **not** hand-edit these files. Fix bugs in the bot's `packages/core` and
re-sync, so every consumer (this repo, the website, `dota2-lobby-bot` itself)
stays in step.
