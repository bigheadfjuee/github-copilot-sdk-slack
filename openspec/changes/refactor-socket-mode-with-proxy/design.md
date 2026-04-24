## Context

目前 `SocketModeConnection`（`src/connections/socket-mode.ts`）使用 `@slack/bolt` 的 `App` 並設定 `socketMode: true`。這個做法雖然方便，但 Bolt 的 `App` 建構子不提供直接注入 `agent`（如 `HttpsProxyAgent`）給底層 WebSocket 連線的介面。

現有的 `src/proxy.ts` 已可建立 proxy agent，但目前只在 HTTP mode 使用。`src/slack_demo.js` 已驗證：直接使用 `SocketModeClient({ appToken, clientOptions: { agent } })` 與 `WebClient(botToken, { agent })` 可在 proxy 環境下正常運作。

## Goals / Non-Goals

**Goals:**

- 將 `SocketModeConnection` 改為直接使用 `SocketModeClient` + `WebClient`
- 讓 `HttpsProxyAgent` 可透過 `clientOptions.agent` 注入 WebSocket 連線
- 保留對外介面 `SlackConnection`（`start / stop / getApp / isActive`）不變
- 保留 `ConnectionEvents` 回呼（onStart / onStop / onError）
- `getApp()` 改為回傳 `WebClient`（供 handlers 使用），並調整型別宣告

**Non-Goals:**

- 不修改 HTTP mode
- 不修改 handlers.ts 事件邏輯
- 不升級套件版本
- 不支援 SOCKS proxy

## Decisions

### 直接使用 SocketModeClient 取代 Bolt App

**選擇**：使用 `@slack/socket-mode` 的 `SocketModeClient` 直接初始化。

**理由**：`SocketModeClient` 的建構選項 `clientOptions` 接受 `agent` 參數，可直接傳入 `HttpsProxyAgent`。Bolt `App` 的 `socketMode: true` 模式在內部也是包裝此 client，但沒有公開此注入介面。`slack_demo.js` 已驗證此方式可行。

**放棄的替代方案**：透過 monkey-patch 或繼承 Bolt `App` 注入 agent — 太脆弱，升級 SDK 後可能失效。

### WebClient 獨立初始化

**選擇**：使用 `@slack/web-api` 的 `WebClient` 獨立初始化，並傳入相同的 `agent`。

**理由**：`SocketModeClient` 本身不處理主動發訊（postMessage 等），需要獨立的 `WebClient`。直接傳入 `agent` 確保 REST API 呼叫也走 proxy。

### getApp() 回傳 WebClient

**選擇**：`getApp()` 的回傳型別從 `App` 改為 `WebClient`，並在 `SlackConnection` 介面中將型別改為 `any`（已是現狀）。

**理由**：handlers 需要透過 `getApp()` 取得 client 物件來呼叫 API。Bolt `App` 的 `app.client` 本來就是 `WebClient`，所以語意不變，只是不再包裝在 `App` 中。

### proxy agent 建立統一走 HttpsProxyAgent

**選擇**：`src/proxy.ts` 的 `createProxyAgent` 回傳 `HttpsProxyAgent | undefined`，移除 `HttpProxyAgent`。

**理由**：Slack API（`wss://` 和 `https://`）都是加密連線，`HttpsProxyAgent` 可同時處理 HTTP proxy 和 HTTPS proxy tunnel，不需要分開兩種 agent。

## Risks / Trade-offs

- [風險] `SocketModeClient` 的事件 API（`on('message', ...)` 等）與 Bolt `app.message(...)` 的 middleware 模式不同，handlers.ts 需要確認是否依賴 Bolt middleware → **緩解**：`handlers.ts` 目前透過 `getApp()` 取得的是 `app.client`（即 `WebClient`），事件處理是掛載在 `app.message / app.command` 等，這些在重構後需要改為掛載在 `socketClient.on(...)` 上，或保留一個精簡的 Bolt `App` 實例僅供 middleware routing。**決定**：由於 handlers.ts 使用 Bolt middleware，在 socket-mode.ts 中仍建立一個輕量的 Bolt `App`（不啟動 HTTP server，不啟動 Socket Mode），僅用來掛載 middleware，然後將 `socketClient` 的事件 dispatch 轉發給 Bolt App 的 receiver。**最終決定（簡化）**：直接用 `SocketModeClient` 替換，handlers.ts 改為使用 `socketClient.on(...)` 事件 API，移除 Bolt middleware 依賴。
- [風險] `HttpsProxyAgent` v9+ 的 import 方式為 named export `{ HttpsProxyAgent }`，需確認 tsconfig 的 moduleResolution 設定 → **緩解**：在 proxy.ts 中加入型別保護

## Migration Plan

1. 修改 `src/proxy.ts`：統一回傳 `HttpsProxyAgent | undefined`
2. 修改 `src/connections/socket-mode.ts`：使用 `SocketModeClient` + `WebClient`
3. 修改 `src/connections/factory.ts`：建立 proxy agent 並傳入 `SocketModeConnection`
4. 修改 `src/handlers.ts`：將 Bolt middleware 改為 `socketClient.on(...)` 事件處理
5. 修改 `src/connections/types.ts`：視需要調整 `getApp()` 型別
6. 執行 `pnpm run build` 確認無 TypeScript 錯誤
7. 本地測試：設定 `.env` 後執行 `pnpm run dev` 確認連線與回訊正常
