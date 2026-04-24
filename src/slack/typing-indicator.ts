import { WebClient } from '@slack/web-api';
import { createLogger } from '../logger.js';

const logger = createLogger('TypingIndicator');

/**
 * 使用 setInterval 持續呼叫 assistant_threads_setStatus，
 * 讓 Slack 在 bot 處理期間顯示「正在輸入」狀態。
 * 所有 API 錯誤只記錄 warning，不中斷主流程。
 */
export class TypingIndicator {
  private readonly webClient: WebClient;
  private readonly channel: string;
  private readonly threadTs: string;
  private readonly intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(webClient: WebClient, channel: string, threadTs: string, intervalMs: number = 2000) {
    this.webClient = webClient;
    this.channel = channel;
    this.threadTs = threadTs;
    this.intervalMs = intervalMs;
  }

  /**
   * 立即設定 "is thinking..." 狀態，並以 setInterval 定期刷新。
   */
  start(): void {
    this.setStatus('is thinking...');
    this.timer = setInterval(() => {
      this.setStatus('is thinking...');
    }, this.intervalMs);
  }

  /**
   * 清除 interval 並將狀態設為空字串（清除顯示）。
   */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.setStatus('');
  }

  private setStatus(status: string): void {
    this.webClient.apiCall('assistant.threads.setStatus', {
      channel_id: this.channel,
      thread_ts: this.threadTs,
      status,
    }).catch((error: unknown) => {
      logger.warn({ error, channel: this.channel }, 'Failed to set assistant thread status');
    });
  }
}
