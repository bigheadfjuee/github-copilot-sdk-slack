## Why

目前 `SocketModeConnection` 使用 `@slack/bolt` 的高層封裝來建立 WebSocket 連線，但無法直接注入 `HttpsProxyAgent`，導致在需要 HTTP Proxy 的企業網路環境中，Socket Mode 連線無法正常建立。參考 `src/slack_demo.js` 的做法，改用 `@slack/socket-mode` 的 `SocketModeClient` 直接初始化並傳入 agent，可解決此問題。

## What Changes

- 將 `SocketModeConnection` 的底層從 `@slack/bolt App (socketMode: true)` 改為直接使用 `SocketModeClient`
- 使用 `@slack/web-api` 的 `WebClient` 取代 `app.client`，並同樣注入 `HttpsProxyAgent`
- `proxy.ts` 的 `createProxyAgent` 改為回傳 `HttpsProxyAgent` 實例（統一走 HTTPS proxy）
- 保留 `@slack/bolt` 的 `App` 僅用於 HTTP mode；socket mode 不再依賴 `App`
- 保留現有 `ConnectionEvents`（onStart / onStop / onError）介面不變
- 移除原先錯誤的 `socketClient = app.client as unknown as SocketModeClient` 轉型

## Non-Goals

- 不修改 HTTP mode 的連線邏輯
- 不修改 handlers.ts 的事件處理邏輯
- 不升級或降級任何 npm 套件版本
- 不支援 SOCKS proxy（僅 HTTP/HTTPS proxy）

## Capabilities

### New Capabilities

- `socket-mode-direct-client`: 直接使用 `SocketModeClient` + `WebClient` 建立 Socket Mode 連線，支援透過 `HttpsProxyAgent` 走 proxy

### Modified Capabilities

(none)

## Impact

- Affected code:
  - `src/connections/socket-mode.ts` — 核心重構目標
  - `src/proxy.ts` — 調整 proxy agent 建立方式
  - `src/handlers.ts` — 可能需調整 `app` 物件的取得方式
  - `src/connections/factory.ts` — 傳入 proxy agent 至 SocketModeConnection
  - `src/config.ts` — 確認 proxy 設定欄位完整
