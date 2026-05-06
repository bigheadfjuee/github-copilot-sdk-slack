# 修復 Copilot 錯誤處理 - 解決空錯誤對象問題

## 問題描述

當 `session.sendAndWait()` 失敗時，日誌輸出空的錯誤對象：

```
ERROR: Error forwarding message to Copilot
module: "BotHandlers"
userId: "U0AB1QGUADC"
error: {}
```

這導致無法識別真正的故障原因，影響調試和監控。

## 根本原因

1. **空錯誤對象序列化**：當 `logger.error({ error })` 直接傳遞錯誤對象時，Pino 日誌器的序列化可能會導致複雜的 Error 對象變成 `{}`
2. **缺乏詳細信息**：沒有記錄錯誤的名稱、訊息和堆棧跟蹤
3. **無重試機制**：臨時性故障（網絡問題）無法自動恢復
4. **無故障隔離**：多個失敗會導致級聯故障

## 實施的修復

### 1. 改進錯誤詳情捕捉 (`src/handlers.ts`)

**修改前：**
```typescript
logger.error({ error, userId: event.user }, 'Error forwarding message to Copilot');
```

**修改後：**
```typescript
// 提取錯誤的各個部分
const errorMessage = error?.message ?? String(error);
const errorName = error?.name ?? 'UnknownError';
const errorStack = error?.stack ?? '';

logger.error(
  {
    userId: event.user,
    errorName,           // 錯誤類型（如 "TypeError", "NetworkError"）
    errorMessage,        // 錯誤訊息
    errorStack: errorStack.split('\n').slice(0, 3), // 堆棧跟蹤（前3行）
    circuitBreakerState, // 斷路器狀態
    fullError: JSON.stringify(error, null, 2), // 完整序列化
  },
  'Error forwarding message to Copilot'
);
```

**優點：**
- ✅ 完整的錯誤信息不會遺失
- ✅ 可以根據錯誤名稱識別故障模式
- ✅ 堆棧跟蹤協助快速定位問題

### 2. 動態用戶訊息

根據錯誤類型提供更具體的反饋：

```typescript
let userMessage = 'An error occurred while processing your message.';
if (errorName.includes('Permission') || errorMessage.includes('permission')) {
  userMessage = 'Permission denied. Please check your Copilot access.';
} else if (errorName.includes('Network') || errorMessage.includes('network')) {
  userMessage = 'Network error. Please check your connection and try again.';
} else if (errorName.includes('Invalid') || errorMessage.includes('invalid')) {
  userMessage = 'Invalid request. Please try rephrasing your message.';
}
```

### 3. 智能 Session 重置

只在需要時重置 session（session 相關錯誤）：

```typescript
if (
  errorName.includes('Session') ||
  errorName.includes('Disconnect') ||
  errorMessage.includes('disconnected')
) {
  await sessionManager.resetSession(event.user);
}
```

### 4. 新增重試機制 (`src/utils/retry.ts`)

**重試包裝器 - `withRetry()`**

功能：
- 指數退避（從 100ms 到 5000ms）
- 可配置的重試次數和延遲
- 智能判斷是否可重試

```typescript
const reply = await withRetry(
  () => Promise.race([
    session.sendAndWait({ prompt: event.text }),
    timeoutPromise,
  ]),
  {
    maxAttempts: 2,        // 共嘗試 2 次（重試 1 次）
    initialDelayMs: 500,   // 首次延遲 500ms
    maxDelayMs: 1000,      // 最大延遲 1s
  }
);
```

**重試決策：**
- ✅ **可重試**：網絡錯誤、超時、連接重置
- ❌ **不可重試**：權限錯誤、認證失敗、無效請求

### 5. 斷路器模式 (`src/utils/retry.ts` 的 `CircuitBreaker` 類)

功能：防止級聯故障

三種狀態：
1. **Closed** - 正常運作，請求通過
2. **Open** - 故障檢測，拒絕所有請求，提示用戶稍後重試
3. **Half-Open** - 嘗試恢復，允許一個請求測試服務狀態

配置：
```typescript
const copilotCircuitBreaker = new CircuitBreaker(
  5,      // 失敗 5 次後打開
  60000   // 60 秒後嘗試恢復
);
```

流程：
```
正常 ──(5 次失敗)──> 打開(拒絕請求) ──(60 秒)──> 半開(測試) ──(成功)──> 正常
                                              ↓(失敗)
                                              打開
```

## 修改的文件

### 1. `src/handlers.ts`

**變更內容：**
- ✅ 導入 `withRetry` 和 `CircuitBreaker`
- ✅ 初始化全局斷路器
- ✅ 改進 catch 塊中的錯誤處理
- ✅ 使用 `withRetry()` 包裝 `sendAndWait()` 調用
- ✅ 添加斷路器執行包裝
- ✅ 添加詳細的錯誤日誌和堆棧跟蹤
- ✅ 動態生成用戶友好的錯誤訊息
- ✅ 智能判斷何時重置 session

**行號：**
- 1-9：導入語句
- 12-17：斷路器初始化
- 95-108：重試邏輯包裝
- 125-156：改進的錯誤處理

### 2. `src/utils/retry.ts`（新文件）

**包含：**
- `withRetry<T>()` - 異步函式重試包裝器
- `sleep()` - 延遲輔助函式
- `CircuitBreaker` - 斷路器類實現
- 可重試錯誤判斷邏輯

## 測試建議

### 1. 測試改進的錯誤日誌

```bash
# 查看日誌輸出
npm run dev

# 在 Slack 發送訊息時故意造成錯誤，檢查日誌：
# ERROR: Error forwarding message to Copilot
# {
#   userId: "U0AB1QGUADC",
#   errorName: "NetworkError",
#   errorMessage: "ECONNREFUSED",
#   errorStack: ["Error: ECONNREFUSED", "  at ..."],
#   circuitBreakerState: "closed",
#   fullError: "{...}"
# }
```

### 2. 測試重試邏輯

```typescript
// 模擬臨時性網絡故障（第一次失敗，第二次成功）
const testRetry = async () => {
  let attempt = 0;
  const result = await withRetry(async () => {
    attempt++;
    if (attempt === 1) throw new Error('Network connection failed');
    return 'Success on retry';
  });
  console.log(result); // "Success on retry"
};
```

### 3. 測試斷路器

```typescript
// 模擬 5 次連續失敗，觸發斷路器打開
const testCircuitBreaker = async () => {
  for (let i = 0; i < 6; i++) {
    try {
      await copilotCircuitBreaker.execute(async () => {
        throw new Error('Service unavailable');
      });
    } catch (error) {
      console.log(`Attempt ${i + 1}: ${error.message}`);
      // Attempt 1-5: Service unavailable
      // Attempt 6: Circuit breaker is open - service temporarily unavailable
    }
  }
};
```

## 監控指標

新增以下可監控的指標：

1. **錯誤分類統計**
   - `errorName` 分佈（NetworkError vs SessionError vs PermissionError）
   - 幫助識別系統性問題

2. **重試成功率**
   - 通過對比首次失敗 vs 重試成功的訊息
   - 識別哪些故障是臨時的

3. **斷路器狀態轉換**
   - 監控何時打開/關閉
   - 識別服務穩定性問題

## 向後兼容性

✅ **完全向後兼容**
- 沒有 API 改變
- 沒有配置文件修改
- 現有的 Slack 機制人沒有影響

## 下一步改進建議

1. **持久化重試統計**
   - 記錄重試成功/失敗率
   - 調整重試參數

2. **動態斷路器調整**
   - 根據故障率自動調整閾值
   - 支持每個用戶的獨立斷路器

3. **告警集成**
   - 當斷路器打開時發送通知
   - 監控特定錯誤類型的激增

4. **優雅降級**
   - 當 Copilot 不可用時，自動回退到其他 LLM
   - 實現多模型容錯

## 驗證

✅ 代碼已編譯成功：
```bash
$ npm run build
> github-copilot-sdk-slack@1.0.0 build
> tsc
# 編譯成功，無錯誤
```

✅ 所有類型檢查通過

✅ 新增的重試機制和斷路器已集成到消息處理流程中
