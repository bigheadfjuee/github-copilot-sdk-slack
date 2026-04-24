## Why

使用者在 Slack 中透過斜線命令 `/model <name>` 可以在對話開始前指定 AI 模型，讓不同情境下能選擇最適合的模型（速度、能力、成本的取捨），而無需修改程式碼或重啟應用程式。

## What Changes

- 新增 Slack 斜線命令 `/model` 的處理邏輯，接受模型名稱作為參數
- 支援的模型別名：`sonnet`（→ `claude-sonnet-4.6`）、`haiku`（→ `claude-haiku-4.5`）、`opus`（→ `claude-opus-4.6`）、`gpt-5`（→ `gpt-5.4`）
- 在建立新 Copilot Session 時，根據使用者選定的模型呼叫 `client.createSession({ model: "<model-id>" })`
- 每個 Slack 使用者（user ID）的模型偏好在 session 生命週期內持久保存；若未指定則沿用預設模型
- 斜線命令回應確認訊息，顯示已選擇的模型名稱

## Non-Goals

- 不支援在對話進行中動態切換模型（僅在新 session 建立時生效）
- 不持久化跨重啟的模型選擇（僅限記憶體儲存）
- 不驗證使用者是否有權限使用特定模型

## Capabilities

### New Capabilities

- `slash-command-model-selector`: 處理 `/model` 斜線命令，解析模型別名並儲存每位使用者的模型偏好，供後續建立 Copilot Session 時使用

### Modified Capabilities

(none)

## Impact

- Affected specs: `slash-command-model-selector` (new)
- Affected code:
  - `src/app.ts` 或主要 Slack Bolt 應用程式入口（新增斜線命令 handler）
  - `src/session.ts` 或 session 管理模組（建立 session 時傳入 model 參數）
  - `src/models.ts`（新增模型別名對照表，新檔案）
