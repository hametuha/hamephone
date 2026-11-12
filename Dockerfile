# Node 24 系の最新パッチを使う（版は固定しない）。
# Cloud Build は毎回ベースイメージを取得し直すので、deploy.yml の定期デプロイで
# セキュリティリリースが自動的に本番へ入る。
FROM node:24-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
CMD ["node", "server.js"]
