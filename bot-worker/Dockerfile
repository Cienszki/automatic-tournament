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

# dota2 requires 'steam-resources' at root but npm bundles it inside steam/node_modules/.
# Copy it to root and make it fully self-contained by nesting all its deps inside it:
#   - csv-parse (bundled with steam, not accessible from root)
#   - bytebuffer@5 (steam-resources dep, bundled with steam)
#   - long (bundled with steam)
#   - protobufjs@4 (must shadow root's v7 which removed .newBuilder())
#     - protobufjs@4 itself needs bytebuffer@4, nested inside it so v5 above doesn't collide
RUN cp -r /app/node_modules/steam/node_modules/steam-resources /app/node_modules/steam-resources && \
    mkdir -p /app/node_modules/steam-resources/node_modules && \
    cp -r /app/node_modules/steam/node_modules/csv-parse  /app/node_modules/steam-resources/node_modules/csv-parse && \
    cp -r /app/node_modules/steam/node_modules/bytebuffer /app/node_modules/steam-resources/node_modules/bytebuffer && \
    cp -r /app/node_modules/steam/node_modules/long       /app/node_modules/steam-resources/node_modules/long && \
    cp -r /tmp/pbjs4/node_modules/protobufjs              /app/node_modules/steam-resources/node_modules/protobufjs && \
    mkdir -p /app/node_modules/steam-resources/node_modules/protobufjs/node_modules && \
    cp -r /tmp/pbjs4/node_modules/bytebuffer /app/node_modules/steam-resources/node_modules/protobufjs/node_modules/bytebuffer && \
    (cp -r /tmp/pbjs4/node_modules/long /app/node_modules/steam-resources/node_modules/protobufjs/node_modules/long 2>/dev/null || true) && \
    rm -rf /tmp/pbjs4

# Copy compiled code
COPY dist/ ./dist/

# DO NOT copy .env — credentials come from Railway environment variables.
# The only required env var is FIREBASE_SERVICE_ACCOUNT_BASE64.
# Steam credentials are read from Firestore (botAccounts collection).

CMD ["node", "dist/manager.js"]
