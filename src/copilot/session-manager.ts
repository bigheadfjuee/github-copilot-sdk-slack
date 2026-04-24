import { CopilotClient, CopilotSession, approveAll } from '@github/copilot-sdk';
import { createLogger } from '../logger';

const logger = createLogger('SessionManager');

interface SessionEntry {
  session: CopilotSession;
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * 管理每位 Slack 使用者對應的 CopilotSession，並負責閒置逾時清理
 */
export class SessionManager {
  private sessions = new Map<string, SessionEntry>();

  constructor(
    private readonly client: CopilotClient,
    private readonly idleTimeoutMs: number,
  ) {}

  /**
   * 取得或建立指定使用者的 CopilotSession
   */
  async getOrCreate(userId: string): Promise<CopilotSession> {
    const existing = this.sessions.get(userId);
    if (existing) {
      logger.debug({ userId }, 'Reusing existing Copilot session');
      return existing.session;
    }

    logger.info({ userId }, 'Creating new Copilot session');
    const session = await this.client.createSession({ onPermissionRequest: approveAll });
    this.sessions.set(userId, { session, timer: null });
    return session;
  }

  /**
   * 重置使用者的 session（中斷連線並從 Map 移除）
   */
  async resetSession(userId: string): Promise<void> {
    const entry = this.sessions.get(userId);
    if (!entry) return;

    if (entry.timer !== null) {
      clearTimeout(entry.timer);
    }

    try {
      await entry.session.disconnect();
    } catch (error) {
      logger.warn({ error, userId }, 'Error disconnecting Copilot session');
    }

    this.sessions.delete(userId);
    logger.info({ userId }, 'Copilot session reset');
  }

  /**
   * 重新排程閒置逾時計時器（每次回覆後由外部呼叫）
   */
  scheduleIdle(userId: string): void {
    const entry = this.sessions.get(userId);
    if (!entry) return;

    if (entry.timer !== null) {
      clearTimeout(entry.timer);
    }

    entry.timer = setTimeout(() => {
      logger.info({ userId }, 'Copilot session idle timeout — resetting');
      this.resetSession(userId).catch((error) => {
        logger.warn({ error, userId }, 'Error during idle session reset');
      });
    }, this.idleTimeoutMs);
  }
}

/**
 * 建立 SessionManager 的工廠函式
 */
export function createSessionManager(client: CopilotClient, idleTimeoutMs: number): SessionManager {
  return new SessionManager(client, idleTimeoutMs);
}
