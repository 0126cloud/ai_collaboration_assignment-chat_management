# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# 複製 package.json 檔案（利用 Docker layer cache）
COPY package.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/

# 安裝所有依賴
RUN npm install && \
    cd client && npm install && \
    cd ../server && npm install

# 複製原始碼
COPY shared/ ./shared/
COPY client/ ./client/
COPY server/ ./server/

# Build client（Vite）與 server（tsc + tsc-alias）
RUN cd client && npm run build && \
    cd ../server && npm run build

# Stage 2: Runtime
FROM node:20-alpine

WORKDIR /app

# 複製 server package.json 並安裝 production 依賴
COPY server/package.json ./server/
RUN cd server && npm install --omit=dev

# 安裝 ts-node + typescript（Knex migration 為 .ts 檔，需要 ts-node 執行）
RUN cd server && npm install ts-node typescript tsconfig-paths

# 複製 build 產物
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server/dist ./server/dist

# 複製 migration、seed、knex 設定（執行 migrate 用）
COPY --from=builder /app/server/db/migrations ./server/db/migrations
COPY --from=builder /app/server/db/seeds ./server/db/seeds
COPY --from=builder /app/server/knexfile.ts ./server/knexfile.ts
COPY --from=builder /app/server/tsconfig.json ./server/tsconfig.json

# 複製 shared（tsc-alias 改寫後仍可能需要 runtime 參照）
COPY --from=builder /app/shared ./shared

# 建立資料目錄
RUN mkdir -p /app/data

# 環境變數預設值
ENV NODE_ENV=production
ENV SERVER_ADDRESS=0.0.0.0
ENV SERVER_PORT=3000
ENV DB_FILENAME=/app/data/chat-management.sqlite

EXPOSE 3000

# 先執行 migration 再啟動 server
CMD sh -c "cd server && npx knex migrate:latest && node dist/server/src/server.js"
