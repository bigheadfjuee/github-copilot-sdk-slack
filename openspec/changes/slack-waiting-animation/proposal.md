## Why

目前 Slack bot 在等待 Copilot 回應期間完全靜默，用戶無法得知 bot 是否正在處理，體驗與已掛機無異。透過加入 waiting 動畫（typing status + reaction emoji），讓用戶在等待期間獲得視覺回饋，提升感知回應速度。

## What Changes

- 新增 `src/slack/typing-indicator.ts`：封裝 Slack `assistant_threads_setStatus` 的持續輪播邏輯，在 Copilot 處理期間每隔固定秒數刷新 `"is thinking..."` 狀態
- 新增 `src/slack/reaction-manager.ts`：封裝對用戶原始訊息加上 `:eyes:` reaction（開始處理）及完成後切換為 `:white_check_mark:` 或 `:x:`（成功 / 失敗）的邏輯
- 修改 `src/handlers.ts`：在呼叫 `session.sendAndWait()` 前啟動 typing indicator 與 `:eyes:` reaction，完成後停止 indicator 並更新 reaction
- 修改 `src/config.ts`：新增 `COPILOT_TYPING_INTERVAL_MS`（可選，預設 2000ms）控制刷新間隔

## Capabilities

### New Capabilities

- `typing-indicator`: 在 Copilot 處理期間，定期呼叫 `assistant_threads_setStatus` 保持 Slack 的「正在輸入」狀態顯示
- `processing-reaction`: 對用戶原始訊息加上 reaction emoji，反映目前處理狀態（處理中 → 完成 / 失敗）

### Modified Capabilities

(none)

## Impact

- Affected code:
  - `src/handlers.ts`
  - `src/config.ts`
  - `src/slack/typing-indicator.ts`（新增）
  - `src/slack/reaction-manager.ts`（新增）
- Affected APIs: Slack Web API — `assistant_threads_setStatus`、`reactions.add`、`reactions.remove`
- No new npm dependencies required（`@slack/web-api` 已包含上述 API）
