FROM node:20-slim

WORKDIR /app

# Install dependencies first (layer-cached unless package.json changes)
COPY package.json ./
RUN npm install --production --no-audit --no-fund

# Copy compiled code
COPY dist/ ./dist/

# DO NOT copy .env — credentials come from Railway environment variables.
# The only required env var is FIREBASE_SERVICE_ACCOUNT_BASE64.
# Steam credentials are read from Firestore (botAccounts collection).

CMD ["node", "dist/manager.js"]
