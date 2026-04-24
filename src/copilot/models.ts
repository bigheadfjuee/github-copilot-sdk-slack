/**
 * GitHub Copilot SDK 模型別名對照表與使用者偏好儲存
 */

/** 使用者可用的模型別名 → Copilot SDK 完整模型 ID */
export const MODEL_ALIASES: Record<string, string> = {
  sonnet: 'claude-sonnet-4.6',
  haiku: 'claude-haiku-4.5',
  opus: 'claude-opus-4.6',
  'gpt-5': 'gpt-5.4',
};

/**
 * 將使用者輸入的別名解析為完整模型 ID（不區分大小寫）
 * @returns 完整模型 ID，若別名不存在則回傳 undefined
 */
export function resolveModel(alias: string): string | undefined {
  return MODEL_ALIASES[alias.toLowerCase()];
}

/**
 * 記憶每位 Slack 使用者所選定的模型 ID（記憶體儲存，重啟後清除）
 */
export class ModelPreferenceStore {
  private readonly store = new Map<string, string>();

  /** 儲存使用者的模型偏好 */
  set(userId: string, modelId: string): void {
    this.store.set(userId, modelId);
  }

  /** 取得使用者的模型偏好；若未設定則回傳 undefined */
  get(userId: string): string | undefined {
    return this.store.get(userId);
  }

  /** 清除使用者的模型偏好 */
  clear(userId: string): void {
    this.store.delete(userId);
  }
}
