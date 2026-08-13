FROM node:20-slim

# git is required for npm to install GitHub-sourced dependencies (steam-resources)
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --production --no-audit --no-fund

# steam-resources needs protobufjs@4.x. Install it in a temp dir with --ignore-scripts
# (avoids the svn prepare script that fetches protobuf definitions).
RUN mkdir -p /tmp/pbjs4 && \
    cd /tmp/pbjs4 && \
    echo '{}' > package.json && \
    npm install --no-package-lock --no-audit --no-fund --ignore-scripts "protobufjs@>=4.1.3 <5"

# Both 'steam' (via steam/node_modules/steam-resources) and 'dota2' (via root steam-resources)
# require steam-resources, which needs protobufjs@4. We must fix both locations.
#
# Fix 1: steam/node_modules/steam-resources — nest protobufjs@4 inside it so
#   steam-resources' require('protobufjs') finds v4 before walking up to root v7.
RUN mkdir -p /app/node_modules/steam/node_modules/steam-resources/node_modules && \
    cp -r /tmp/pbjs4/node_modules/protobufjs /app/node_modules/steam/node_modules/steam-resources/node_modules/protobufjs && \
    mkdir -p /app/node_modules/steam/node_modules/steam-resources/node_modules/protobufjs/node_modules && \
    cp -r /tmp/pbjs4/node_modules/bytebuffer /app/node_modules/steam/node_modules/steam-resources/node_modules/protobufjs/node_modules/bytebuffer && \
    (cp -r /tmp/pbjs4/node_modules/long /app/node_modules/steam/node_modules/steam-resources/node_modules/protobufjs/node_modules/long 2>/dev/null || true)

# Fix 2: npm does not place steam-resources at root, but node-dota2 does require('steam-resources')
#   and resolves there. Copy steam's (now protobufjs@4-patched) steam-resources to root so dota2
#   can load it. Also nest csv-parse + bytebuffer + long (bundled with steam, not at root).
RUN cp -r /app/node_modules/steam/node_modules/steam-resources /app/node_modules/steam-resources && \
    mkdir -p /app/node_modules/steam-resources/node_modules && \
    cp -r /app/node_modules/steam/node_modules/csv-parse  /app/node_modules/steam-resources/node_modules/csv-parse && \
    cp -r /app/node_modules/steam/node_modules/bytebuffer /app/node_modules/steam-resources/node_modules/bytebuffer && \
    cp -r /app/node_modules/steam/node_modules/long       /app/node_modules/steam-resources/node_modules/long && \
    rm -rf /tmp/pbjs4

# Fix 3 (member parsing): steam's 1.2.0 CSODOTALobby has no member list, so lobby.all_members
#   decoded empty and getCurrentLobbyPlayers() always returned []. We CANNOT swap in newer
#   protobufs wholesale — they drop DOTAGameVersion, which node-dota2's createPracticeLobby
#   needs (it would throw "Cannot read ... GAME_VERSION_STABLE"). Instead inject a minimal,
#   import-free CSODOTALobbyMember + `all_members = 120` (an unused field) into 1.2.0's own lobby
#   proto. getCurrentLobbyPlayers only reads id/team/slot. Validated locally; the assertion below
#   guards it. Idempotent.
RUN node -e "const fs=require('fs');const p='/app/node_modules/steam-resources/protobufs/dota2/dota_gcmessages_common_match_management.proto';let s=fs.readFileSync(p,'utf8');if(!s.includes('message CSODOTALobbyMember')){s=s.replace('message CSODOTALobby {','message CSODOTALobbyMember { optional fixed64 id = 1; optional uint32 team = 3; optional uint32 slot = 7; } message CSODOTALobby { repeated .CSODOTALobbyMember all_members = 120;');fs.writeFileSync(p,s);console.log('Patched CSODOTALobby with all_members');}else{console.log('CSODOTALobbyMember already present');}"

# Fix 4 (Immortal Draft): CMsgPracticeLobbySetDetails in 1.2.0 stops at field 49, so `do_player_draft`
#   (field 53) is dropped on the way to the GC no matter what the website configures. Valve's internal
#   name for Immortal Draft is "player draft" — searching these protos for "immortal" finds nothing.
#   Adding one optional field is wire-compatible: protobuf skips unknown fields rather than rejecting the
#   message. Inlined on one line, same as Fix 3, so there are no shell escapes to get wrong. Idempotent.
RUN node -e "const fs=require('fs');const p='/app/node_modules/steam-resources/protobufs/dota2/dota_gcmessages_client_match_management.proto';let s=fs.readFileSync(p,'utf8');if(!s.includes('do_player_draft')){s=s.replace('message CMsgPracticeLobbySetDetails {','message CMsgPracticeLobbySetDetails { optional bool do_player_draft = 53;');fs.writeFileSync(p,s);console.log('Patched CMsgPracticeLobbySetDetails with do_player_draft');}else{console.log('do_player_draft already present');}"

# Build-time assertion: load the schema the way node-dota2 does and fail the build (Railway then
# keeps the previous working deploy) if the lobby member type or the game-version enum is missing.
# do_player_draft is asserted by construction — protobufjs throws on a field the schema doesn't have,
# which is also why proto-patch.ts refuses to whitelist the option unless this passed.
RUN node -e "const D=require('/app/node_modules/steam-resources').GC.Dota.Internal; if(!D||!D.CSODOTALobbyMember){console.error('FATAL: CSODOTALobbyMember missing');process.exit(1);} if(!D.DOTAGameVersion||D.DOTAGameVersion.GAME_VERSION_STABLE===undefined){console.error('FATAL: DOTAGameVersion.GAME_VERSION_STABLE missing (createLobby would break)');process.exit(1);} try{new D.CMsgPracticeLobbySetDetails({do_player_draft:true});}catch(e){console.error('FATAL: do_player_draft missing from CMsgPracticeLobbySetDetails (Immortal Draft would be silently dropped)');process.exit(1);} console.log('OK: CSODOTALobbyMember + DOTAGameVersion + do_player_draft all present');"

# Copy compiled code
COPY dist/ ./dist/

# DO NOT copy .env — credentials come from Railway environment variables.
# The only required env var is FIREBASE_SERVICE_ACCOUNT_BASE64.
# Steam credentials are read from Firestore (botAccounts collection).

CMD ["node", "dist/conductor.js"]
