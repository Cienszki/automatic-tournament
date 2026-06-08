FROM node:20-slim

# git is required for npm to install GitHub-sourced dependencies (steam-resources)
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --production --no-audit --no-fund

# The install above nests steam-resources under 'steam' (pinned #v1.2.0, which LACKS
# CSODOTALobbyMember / CSODOTALobby.all_members) but places NONE at root — where node-dota2's
# require('steam-resources') resolves (it walks up from dota2/). Explicitly install the
# up-to-date steam-resources (HEAD = 1.2.2, which HAS the lobby member types) at root, so
# decoding a lobby keeps all_members and getCurrentLobbyPlayers() works.
RUN npm install --no-audit --no-fund --no-save github:seishun/node-steam-resources

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

# Fix 2: make the root steam-resources (installed above, 1.2.2 with CSODOTALobbyMember) load
#   with protobufjs@4 — a hoisted protobufjs@7 from steam-user would otherwise break it,
#   exactly like Fix 1 does for steam's copy.
RUN mkdir -p /app/node_modules/steam-resources/node_modules && \
    rm -rf /app/node_modules/steam-resources/node_modules/protobufjs && \
    cp -r /tmp/pbjs4/node_modules/protobufjs /app/node_modules/steam-resources/node_modules/protobufjs && \
    mkdir -p /app/node_modules/steam-resources/node_modules/protobufjs/node_modules && \
    cp -r /tmp/pbjs4/node_modules/bytebuffer /app/node_modules/steam-resources/node_modules/protobufjs/node_modules/bytebuffer && \
    (cp -r /tmp/pbjs4/node_modules/long /app/node_modules/steam-resources/node_modules/protobufjs/node_modules/long 2>/dev/null || true) && \
    rm -rf /tmp/pbjs4

# Build-time assertion: fail the build (Railway then keeps the previous working deploy) if the
# Dota schema is the old one missing lobby members, so we never silently ship the parsing bug.
RUN node -e "const D=require('/app/node_modules/steam-resources').GC.Dota.Internal; if(!D||!D.CSODOTALobbyMember){console.error('FATAL: root steam-resources Dota schema lacks CSODOTALobbyMember');process.exit(1);} console.log('OK: CSODOTALobbyMember present in root steam-resources');"

# Copy compiled code
COPY dist/ ./dist/

# DO NOT copy .env — credentials come from Railway environment variables.
# The only required env var is FIREBASE_SERVICE_ACCOUNT_BASE64.
# Steam credentials are read from Firestore (botAccounts collection).

CMD ["node", "dist/manager.js"]
