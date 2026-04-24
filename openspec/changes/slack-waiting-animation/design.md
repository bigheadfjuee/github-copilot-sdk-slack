## Context

`github-copilot-sdk-slack` 是一個 TypeScript Slack bot，透過 Socket Mode 接收訊息，呼叫 Copilot SDK 的 `session.sendAndWait()` 取得回應後再以 `chat.postMessage` 回覆。`sendAndWait()` 是阻塞式等待，整個等待期間 bot 對 Slack 完全靜默。

參考 `hermes-agent`（Python/Bolt）的做法：
- 以 `assistant_threads_setStatus` 呼叫 Slack 官方的 typing/status API 保持顯示
- 以 `reactions.add/remove` 在用戶原始訊息上標示處理狀態

目前 `@slack/web-api` 已安裝，可直接使用 `webClient.assistant.threads.setStatus` 及 `webClient.reactions.add/remove`，無需新增 npm 依賴。

## Goals / Non-Goals

**Goals:**

- 在 `sendAndWait()` 執行期間每 N 毫秒呼叫一次 `assistant_threads_setStatus` 保持 "is thinking..." 顯示
- 在開始處理時對用戶原始訊息加上 `:eyes:` reaction
- 在回應成功後切換為 `:white_check_mark:`，失敗（超時 / 例外）切換為 `:x:`
- 允許透過 `COPILOT_TYPING_INTERVAL_MS` 調整刷新間隔（預設 2000ms）

**Non-Goals:**

- 不顯示工具呼叫進度訊息（hermes-agent 的第二層機制，scope 外）
- 不實作暫停/恢復 typing 機制
- 不支援多重 thread 並發的 reaction 管理（每個 userId session 獨立處理）

## Decisions

### TypingIndicator with setInterval + stop event, not recursive setTimeout

`setInterval` 回呼在 Copilot 處理期間持續執行，由 `stop()` 方法清除。若 API 呼叫失敗（非致命），catch 後僅 log warning 繼續執行，避免 typing 失敗影響主流程。

**Alternative considered**: 遞迴 `setTimeout`（hermes-agent 的做法）。TS 環境用 `setInterval` 更直觀，且不需要 `asyncio.CancelledError` 等 Python 非同步概念的等價處理。

### TypingIndicator and ReactionManager as independent modules

分別封裝在 `src/slack/typing-indicator.ts` 與 `src/slack/reaction-manager.ts`，在 `handlers.ts` 中組合使用。

**Alternative considered**: 直接在 `handlers.ts` 行內實作。提取為獨立模組便於單獨測試與未來複用。

### assistant_threads_setStatus calling approach

Slack SDK `@slack/web-api` 提供 `webClient.apiCall('assistant.threads.setStatus', {...})` 或型別化的 `webClient.assistant.threads.setStatus({...})`（若版本支援）。設計優先使用型別化介面，fallback 為 `apiCall`。

**Alternative considered**: 使用 `chat.update` 編輯佔位訊息實作動畫。`assistant_threads_setStatus` 是 Slack 官方 Assistant API，語意更精確，且不佔用對話 thread 的訊息空間。

## Risks / Trade-offs

- [Risk] `assistant_threads_setStatus` 只在 Slack App 有 `assistant` scope 且開啟 Assistant 功能時有效；一般 bot 呼叫可能靜默失敗 → Mitigation: 在 log warning 層級記錄 API 錯誤，不中斷主流程；在 `.env.example` 說明所需 scope
- [Risk] `reactions.add` 對同一則訊息重複加相同 reaction 會返回 `already_reacted` 錯誤 → Mitigation: catch 該特定錯誤碼，不視為失敗
- [Risk] 用戶訊息來自 DM 時 `channel` 和 `ts` 可能與 thread 不同 → Mitigation: 使用 `event.ts`（原始訊息 ts）作為 reaction 目標，與現有 `thread_ts` 邏輯分開

## Migration Plan

無破壞性變更。直接部署後，若 Slack App 已有 `assistant` scope，立即生效；若無，typing status 靜默失敗，reaction 可能因 scope 不足而失敗（log warning），其餘功能不受影響。
