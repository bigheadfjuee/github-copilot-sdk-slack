# 快速開始指南

## 5分鐘快速上手 Slack Bot

### Step 1: 創建 Slack App

1. 進入 [Slack API 控制台](https://api.slack.com/apps)
2. 點擊 **Create New App** → **From scratch**
3. 輸入 App 名稱，選擇工作區
4. 創建成功後進入 **Basic Information**

### Step 2: 生成必要的認證 Token

#### 方案 A：Socket Mode（推薦開發）

1. 進入 **Socket Mode** → 啟用 Socket Mode
2. 點擊 **Generate App-Level Token**
3. 授予 `connections:write` 權限
4. 複製 Token（格式：`xapp-...`）

**必須訂閱以下事件：**
- 進入 **Event Subscriptions** → 啟用 Events
- 添加以下 Bot User Events：
  - `app_mention`
  - `message.channels`
  - `message.im`
  - `message.mpim`
  - `message.groups`

5. 進入 **OAuth & Permissions** → **Bot User OAuth Token**
6. 複製 Bot Token（格式：`xoxb-...`）

**添加必要的作用域：**
- `chat:write`
- `chat:write.public`
- `app_mentions:read`

#### 方案 B：HTTP Mode（推薦生產）

1. 進入 **Event Subscriptions** → 啟用 Events
2. 輸入 **Request URL**（例如：`https://your-domain.com/slack/events`）
3. 進入 **Basic Information** → 複製 **Signing Secret**
4. 訂閱相同的事件（見上文）
5. 進入 **OAuth & Permissions** → 複製 **Bot User OAuth Token**

### Step 3: 本地開發設置

```bash
# 克隆或下載專案
git clone <repository-url>
cd github-copilot-sdk-slack

# 安裝依賴
pnpm install

# 複製環境配置
cp .env.example .env
```

### Step 4: 配置 .env 文件

#### Socket Mode（開發）

```env
# .env
CONNECTION_MODE=socket
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_APP_TOKEN=xapp-your-app-token-here
LOG_LEVEL=debug
NODE_ENV=development
```

#### HTTP Mode（生產）

```env
# .env
CONNECTION_MODE=http
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
HTTP_PORT=3000
LOG_LEVEL=info
NODE_ENV=production
```

#### HTTP Mode + 代理（企業）

```env
# .env
CONNECTION_MODE=http
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
HTTP_PORT=3000
HTTP_PROXY_URL=http://proxy.company.com:8080
HTTP_PROXY_USERNAME=your-username
HTTP_PROXY_PASSWORD=your-password
LOG_LEVEL=info
NODE_ENV=production
```

### Step 5: 啟動 Bot

#### 開發模式

```bash
pnpm run dev

# 輸出應顯示：
# INFO (module=App) Bot is ready and listening for events
```

#### 構建生產版本

```bash
# 編譯 TypeScript
pnpm run build

# 執行已編譯版本
pnpm start
```

### Step 6: 測試 Bot

#### 在 Slack 中

1. 打開任何頻道或 DM
2. 提及你的 Bot：`@your-bot-name hello`
3. Bot 應該回應：`Hi <@user>! I'm alive and running in socket mode.`

#### 命令測試

```
/echo test message
```

Bot 應該回應：`You said: test message`

#### HTTP Mode 健康檢查

```bash
curl http://localhost:3000/health

# 返回：
# {
#   "status": "ok",
#   "mode": "http",
#   "uptime": 123.456
# }
```

### Step 7: 部署到生產環境

#### 使用 Heroku

```bash
# 登錄 Heroku
heroku login

# 創建應用
heroku create my-slack-bot

# 設置環境變數
heroku config:set SLACK_BOT_TOKEN=xoxb-...
heroku config:set SLACK_SIGNING_SECRET=...
heroku config:set CONNECTION_MODE=http

# 部署
git push heroku main

# 查看日誌
heroku logs --tail
```

#### 使用 Docker

```bash
# 構建鏡像
docker build -t slack-bot .

# 運行容器
docker run -p 3000:3000 \
  -e CONNECTION_MODE=http \
  -e SLACK_BOT_TOKEN=xoxb-... \
  -e SLACK_SIGNING_SECRET=... \
  slack-bot
```

#### 使用 PM2

```bash
# 安裝 PM2
pnpm add -g pm2

# 啟動應用
pm2 start dist/index.js --name "slack-bot"

# 設置開機自啟
pm2 startup
pm2 save

# 查看日誌
pm2 logs slack-bot

# 停止應用
pm2 stop slack-bot
```

## 常見問題

### Q: Socket Mode 和 HTTP Mode 有什麼區別？

| 特性 | Socket Mode | HTTP Mode |
|------|-----------|-----------|
| 設置難度 | ⭐ 簡單 | ⭐⭐ 中等 |
| 延遲 | ⚡ 低 | ⚡⚡ 中等 |
| 生產用途 | ❌ 不推薦 | ✅ 推薦 |
| 開發用途 | ✅ 推薦 | ✓ 可以 |
| 代理支持 | ❌ 無 | ✅ 有 |
| 可擴展性 | ❌ 有限 | ✅ 高 |

### Q: 我收到 "authentication failed" 錯誤

檢查清單：
- [ ] 確認 Token 格式正確（`xoxb-` 或 `xapp-`）
- [ ] 確認 Token 未過期
- [ ] 確認環境變數正確加載
- [ ] 運行 `echo $SLACK_BOT_TOKEN` 確認值

### Q: Bot 不回應消息

檢查清單：
- [ ] 確認 Bot 已添加到頻道
- [ ] 確認事件訂閱已配置
- [ ] 檢查日誌中的錯誤信息
- [ ] 嘗試提及 Bot 而不是發送普通消息

### Q: 如何使用 HTTP Proxy？

1. 設置 `CONNECTION_MODE=http`
2. 配置代理環境變數：
   ```env
   HTTP_PROXY_URL=http://proxy.company.com:8080
   HTTP_PROXY_USERNAME=username
   HTTP_PROXY_PASSWORD=password
   ```
3. 重啟應用

### Q: 如何自定義消息處理？

編輯 `src/handlers.ts` 添加自定義邏輯：

```typescript
app.message(async ({ message, say }) => {
  if (message.text.includes('hello')) {
    await say('Hi there! 👋');
  }
});
```

## 後續步驟

1. **閱讀文檔**：查看 `README.md` 了解完整功能
2. **擴展功能**：在 `src/handlers.ts` 添加自定義命令
3. **部署上線**：使用上述任一方法部署到生產環境
4. **監控告警**：設置日誌聚合和告警

## 有用的資源

- 📖 [Slack Bolt 文檔](https://slack.dev/bolt-js/)
- 🔌 [Socket Mode 指南](https://api.slack.com/socket-mode)
- 🐳 [Docker 部署](https://docker.com/)
- 📊 [PM2 進程管理](https://pm2.keymetrics.io/)

---

**提示：** 遇到問題？檢查 `NODE_ENV=development` 時的日誌輸出，或者提交 Issue 到項目倉庫。

