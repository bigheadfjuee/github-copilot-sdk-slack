# 文件概覽和項目結構

## 項目文件清單

### 核心源代碼 (src/)

```
src/
├── index.ts                 # 應用入口點
│   ├─ 加載配置
│   ├─ 創建連接
│   ├─ 註冊事件處理器
│   └─ 設置優雅關閉
│
├── config.ts               # 環境配置管理
│   ├─ BotConfig interface
│   ├─ loadConfig() 函數
│   └─ 環境變數驗證
│
├── logger.ts               # 結構化日誌系統
│   ├─ Pino 配置
│   ├─ createLogger() 工廠
│   └─ 開發/生產環境差異
│
├── proxy.ts                # HTTP Proxy 支持
│   ├─ ProxyConfig interface
│   ├─ createProxyAgents() 函數
│   └─ 認證信息處理
│
├── handlers.ts             # 事件處理器註冊
│   ├─ registerMessageHandlers()
│   ├─ registerCommandHandlers()
│   ├─ registerEventHandlers()
│   └─ registerHandlers() 主入口
│
└── connections/            # 連接適配器
    ├── types.ts            # 介面定義
    │   ├─ SlackConnection interface
    │   └─ ConnectionEvents interface
    │
    ├── factory.ts          # 工廠模式實現
    │   └─ createConnection() 工廠函數
    │
    ├── socket-mode.ts      # Socket Mode 實現
    │   ├─ SocketModeConnection class
    │   └─ WebSocket 管理
    │
    └── http.ts             # HTTP Mode 實現
        ├─ HttpConnection class
        ├─ Express 集成
        └─ 代理支持
```

### 測試文件 (src/__tests__/)

```
src/__tests__/
└── config.test.ts          # 配置測試
    ├─ Socket Mode 配置測試
    ├─ HTTP Mode 配置測試
    ├─ 驗證測試
    └─ Proxy 配置測試
```

### 配置文件

```
.env.example               # 環境變數示例
.env                       # 實際配置（不追蹤）
.gitignore                 # Git 忽略列表
.eslintrc.json            # ESLint 規則
jest.config.js            # Jest 測試配置
tsconfig.json             # TypeScript 編譯器配置
package.json              # NPM 依賴和腳本
```

### 文檔文件

```
README.md                  # 項目概覽
QUICK_START.md            # 5分鐘快速開始
IMPLEMENTATION.md         # 架構設計詳解
FILES_OVERVIEW.md         # 此文件
docker-compose.yml        # Docker Compose 配置
Dockerfile               # Docker 鏡像構建
```

## 核心模組詳解

### 1. 配置管理 (config.ts)

**職責：**
- 從環境變數加載配置
- 驗證必需的環境變數
- 提供類型安全的配置對象

**主要 API：**

```typescript
interface BotConfig {
  botToken: string;              // Slack Bot Token
  appToken?: string;             // Socket Mode App Token
  signingSecret?: string;        // HTTP Mode 簽名密鑰
  mode: 'socket' | 'http';       // 連接模式
  httpPort: number;              // HTTP 服務端口
  httpPath: string;              // HTTP 事件端點路徑
  proxy?: ProxyConfig;           // HTTP Proxy 配置
  logLevel: string;              // 日誌級別
  nodeEnv: string;               // Node 環境
}

function loadConfig(): BotConfig
```

**使用示例：**

```typescript
const config = loadConfig();
if (config.mode === 'socket') {
  // Socket Mode 邏輯
} else {
  // HTTP Mode 邏輯
}
```

### 2. 日誌系統 (logger.ts)

**職責：**
- 提供結構化日誌
- 開發環境彩色輸出
- 生產環境 JSON 格式

**主要 API：**

```typescript
const logger = createLogger('ModuleName');

logger.info({ context }, 'Message');
logger.warn({ context }, 'Warning');
logger.error({ error }, 'Error');
logger.debug({ data }, 'Debug info');
```

**日誌格式：**

開發環境：
```
[15:32:45.123] INFO (module=App) Bot is ready and listening
```

生產環境：
```json
{"level":30,"time":"2026-04-22T15:32:45.123Z","module":"App","msg":"Bot is ready"}
```

### 3. HTTP Proxy 支持 (proxy.ts)

**職責：**
- 創建 HTTP/HTTPS Proxy Agents
- 處理代理認證信息
- 與 HTTP 連接集成

**主要 API：**

```typescript
interface ProxyConfig {
  url?: string;           // http://proxy:port
  username?: string;      // 認證用戶名
  password?: string;      // 認證密碼
}

function createProxyAgents(proxyConfig?: ProxyConfig): {
  httpAgent?: HttpProxyAgent;
  httpsAgent?: HttpsProxyAgent;
}
```

**使用示例：**

```typescript
const proxyAgents = createProxyAgents({
  url: 'http://proxy.example.com:8080',
  username: 'user',
  password: 'pass',
});

// 傳遞給 Slack Bolt App
const app = new App({
  clientOptions: {
    agent: proxyAgents.httpAgent,
  },
});
```

### 4. 連接介面 (connections/types.ts)

**職責：**
- 定義統一的連接介面
- 支持多種連接實現

**主要 API：**

```typescript
interface SlackConnection {
  start(): Promise<void>;          // 啟動連接
  stop(): Promise<void>;           // 停止連接
  getApp(): App;                   // 取得 Bolt App
  isActive(): boolean;             // 檢查連接狀態
}

interface ConnectionEvents {
  onStart?: () => void | Promise<void>;
  onStop?: () => void | Promise<void>;
  onError?: (error: Error) => void | Promise<void>;
}
```

### 5. 連接工廠 (connections/factory.ts)

**職責：**
- 根據配置創建適當的連接實現
- 實現工廠模式

**主要 API：**

```typescript
function createConnection(
  config: BotConfig,
  events?: ConnectionEvents
): SlackConnection
```

**決策邏輯：**

```
config.mode === 'socket' → SocketModeConnection
config.mode === 'http'   → HttpConnection
otherwise               → throw Error
```

### 6. Socket Mode 連接 (connections/socket-mode.ts)

**職責：**
- 實現 WebSocket 連接
- 管理 Socket 生命週期

**主要特性：**
- ✅ 自動 WebSocket 連接
- ✅ 實時事件推送
- ✅ 內置重試機制
- ❌ 不支持 HTTP Proxy

**生命週期：**

```
new SocketModeConnection()
  ↓ start()
  ↓ WebSocket 連接建立
  ↓ 等待事件
  ↓ stop()
  ↓ WebSocket 關閉
```

### 7. HTTP Mode 連接 (connections/http.ts)

**職責：**
- 實現 HTTP 服務器
- 支持代理配置
- 健康檢查端點

**主要特性：**
- ✅ Express 集成
- ✅ HTTP Proxy 支持
- ✅ 健康檢查（GET /health）
- ✅ 水平可擴展

**生命週期：**

```
new HttpConnection()
  ↓ start()
  ↓ Express 服務器啟動
  ↓ 監聽 HTTP 請求
  ↓ Slack 發送 POST 到 /slack/events
  ↓ ExpressReceiver 驗證簽名
  ↓ 事件處理
  ↓ stop()
  ↓ Express 服務器關閉
```

### 8. 事件處理器 (handlers.ts)

**職責：**
- 註冊消息、命令、事件處理器
- 實現業務邏輯

**主要函數：**

```typescript
// 註冊消息處理
registerMessageHandlers(app: App)
  // 處理 app.message() 事件

// 註冊命令處理
registerCommandHandlers(app: App)
  // 處理 /command 命令

// 註冊事件處理
registerEventHandlers(app: App)
  // 處理 app_mention 等事件

// 註冊所有處理器
registerHandlers(app: App)
  // 調用上述三個函數
```

**事件類型支持：**

| 事件類型 | 方法 | 說明 |
|--------|------|------|
| 消息 | `app.message()` | 頻道/DM 消息 |
| 命令 | `app.command()` | 斜杠命令 |
| 事件 | `app.event()` | 其他 Slack 事件 |
| 提及 | `app.event('app_mention')` | Bot 被提及 |
| 快捷方式 | `app.shortcut()` | 交互快捷方式 |

### 9. 應用入口 (index.ts)

**職責：**
- 應用啟動和初始化
- 配置加載
- 連接管理
- 優雅關閉

**啟動流程：**

```
main()
  ├─ loadConfig()              # 加載環境配置
  ├─ createConnection()         # 創建連接適配器
  ├─ registerHandlers()         # 註冊事件處理器
  ├─ setupShutdownHandlers()    # 設置關閉信號
  ├─ connection.start()         # 啟動連接
  └─ 監聽事件...
```

**關閉流程：**

```
process.on('SIGTERM') / process.on('SIGINT')
  ├─ connection.stop()          # 停止連接
  ├─ 關閉 HTTP 服務器
  ├─ 清理資源
  └─ process.exit(0)
```

## 依賴項分析

### 核心依賴

| 包名 | 版本 | 用途 |
|------|------|------|
| @slack/bolt | ^3.16.0 | Slack Bolt 框架 |
| @slack/web-api | ^6.9.0 | Slack Web API 客戶端 |
| http-proxy-agent | latest | HTTP Proxy 支持 |
| https-proxy-agent | latest | HTTPS Proxy 支持 |
| express | implied | HTTP 服務器（Bolt 依賴） |
| pino | ^8.17.2 | 結構化日誌 |
| dotenv | ^16.3.1 | 環境變數加載 |

### 開發依賴

| 包名 | 版本 | 用途 |
|------|------|------|
| typescript | ^5.3.3 | TypeScript 編譯器 |
| tsx | ^4.7.0 | TypeScript 執行器 |
| @types/node | ^20.10.0 | Node.js 類型定義 |
| jest | ^29.7.0 | 測試框架 |
| ts-jest | ^29.1.1 | Jest TypeScript 支持 |
| eslint | ^8.55.0 | 代碼檢查 |

## npm 腳本

```json
{
  "dev": "tsx watch src/index.ts",        // 開發模式
  "build": "tsc",                         // 構建
  "start": "node dist/index.js",          // 執行
  "test": "jest",                         // 測試
  "lint": "eslint src/**/*.ts"            // 代碼檢查
}
```

## 數據流示意圖

### Socket Mode 數據流

```
Slack 服務器
     ↓ (WebSocket)
SocketModeConnection
     ↓
Slack Bolt App
     ↓
Event Handlers
     ├─ app.message()
     ├─ app.command()
     └─ app.event()
     ↓
業務邏輯
     ↓
say() / respond() / client API
     ↓ (WebSocket)
Slack 服務器
     ↓
用戶
```

### HTTP Mode 數據流

```
Slack 服務器
     ↓ (HTTPS POST)
HTTP/HTTPS
ProxyAgent
     ↓
Express 服務器
(HttpConnection)
     ↓
ExpressReceiver
(簽名驗證)
     ↓
Slack Bolt App
     ↓
Event Handlers
     ├─ app.message()
     ├─ app.command()
     └─ app.event()
     ↓
業務邏輯
     ↓
say() / respond() / client API
     ↓ (HTTPS)
ProxyAgent
     ↓
Slack 服務器
     ↓
用戶
```

## 開發工作流程

```
編輯代碼
  ↓
pnpm run dev (tsx watch)
  ↓ (自動編譯和重啟)
測試功能
  ↓
修改 .env 切換模式
  ↓
pnpm run dev
  ↓
pnpm run lint (代碼檢查)
  ↓
pnpm test (運行測試)
  ↓
pnpm run build (生成 dist/)
  ↓
部署到生產
```

---

**最後更新：** 2026年4月22日

