import { createOpencodeClient } from '@opencode-ai/sdk/client';
import type { OpencodeClient } from '@opencode-ai/sdk/client';
import { createLogger } from '../logger.js';

const logger = createLogger('OpencodeBridge');

/**
 * 管理 Slack 使用者與 opencode session ID 的對應，
 * 並提供訊息橋接（sendPrompt）方法
 */
export class OpencodeBridge {
  private readonly client: OpencodeClient;
  private readonly sessions = new Map<string, string>(); // userId → opencode sessionId

  constructor(baseUrl: string, serverPassword?: string) {
    // 若有密碼，注入 Basic Auth fetch wrapper
    const customFetch = serverPassword
      ? (request: Request): ReturnType<typeof fetch> => {
          const credentials = Buffer.from(`opencode:${serverPassword}`).toString('base64');
          const headers = new Headers(request.headers);
          headers.set('Authorization', `Basic ${credentials}`);
          return fetch(new Request(request, { headers }));
        }
      : undefined;

    this.client = createOpencodeClient({
      baseUrl,
      ...(customFetch ? { fetch: customFetch } : {}),
    });

    logger.info({ baseUrl }, 'OpencodeBridge initialized (createOpencodeClient client-only mode)');
  }

  /** 儲存使用者的 opencode session ID */
  setSession(userId: string, sessionId: string): void {
    this.sessions.set(userId, sessionId);
  }

  /** 取得使用者的 opencode session ID；若不存在回傳 undefined */
  getSessionId(userId: string): string | undefined {
    return this.sessions.get(userId);
  }

  /** 回傳使用者是否有已綁定的 opencode session */
  hasSession(userId: string): boolean {
    return this.sessions.has(userId);
  }

  /** 清除使用者的 opencode session 綁定 */
  clearSession(userId: string): void {
    this.sessions.delete(userId);
  }

  /**
   * 傳送提示至使用者的 opencode session。
   * 若使用者尚無 session，自動建立後再傳送。
   * 失敗時清除 session 並 re-throw。
   */
  async sendPrompt(userId: string, prompt: string): Promise<string> {
    try {
      // 若無 session，先建立
      if (!this.hasSession(userId)) {
        const createResult = await this.client.session.create({ body: {} });
        if (createResult.error) {
          throw new Error(`Failed to create opencode session: ${JSON.stringify(createResult.error)}`);
        }
        const sessionId = createResult.data?.id;
        if (!sessionId) {
          throw new Error('opencode session.create returned no session ID');
        }
        this.setSession(userId, sessionId);
        logger.info({ userId, sessionId }, 'Created new opencode session');
      }

      const sessionId = this.getSessionId(userId)!;

      const promptResult = await this.client.session.prompt({
        path: { id: sessionId },
        body: {
          parts: [{ type: 'text', text: prompt }],
        },
      });

      if (promptResult.error) {
        throw new Error(`opencode session.prompt error: ${JSON.stringify(promptResult.error)}`);
      }

      // 串接所有 text-type parts 作為回應
      const parts = promptResult.data?.parts ?? [];
      const text = parts
        .filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
        .map((p) => p.text)
        .join('');

      return text || '(no response)';
    } catch (error) {
      logger.error({ error, userId }, 'opencode sendPrompt failed — clearing session');
      this.clearSession(userId);
      throw error;
    }
  }
}
