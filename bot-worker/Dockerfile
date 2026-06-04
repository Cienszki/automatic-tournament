FROM node:20-slim

# git is required for npm to install GitHub-sourced dependencies (steam-resources)
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --production --no-audit --no-fund

# steam-resources needs protobufjs@4.x (ProtoBuf.newBuilder API).
# npm hoists protobufjs@7 (for firebase-admin) to root, so steam-resources gets the wrong version.
# Fix: install protobufjs@4 in a clean temp dir (pure registry package, no GitHub deps,
# --ignore-scripts safe) then place it inside steam's node_modules so Node.js resolution
# finds v4 before the root v7. Also nest bytebuffer@4 inside protobufjs so it gets its
# required version rather than steam's bytebuffer@5.
RUN mkdir -p /tmp/pbjs4 && \
    cd /tmp/pbjs4 && \
    echo '{}' > package.json && \
    npm install --no-package-lock --no-audit --no-fund --ignore-scripts "protobufjs@>=4.1.3 <5" && \
    mkdir -p /app/node_modules/steam/node_modules/protobufjs/node_modules && \
    cp -r /tmp/pbjs4/node_modules/protobufjs/. /app/node_modules/steam/node_modules/protobufjs/ && \
    cp -r /tmp/pbjs4/node_modules/bytebuffer /app/node_modules/steam/node_modules/protobufjs/node_modules/bytebuffer && \
    (cp -r /tmp/pbjs4/node_modules/long /app/node_modules/steam/node_modules/protobufjs/node_modules/long 2>/dev/null || true) && \
    rm -rf /tmp/pbjs4

# Copy compiled code
COPY dist/ ./dist/

# DO NOT copy .env — credentials come from Railway environment variables.
# The only required env var is FIREBASE_SERVICE_ACCOUNT_BASE64.
# Steam credentials are read from Firestore (botAccounts collection).

CMD ["node", "dist/manager.js"]
