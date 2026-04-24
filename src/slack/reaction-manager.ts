import { WebClient } from '@slack/web-api';
import { createLogger } from '../logger.js';

const logger = createLogger('ReactionManager');

/**
 * 管理用戶原始訊息上的 reaction emoji，反映 Copilot 處理狀態：
 * - 處理中：:eyes:
 * - 成功：移除 :eyes:，加上 :white_check_mark:
 * - 失敗：移除 :eyes:，加上 :x:
 *
 * already_reacted 錯誤靜默忽略；其他 API 錯誤只記錄 warning，不中斷主流程。
 */
export class ReactionManager {
  private readonly webClient: WebClient;
  private readonly channel: string;
  private readonly ts: string;

  constructor(webClient: WebClient, channel: string, ts: string) {
    this.webClient = webClient;
    this.channel = channel;
    this.ts = ts;
  }

  /** 加上 :eyes: reaction，表示正在處理 */
  async markProcessing(): Promise<void> {
    await this.addReaction('eyes');
  }

  /** 移除 :eyes:，加上 :white_check_mark: */
  async markSuccess(): Promise<void> {
    await this.removeReaction('eyes');
    await this.addReaction('white_check_mark');
  }

  /** 移除 :eyes:，加上 :x: */
  async markFailure(): Promise<void> {
    await this.removeReaction('eyes');
    await this.addReaction('x');
  }

  private async addReaction(name: string): Promise<void> {
    try {
      await this.webClient.reactions.add({ channel: this.channel, timestamp: this.ts, name });
    } catch (error: any) {
      if (error?.data?.error === 'already_reacted') return;
      logger.warn({ error, reaction: name }, 'Failed to add reaction');
    }
  }

  private async removeReaction(name: string): Promise<void> {
    try {
      await this.webClient.reactions.remove({ channel: this.channel, timestamp: this.ts, name });
    } catch (error: any) {
      // no_reaction 表示 reaction 不存在，忽略即可
      if (error?.data?.error === 'no_reaction') return;
      logger.warn({ error, reaction: name }, 'Failed to remove reaction');
    }
  }
}
