FROM node:20-slim

# git is required for npm to install GitHub-sourced dependencies (steam-resources)
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --production --no-audit --no-fund

# steam-resources needs protobufjs@4.x (ProtoBuf.newBuilder API).
# Install v4 in a clean temp dir (--ignore-scripts avoids the svn prepare script),
# then nest it inside steam/node_modules/steam-resources/ so require('protobufjs')
# from steam-resources finds v4 before the root v7 (used by firebase-admin).
RUN mkdir -p /tmp/pbjs4 && \
    cd /tmp/pbjs4 && \
    echo '{}' > package.json && \
    npm install --no-package-lock --no-audit --no-fund --ignore-scripts "protobufjs@>=4.1.3 <5" && \
    mkdir -p /app/node_modules/steam/node_modules/steam-resources/node_modules && \
    cp -r /tmp/pbjs4/node_modules/protobufjs /app/node_modules/steam/node_modules/steam-resources/node_modules/protobufjs && \
    cp -r /tmp/pbjs4/node_modules/bytebuffer /app/node_modules/steam/node_modules/steam-resources/node_modules/bytebuffer && \
    (cp -r /tmp/pbjs4/node_modules/long /app/node_modules/steam/node_modules/steam-resources/node_modules/long 2>/dev/null || true) && \
    rm -rf /tmp/pbjs4

# dota2 requires 'steam-resources' directly but npm only installs it bundled inside 'steam'.
# Copy the now-fixed steam-resources (with protobufjs@4 nested) to root node_modules
# so dota2 can resolve it and gets the correct protobufjs version.
RUN cp -r /app/node_modules/steam/node_modules/steam-resources /app/node_modules/steam-resources

# Copy compiled code
COPY dist/ ./dist/

# DO NOT copy .env — credentials come from Railway environment variables.
# The only required env var is FIREBASE_SERVICE_ACCOUNT_BASE64.
# Steam credentials are read from Firestore (botAccounts collection).

CMD ["node", "dist/manager.js"]
