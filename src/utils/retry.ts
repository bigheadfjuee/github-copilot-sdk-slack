/**
 * 重試機制 - 支援指數退避和可配置的重試策略
 */

export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  isRetryableError?: (error: unknown) => boolean;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
};

/**
 * 判斷錯誤是否可重試
 * - 網絡錯誤：retryable
 * - 超時錯誤：retryable
 * - 權限錯誤：不可重試
 * - Session 斷開：可重試（會嘗試重建）
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const { message, name } = error;
    // 不可重試的錯誤
    if (
      name.includes('Permission') ||
      name.includes('Unauthorized') ||
      name.includes('Authentication') ||
      message.includes('permission') ||
      message.includes('unauthorized')
    ) {
      return false;
    }

    // 可重試的錯誤
    if (
      name.includes('Network') ||
      name.includes('Timeout') ||
      name.includes('ECONNREFUSED') ||
      name.includes('ECONNRESET') ||
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('ECONNREFUSED') ||
      message.includes('ECONNRESET')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * 非同步函式的重試包裝器，帶指數退避
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  userOptions?: Partial<RetryOptions>
): Promise<T> {
  const options = { ...DEFAULT_RETRY_OPTIONS, ...userOptions };
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // 如果這是最後一次嘗試，直接拋出錯誤
      if (attempt === options.maxAttempts) {
        throw error;
      }

      // 檢查錯誤是否可重試
      const isRetryable = options.isRetryableError
        ? options.isRetryableError(error)
        : isRetryableError(error);

      if (!isRetryable) {
        throw error;
      }

      // 計算延遲時間（指數退避）
      const delayMs = Math.min(
        options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt - 1),
        options.maxDelayMs
      );

      // 等待後重試
      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * 輔助函式：睡眠指定毫秒數
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 斷路器（Circuit Breaker）實現 - 防止級聯故障
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private failureThreshold: number = 5,
    private resetTimeoutMs: number = 60000 // 1 分鐘後自動嘗試恢復
  ) {}

  /**
   * 執行函式，若斷路器打開則拋出錯誤
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const timeSinceLastFailure = Date.now() - (this.lastFailureTime ?? 0);
      if (timeSinceLastFailure >= this.resetTimeoutMs) {
        // 嘗試半開狀態（測試是否恢復）
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open - service temporarily unavailable');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  getState(): string {
    return this.state;
  }

  reset(): void {
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'closed';
  }
}
