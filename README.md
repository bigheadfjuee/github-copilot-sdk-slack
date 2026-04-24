# GitHub Copilot SDK Slack 專案

一個支援 **Socket Mode** 和 **HTTP Proxy** 連接的 TypeScript Slack Bot 專案，參考 Hermes Agent 與 Slack 的通訊方式架構設計。

程式透過 GitHub Copilot SDK 實現與 Slack 的互動，提供遠端操作 AI Agent 的能力。

## 🏗️ 架構設計

### 核心架構圖

```chart
┌─────────────────────────────────────────────┐
│         Application Entry Point             │
│              (src/index.ts)                 │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│      Configuration Management               │
│    (loadConfig from .env)                   │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│ Runtime Wiring in index.ts                  │
│ - createConnection(config)                  │
│ - copilotManager.start(GITHUB_TOKEN)        │
│ - createSessionManager(copilotClient)       │
└────────────┬────────────────────────┬───────┘
             │                        │
             ▼                        ▼
┌──────────────────────┐   ┌─────────────────────────────┐
│ Slack Connection     │   │ GitHub Copilot SDK          │
│ Factory              │   │ Connection                  │
│ (socket/http/proxy)  │   │ (CopilotClientManager)      │
└──────────┬───────────┘   └──────────────┬──────────────┘
           │                              │
           ▼                              ▼
┌──────────────────────┐        ┌─────────────────────────┐
│ SocketModeClient /   │        │ CopilotClient           │
│ WebClient / HTTP App │        │ (@github/copilot-sdk)   │
└──────────┬───────────┘        └───────────────┬─────────┘
           │                                    │
           └───────────────┬────────────────────┘
                           ▼
      ┌──────────────────────────────┐
      │ Event Handlers (src/handlers)│
      │ - Slack message reception    │
      │ - call SessionManager        │
      └──────────────┬───────────────┘
                     ▼
      ┌──────────────────────────────┐
      │ SessionManager               │
      │ - getOrCreate(user session)  │
      │ - session.sendAndWait()      │
      └──────────────┬───────────────┘
                     ▼
      ┌──────────────────────────────┐
      │ Copilot Response -> Slack    │
      │ thread reply + reactions     │
      └──────────────────────────────┘
```

### 模組結構

```chart
src/
├── index.ts                 # 應用入口點
├── config.ts               # 環境配置與驗證
├── logger.ts               # 結構化日誌系統
├── proxy.ts                # HTTP Proxy 代理管理
├── handlers.ts             # 事件處理器註冊
└── connections/
    ├── types.ts            # 連接介面定義
    ├── factory.ts          # 連接工廠模式
    ├── socket-mode.ts      # WebSocket 連接實現
    └── http.ts             # HTTP 連接 + 代理實現
```

## ✨ 核心特性

### 1. **雙模式連接支援**

#### Socket Mode (推薦用於開發)

- 使用 WebSocket 進行實時通訊
- 無需公開 HTTP 端點
- 更低的延遲

```typescript
CONNECTION_MODE=socket
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
```

#### HTTP Mode (用於生產)

- 傳統 HTTP Webhook 方式
- 支援 Load Balancer
- 支援 HTTP Proxy 代理

```typescript
CONNECTION_MODE=http
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
HTTP_PORT=3000
HTTP_PROXY_URL=http://proxy:8080
HTTP_PROXY_USERNAME=user
HTTP_PROXY_PASSWORD=pass
```

### 2. **HTTP Proxy 支援**

完整的代理配置支援，適合企業環境：

```typescript
// ProxyConfig 介面
interface ProxyConfig {
  url: string;           // 代理 URL (http://host:port)
  username?: string;     // 代理認證用戶名
  password?: string;     // 代理認證密碼
}

// 自動創建 HTTP/HTTPS 代理 agents
const proxyAgents = createProxyAgents(proxyConfig);
```

### 3. **模組化連接介面**

統一的連接介面，易於擴展：

```typescript
interface SlackConnection {
  start(): Promise<void>;
  stop(): Promise<void>;
  getApp(): App;
  isActive(): boolean;
}
```

### 4. **結構化日誌系統**

使用 Pino 日誌框架，開發環境支援彩色輸出：

```typescript
const logger = createLogger('ModuleName');
logger.info({ context }, 'Message');
logger.error({ error }, 'Error message');
```

### 5. **優雅關閉**

支援 SIGTERM/SIGINT 信號，確保清潔的連接關閉：

```typescript
process.on('SIGTERM', shutdownHandler);
process.on('SIGINT', shutdownHandler);
```

## 🚀 快速開始

### 前置要求

- Node.js >= 18.0.0
- pnpm
- Slack App Token (Socket Mode) 或 Signing Secret (HTTP Mode)

### 安裝

```bash
# 克隆或進入專案目錄
cd github-copilot-sdk-slack

# 安裝依賴
pnpm install

# 複製環境配置
cp .env.example .env

# 編輯 .env 填入 Slack 認證信息
# 選擇連接模式 (socket 或 http)
```

### Socket Mode 開發模式

```bash
# .env 配置
CONNECTION_MODE=socket
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token

# 啟動開發服務
pnpm run dev

# 輸出應該顯示：
# Bot is ready and listening for events (Socket Mode)
```

### HTTP 模式 (帶代理支援)

```bash
# .env 配置
CONNECTION_MODE=http
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
HTTP_PORT=3000
HTTP_PROXY_URL=http://proxy.company.com:8080
HTTP_PROXY_USERNAME=username
HTTP_PROXY_PASSWORD=password

# 啟動 HTTP 服務
pnpm run dev

# 使用 ngrok 或其他工具公開 HTTP 端點
ngrok http 3000

# 在 Slack App 配置中設置 Request URL:
# https://your-ngrok-url/slack/events
```

### 測試健康檢查

```bash
# HTTP 模式下檢查健康狀態
curl http://localhost:3000/health

# 返回：
# {
#   "status": "ok",
#   "mode": "http",
#   "uptime": 123.456
# }
```

## 📋 環境配置詳解

### .env 變數說明

```env
# === Slack 認證 ===
SLACK_BOT_TOKEN
  用途：Slack Bot 身份驗證
  格式：xoxb-xxxxxxxxxx...
  來源：Slack App -> OAuth & Permissions -> Bot User OAuth Token

SLACK_APP_TOKEN
  用途：Socket Mode 認證(只在 Socket Mode 需要)
  格式：xapp-xxxxxxxxxx...
  來源：Slack App -> Basic Information -> App-Level Tokens

SLACK_SIGNING_SECRET
  用途：驗證 HTTP Webhook 真實性(只在 HTTP Mode 需要)
  格式：xxxxxxxxxxxxxxxx
  來源：Slack App -> Basic Information -> Signing Secret

# === 連接模式 ===
CONNECTION_MODE=socket  # 或 http

# === HTTP 服務配置 ===
HTTP_PORT=3000
HTTP_PATH=/slack/events

# === HTTP Proxy 配置(可選，企業環境推薦)===
HTTP_PROXY_URL=http://proxy.company.com:8080
HTTP_PROXY_USERNAME=proxy_user
HTTP_PROXY_PASSWORD=proxy_pass

# === 日誌配置 ===
LOG_LEVEL=debug         # debug, info, warn, error

# === 應用環境 ===
NODE_ENV=development    # 或 production

# === GitHub Copilot ===
GITHUB_TOKEN=ghp_xxx
COPILOT_SESSION_IDLE_MS=1800000   # 預設 30 分鐘
COPILOT_TIMEOUT_MS=180000         # 預設 180 秒
```

## 🤖 斜線命令

### `/model` — 指定 AI 模型

在開始對話前，可透過 `/model` 斜線命令指定要使用的 AI 模型。設定後，下一次新建 Copilot session 時即套用選定的模型。

| 指令 | 對應模型 |
|------|---------|
| `/model sonnet` | `claude-sonnet-4.6` |
| `/model haiku` | `claude-haiku-4.5` |
| `/model opus` | `claude-opus-4.6` |
| `/model gpt-5` | `gpt-5.4` |

**範例：**

```
/model sonnet
→ 已設定模型為 `claude-sonnet-4.6`（別名：`sonnet`）。下次對話將使用此模型。
```

**注意事項：**
- 設定僅保存在記憶體中，應用程式重啟後恢復預設
- 若已有進行中的 session，需等 session 逾時或重置後新設定才會生效
- 輸入不認識的別名會收到錯誤訊息，並列出所有支援的別名

## 🔧 API 參考

### ConnectionFactory

```typescript
// 創建連接
const connection = createConnection(config, {
  onStart: async () => { /* 連接成功 */ },
  onStop: async () => { /* 連接關閉 */ },
  onError: async (error) => { /* 連接錯誤 */ },
});

// 啟動連接
await connection.start();

// 取得 Bolt App 實例
const app = connection.getApp();

// 檢查連接狀態
if (connection.isActive()) { /* ... */ }

// 停止連接
await connection.stop();
```

### Handler 註冊

```typescript
// 註冊所有事件處理器
registerHandlers(app);

// 自定義消息處理
app.message(async ({ message, say }) => {
  // 處理消息
});

// 自定義命令處理
app.command('/custom', async ({ command, ack, respond }) => {
  await ack();
  await respond('Command executed');
});

// 自定義事件處理
app.event('app_mention', async ({ event, say }) => {
  await say('Mentioned!');
});
```

### Logger 使用

```typescript
import { createLogger } from './logger';

const logger = createLogger('MyModule');

logger.info({ userId: '123' }, 'User action');
logger.warn({ code: 'WARN_001' }, 'Warning message');
logger.error({ error, stack: error.stack }, 'Error occurred');
logger.debug({ rawData: data }, 'Debug information');
```

## 📦 構建與部署

### 本地構建

```bash
# TypeScript 編譯
pnpm run build

# 輸出目錄：dist/
# 可直接在生產環境運行
```

### Docker 部署

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN pnpm install --frozen-lockfile --only=production

COPY dist ./dist
COPY .env ./.env

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  slack-bot:
    build: .
    ports:
      - "3000:3000"
    environment:
      - CONNECTION_MODE=http
      - SLACK_BOT_TOKEN=${SLACK_BOT_TOKEN}
      - SLACK_SIGNING_SECRET=${SLACK_SIGNING_SECRET}
      - HTTP_PROXY_URL=${HTTP_PROXY_URL}
    restart: unless-stopped
```

## 🔍 參考 Hermes Agent 架構

本專案參考了 Hermes Agent 的以下設計模式：

### 1. **模組化架構**

- 各組件獨立，職責清晰
- 易於測試和擴展
- 參考 `hermes-agent/agent/` 模組設計

### 2. **結構化日誌**

- 使用 Pino 記錄結構化日誌
- 開發環境彩色輸出
- 參考 Hermes Agent 的日誌系統

### 3. **環境配置**

- 集中式配置管理
- 驗證必需的環境變數
- 參考 `hermes_state.py` 配置模式

### 4. **優雅關閉**

- SIGTERM/SIGINT 信號處理
- 資源清理
- 參考 Hermes Agent 的進程管理

### 5. **工廠模式**

- `ConnectionFactory` 根據配置創建適當的連接
- 參考 Hermes Agent 的平台適配器模式

### 6. **多平台支援**

- Socket Mode 和 HTTP Mode
- HTTP Proxy 支援
- 參考 Hermes Agent 的 gateway/platforms/ 架構

## 🧪 測試

```bash
# 運行測試套件
pnpm test

# 帶覆蓋率報告
pnpm test -- --coverage

# ESLint 檢查
pnpm run lint
```

## 🛡️ 最佳實踐

### 1. **安全配置**

- 永遠使用 `.env` 文件存儲敏感信息
- 不要將 `.env` 提交到版本控制
- 使用環境變數管理 API Key

### 2. **錯誤處理**

- 所有異步操作使用 try-catch
- 使用結構化日誌記錄錯誤
- 實現重試機制

### 3. **性能優化**

- 使用 Socket Mode 減少 HTTP 開銷
- 實現消息批處理
- 緩存經常訪問的數據

### 4. **監控告警**

- 監控連接狀態
- 記錄關鍵事件
- 設置錯誤告警

## 📚 擴展指南

### 添加新的事件處理器

```typescript
// 在 src/handlers.ts 中添加

export const registerCustomHandlers = (app: App): void => {
  app.event('custom_event', async ({ event, client }) => {
    // 處理事件
  });
};

// 在 src/index.ts 中註冊
registerCustomHandlers(app);
```

### 添加新的連接模式

```typescript
// 創建 src/connections/custom-mode.ts
export class CustomModeConnection implements SlackConnection {
  // 實現接口方法
}

// 在 factory.ts 中添加
if (config.mode === 'custom') {
  return new CustomModeConnection(config, events);
}
```

## 🐛 故障排除

### Socket Mode 連接失敗

```
錯誤：Failed to start Socket Mode connection
解決方案：
1. 驗證 SLACK_APP_TOKEN 是否正確
2. 檢查 Slack App 是否啟用了 Socket Mode
3. 檢查網絡連接
```

### HTTP 代理連接失敗

```
錯誤：Failed to create proxy agents
解決方案：
1. 驗證代理 URL 格式正確
2. 檢查代理認證信息
3. 確保代理服務器可訪問
```

### 事件未觸發

```
解決方案：
1. 檢查 Slack App 事件訂閱配置
2. 驗證 Request URL 正確
3. 檢查日誌中的詳細錯誤信息
```

## 📖 相關資源

- [Slack Bolt TypeScript 文檔](https://slack.dev/bolt-js/)
- [Slack Socket Mode 指南](https://api.slack.com/socket-mode)
- [HTTP Proxy Agent](https://github.com/TooTallNate/node-http-proxy-agent)
- [Pino 日誌框架](https://getpino.io/)
- [Hermes Agent 源碼](https://github.com/NousResearch/hermes-agent)

## 📄 許可證

MIT License

---

**最後更新**： 2026 年 4 月 24 日

