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

# Fix 2: copy the now-fixed steam/node_modules/steam-resources to root so dota2 can find it.
#   Also nest csv-parse + bytebuffer@5 + long inside it (bundled with steam, not at root).
RUN cp -r /app/node_modules/steam/node_modules/steam-resources /app/node_modules/steam-resources && \
    mkdir -p /app/node_modules/steam-resources/node_modules && \
    cp -r /app/node_modules/steam/node_modules/csv-parse  /app/node_modules/steam-resources/node_modules/csv-parse && \
    cp -r /app/node_modules/steam/node_modules/bytebuffer /app/node_modules/steam-resources/node_modules/bytebuffer && \
    cp -r /app/node_modules/steam/node_modules/long       /app/node_modules/steam-resources/node_modules/long && \
    rm -rf /tmp/pbjs4

# Copy compiled code
COPY dist/ ./dist/

# DO NOT copy .env — credentials come from Railway environment variables.
# The only required env var is FIREBASE_SERVICE_ACCOUNT_BASE64.
# Steam credentials are read from Firestore (botAccounts collection).

CMD ["node", "dist/manager.js"]
