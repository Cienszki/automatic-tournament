FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install --production --no-audit --no-fund

# steam bundles steam-resources which needs protobufjs@4.x (ProtoBuf.newBuilder API).
# npm@10 hoists protobufjs@7 for firebase-admin, so we manually install v4 nested
# inside steam so Node.js module resolution finds it before the root v7.
RUN cd /app/node_modules/steam && \
    npm install --no-package-lock --no-audit --no-fund --no-save "protobufjs@>=4.1.3 <5"

# Copy compiled code
COPY dist/ ./dist/

# DO NOT copy .env — credentials come from Railway environment variables.
# The only required env var is FIREBASE_SERVICE_ACCOUNT_BASE64.
# Steam credentials are read from Firestore (botAccounts collection).

CMD ["node", "dist/manager.js"]
