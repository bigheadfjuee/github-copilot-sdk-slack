FROM node:18-alpine AS builder

WORKDIR /app

RUN corepack enable

# 複製 package 文件
COPY package.json pnpm-lock.yaml ./

# 安裝依賴（包括開發依賴用於構建）
RUN pnpm install --frozen-lockfile

# 複製源代碼
COPY src ./src
COPY tsconfig.json .

# 構建 TypeScript
RUN pnpm run build

# 生產鏡像
FROM node:18-alpine

WORKDIR /app

RUN corepack enable

# 複製 package 文件
COPY package.json pnpm-lock.yaml ./

# 僅安裝生產依賴
RUN pnpm install --frozen-lockfile --only=production && \
  pnpm store prune

# 從構建階段複製編譯後的代碼
COPY --from=builder /app/dist ./dist

# 健康檢查（HTTP Mode）
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => {if (res.statusCode !== 200) throw new Error(res.statusCode);})"

# 暴露端口（用於 HTTP Mode）
EXPOSE 3000

# 啟動應用
CMD ["node", "dist/index.js"]

