# Node.js 24.22.1: patched for the 2026-10-21 security release (Node 20 is EOL and unpatched).
FROM node:24.22.1-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
CMD ["node", "server.js"]
