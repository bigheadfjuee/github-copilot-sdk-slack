## Why

目前 Slack Bot 只能透過 GitHub Copilot SDK 互動。需要支援連線至獨立運行的 opencode 伺服器，讓使用者可透過 Slack 斜線命令 `/oc` 建立 opencode session，並在同一 Slack thread/session 內雙向傳遞訊息，直接操控 opencode 代理能力。

## What Changes

- 新增 Slack 斜線命令 `/oc <prompt>` 的處理邏輯：
  - 首次呼叫時，使用 `@opencode-ai/sdk` 的 `createOpencodeClient` 連線至指定的 opencode 伺服器
  - 呼叫 `client.session.create()` 建立新的 opencode session，並將 session ID 綁定至 Slack 使用者
  - 將 `<prompt>` 作為首次訊息傳送至該 session（`client.session.prompt()`）
  - 回覆 opencode 回應到 Slack thread
- 後續同 Slack 使用者的一般訊息（非斜線命令），若已有綁定的 opencode session，則直接轉發至 opencode（`client.session.prompt()`）並回覆結果
- 新增環境設定 `OPENCODE_BASE_URL`（opencode 伺服器 URL，預設 `http://localhost:4096`）與選填的 `OPENCODE_SERVER_PASSWORD`（Basic Auth）
- 新增 `OpencodeBridge` 類別負責管理 opencode client 與 per-user session ID 的對應

## Capabilities

### New Capabilities

- `opencode-session-bridge`: 管理 Slack 使用者與 opencode session 的對應、訊息雙向橋接，以及 `/oc` 斜線命令觸發邏輯

### Modified Capabilities

(none)

## Impact

- Affected specs: `opencode-session-bridge` (new)
- Affected code:
  - `src/opencode/bridge.ts`（新建 — OpencodeBridge 類別）
  - `src/handlers.ts`（修改 — 新增 `/oc` 命令處理；訊息 handler 加入 opencode session 路由）
  - `src/index.ts`（修改 — 初始化 OpencodeBridge 並注入 handlers）
  - `package.json`（修改 — 新增 `@opencode-ai/sdk` 依賴）
- New environment variables: `OPENCODE_BASE_URL`, `OPENCODE_SERVER_PASSWORD`
