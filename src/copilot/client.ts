import { CopilotClient } from '@github/copilot-sdk';
import { createLogger } from '../logger';

const logger = createLogger('CopilotClientManager');

/**
 * 管理單一 CopilotClient 實例的生命週期（啟動、停止、存取）
 */
export class CopilotClientManager {
  private client: CopilotClient | null = null;

  /**
   * 建立並啟動 CopilotClient；失敗時記錄警告並保持 null（echo fallback）
   */
  async start(githubToken: string): Promise<void> {
    const instance = new CopilotClient({ githubToken });
    try {
      await instance.start();
      this.client = instance;
      logger.info('CopilotClient started successfully');
    } catch (error) {
      logger.warn({ error }, 'CopilotClient.start() failed — running in echo mode');
      this.client = null;
    }
  }

  /**
   * 停止 CopilotClient 並釋放資源
   */
  async stop(): Promise<void> {
    if (this.client) {
      await this.client.stop();
      this.client = null;
      logger.info('CopilotClient stopped');
    }
  }

  /**
   * 取得目前的 CopilotClient 實例（未啟動或啟動失敗時回傳 null）
   */
  getClient(): CopilotClient | null {
    return this.client;
  }
}

/** 模組層級單例，整個 bot process 共用 */
export const copilotManager = new CopilotClientManager();
