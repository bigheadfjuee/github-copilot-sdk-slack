# 實現細節和架構設計

## 概述

本項目使用參考 Hermes Agent 的架構模式，實現一個高度模組化、易於擴展的 Slack Bot TypeScript 專案。

## 1. 架構模式

### 1.1 模組化設計（參考 Hermes Agent）

```
應用層
  ↓
配置層 ← 環境管理（.env）
  ↓
連接層 ← 工廠模式選擇實現
  ├─ Socket Mode（WebSocket）
  └─ HTTP Mode（+ Proxy 支持）
  ↓
事件處理層 ← 中間件模式
  ├─ 消息處理
  ├─ 命令處理
  └─ 事件監聽
  ↓
業務邏輯層
```

### 1.2 工廠模式（ConnectionFactory）

**目的：** 根據配置動態選擇連接實現，支持在運行時切換模式

```typescript
// config.ts 決定了使用哪個實現
const connection = createConnection(config);

// factory.ts 根據 config.mode 返回不同的實現
if (config.mode === 'socket') {
  return new SocketModeConnection(config);
} else if (config.mode === 'http') {
  return new HttpConnection(config);
}
```

**優勢：**
- 無需修改核心代碼即可切換模式
- 易於添加新的連接模式
- 符合開放閉合原則（SOLID）

### 1.3 適配器模式（Connection Adapters）

**SocketModeConnection** 和 **HttpConnection** 都實現了統一的 `SlackConnection` 介面

```typescript
interface SlackConnection {
  start(): Promise<void>;
  stop(): Promise<void>;
  getApp(): App;
  isActive(): boolean;
}
```

**優勢：**
- 上層代碼無需關心具體實現
- 易於測試（可替換為 Mock）
- 新增連接方式只需實現介面

## 2. Socket Mode 實現

### 2.1 工作流程

```
1. 初始化 Slack Bolt App with socketMode=true
   ↓
2. 建立 WebSocket 連接到 Slack
   ↓
3. Slack 通過 WebSocket 推送事件
   ↓
4. 事件處理器(app.message, app.command 等)響應
   ↓
5. 事件處理完成，等待下一個事件
```

### 2.2 關鍵代碼

```typescript
// Socket Mode 使用 Slack Bolt 的內置 socketMode 支持
this.app = new App({
  token: config.botToken,
  socketMode: true,
  appToken: config.appToken,
});

// 啟動會自動建立 WebSocket 連接
await this.app.start();
```

### 2.3 優點和限制

**優點：**
- ✅ 開發簡單，無需配置 HTTP 端點
- ✅ 低延遲（WebSocket）
- ✅ 無需公開暴露服務器
- ✅ 事件實時推送

**限制：**
- ❌ 不適合高流量生產環境
- ❌ 單個進程限制（無法水平擴展）
- ❌ 僅適合單機部署

## 3. HTTP Mode 實現

### 3.1 工作流程

```
1. 初始化 Express 服務器
   ↓
2. 創建 ExpressReceiver（Slack Bolt 提供）
   ↓
3. Express 監聽 HTTP 請求
   ↓
4. Slack 發送 POST 請求到 /slack/events
   ↓
5. ExpressReceiver 驗證簽名（防偽造）
   ↓
6. 事件處理器響應
   ↓
7. 返回 HTTP 200 OK
```

### 3.2 關鍵代碼

```typescript
// 創建 Express 應用和 Receiver
const expressApp = express();
const receiver = new ExpressReceiver({
  signingSecret: config.signingSecret,
  app: expressApp,
});

// Slack Bolt App 使用 ExpressReceiver
const app = new App({
  token: config.botToken,
  signingSecret: config.signingSecret,
  receiver: receiver,
});

// 啟動 Express 服務器
this.server = expressApp.listen(config.httpPort);
```

### 3.3 簽名驗證

Slack 每個 HTTP 請求都包含簽名，用於驗證請求來自 Slack：

```
頭部：
X-Slack-Request-Timestamp: 1234567890
X-Slack-Signature: v0=...

驗證算法：
signature = 'v0=' + hmac_sha256(
  signing_secret,
  f"{timestamp}:{body}"
)
```

ExpressReceiver 自動執行此驗證。

### 3.4 優點和限制

**優點：**
- ✅ 適合生產環境
- ✅ 支持水平擴展（多個進程/容器）
- ✅ 支持 Load Balancer
- ✅ 支持 HTTP Proxy

**限制：**
- ❌ 需要公開 HTTP 端點
- ❌ 需要配置 Request URL
- ❌ 必須使用 HTTPS（生產）
- ❌ 稍高的延遲

## 4. HTTP Proxy 支持

### 4.1 實現原理

企業環境通常需要通過 HTTP Proxy 訪問外部服務。本項目在 HTTP Mode 中集成代理支持：

```typescript
// proxy.ts
const proxyAgents = createProxyAgents(proxyConfig);

// 創建支持代理的 HTTP/HTTPS agents
const httpAgent = new HttpProxyAgent(proxyUrl);
const httpsAgent = new HttpsProxyAgent(proxyUrl);

// 傳遞給 Slack Bolt App
const app = new App({
  clientOptions: {
    agent: httpAgent,
  },
});
```

### 4.2 代理認證

支持用戶名/密碼認證：

```typescript
// 代理 URL 格式
http://username:password@proxy:8080

// 或在環境變數中設置
HTTP_PROXY_URL=http://proxy.company.com:8080
HTTP_PROXY_USERNAME=username
HTTP_PROXY_PASSWORD=password

// 代碼會自動組合
const proxyUrl = new URL(proxyConfig.url);
proxyUrl.username = proxyConfig.username;
proxyUrl.password = proxyConfig.password;
```

### 4.3 常見企業配置

```env
# 例 1：沒有認證的代理
HTTP_PROXY_URL=http://proxy.internal.net:8080

# 例 2：需要 Windows 域名認證
HTTP_PROXY_URL=http://proxy.internal.net:8080
HTTP_PROXY_USERNAME=DOMAIN\username
HTTP_PROXY_PASSWORD=password

# 例 3：需要 API 密鑰認證
HTTP_PROXY_URL=http://proxy.internal.net:8080
HTTP_PROXY_USERNAME=api-key-id
HTTP_PROXY_PASSWORD=api-secret
```

## 5. 事件處理架構

### 5.1 事件流

```
Slack → (Socket Mode: WebSocket / HTTP: POST request)
  ↓
Slack Bolt App
  ↓
中間件鏈
  ├─ 簽名驗證（HTTP only）
  ├─ 日誌記錄
  └─ 自定義中間件
  ↓
事件處理器
  ├─ app.message() → 消息事件
  ├─ app.command() → 命令事件
  ├─ app.event() → 原生事件
  └─ app.shortcut() → 交互快捷方式
  ↓
回復發送
  ├─ say()：發送消息
  ├─ respond()：回復命令
  └─ client API：高級操作
```

### 5.2 消息處理示例

```typescript
// handlers.ts
app.message(async ({ message, say, client }) => {
  try {
    // 1. 消息驗證
    if (message.bot_id) return; // 忽略機器人消息

    // 2. 處理邏輯
    const response = `Echo: ${message.text}`;

    // 3. 發送回復
    await say({
      text: response,
      thread_ts: message.thread_ts || message.ts,
    });
  } catch (error) {
    logger.error({ error }, 'Error handling message');
  }
});
```

### 5.3 命令處理示例

```typescript
app.command('/echo', async ({ command, ack, respond }) => {
  // 1. 立即確認（Slack 要求 3 秒內）
  await ack();

  // 2. 處理命令
  const response = `You said: ${command.text}`;

  // 3. 回復用戶
  await respond({
    text: response,
  });
});
```

## 6. 錯誤處理和恢復

### 6.1 應用級別錯誤

```typescript
app.error(async (error) => {
  logger.error({ error }, 'Slack app error');
  // 例：發送告警通知
});
```

### 6.2 連接級別錯誤

```typescript
const connection = createConnection(config, {
  onError: async (error) => {
    logger.error({ error }, 'Connection error');
    // 例：嘗試重新連接
  },
});
```

### 6.3 優雅關閉

```typescript
process.on('SIGTERM', async () => {
  logger.info('Shutdown signal received');
  await connection.stop();
  process.exit(0);
});
```

## 7. 日誌系統

### 7.1 Pino 日誌配置

```typescript
// logger.ts
export const logger = pino({
  level: process.env.LOG_LEVEL || 'debug',
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
    },
  } : undefined,
});
```

### 7.2 結構化日誌輸出

```
開發環境（彩色輸出）：
[15:32:45.123] INFO (module=App) Bot is ready

生產環境（JSON 格式）：
{"level":30,"time":"2026-04-22T15:32:45.123Z","module":"App","msg":"Bot is ready"}
```

### 7.3 性能考慮

- 生產環境不使用 pino-pretty（減少開銷）
- 自動級別調整：`LOG_LEVEL=info`
- 結構化日誌便於日誌聚合（ELK、Datadog 等）

## 8. 配置管理

### 8.1 環境變數驗證

```typescript
// config.ts 在啟動時驗證
if (!process.env.SLACK_BOT_TOKEN) {
  throw new Error('SLACK_BOT_TOKEN environment variable is required');
}
```

### 8.2 配置對象

```typescript
interface BotConfig {
  botToken: string;
  appToken?: string;
  signingSecret?: string;
  mode: 'socket' | 'http';
  httpPort: number;
  httpPath: string;
  proxy?: ProxyConfig;
  logLevel: string;
  nodeEnv: string;
}
```

### 8.3 類型安全

所有配置通過 TypeScript interface 檢查，編譯時即發現錯誤。

## 9. 與 Hermes Agent 的相似之處

| 特性 | Hermes Agent | 本項目 |
|------|-----------|--------|
| 模組化 | agent/、tools/、gateway/ | config/、connections/、handlers/ |
| 適配器模式 | platforms/ | connections/ |
| 日誌系統 | 結構化日誌 | Pino |
| 配置管理 | config.yaml + .env | loadConfig() + .env |
| 進程管理 | 優雅關閉、SIGTERM 處理 | 相同 |
| 錯誤處理 | 全局錯誤處理 | 相同 |

## 10. 擴展指南

### 10.1 添加新事件類型

```typescript
// 在 src/handlers.ts 添加
app.event('reaction_added', async ({ event, client }) => {
  logger.info('Reaction added');
  // 處理邏輯
});
```

### 10.2 添加新連接模式

```typescript
// 創建 src/connections/custom-mode.ts
export class CustomModeConnection implements SlackConnection {
  async start(): Promise<void> { /* ... */ }
  async stop(): Promise<void> { /* ... */ }
  getApp(): App { /* ... */ }
  isActive(): boolean { /* ... */ }
}

// 更新 factory.ts
if (config.mode === 'custom') {
  return new CustomModeConnection(config, events);
}
```

### 10.3 添加中間件

```typescript
// 自定義中間件
app.middleware(async ({ logger, body, next }) => {
  logger.debug(body);
  await next();
});
```

## 11. 性能優化

### 11.1 連接優化

| 優化項 | Socket Mode | HTTP Mode |
|------|----------|----------|
| 連接管理 | 自動（WebSocket） | ExpressReceiver 管理 |
| 超時設置 | AWS 管理 | 3000ms（Slack 要求） |
| 重試機制 | 自動 | 手動實現 |

### 11.2 消息處理優化

```typescript
// 異步處理長任務
app.command('/long-task', async ({ command, ack, respond, client }) => {
  await ack(); // 立即確認
  
  // 異步處理
  setImmediate(async () => {
    const result = await doLongWork();
    await respond({ text: result });
  });
});
```

---

**最後更新：** 2026年4月22日

