import { WebClient } from '@slack/web-api';
import { SocketModeClient } from '@slack/socket-mode';
import { createLogger } from './logger.js';
import { SessionManager } from './copilot/session-manager.js';
import { TypingIndicator } from './slack/typing-indicator.js';
import { ReactionManager } from './slack/reaction-manager.js';
import { ModelPreferenceStore, MODEL_ALIASES, resolveModel } from './copilot/models.js';
import { OpencodeBridge } from './opencode/bridge.js';

const logger = createLogger('BotHandlers');

const DEFAULT_COPILOT_TIMEOUT_MS = 180_000;

/**
 * Registers message event handlers.
 * Uses SocketModeClient.on('message', ...) instead of Bolt app.message(...)
 * message event handler registration
 */
export const registerMessageHandlers = (
  socketClient: SocketModeClient,
  webClient: WebClient,
  sessionManager: SessionManager | null = null,
  copilotTimeoutMs: number = DEFAULT_COPILOT_TIMEOUT_MS,
  copilotTypingIntervalMs: number = 2000,
  opencodeBridge?: OpencodeBridge,
): void => {
  socketClient.on('message', async ({ event, ack }: any) => {
    try {
      await ack();

      // 忽略 bot 訊息
      if (event.bot_id) return;

      // 忽略空白訊息
      if (!event.text || !event.text.trim()) return;

      logger.info({ userId: event.user, channel: event.channel }, 'Received message');

      // opencode 路由優先：若使用者有綁定的 opencode session，轉發至 opencode
      if (opencodeBridge?.hasSession(event.user)) {
        const threadTs = event.thread_ts || event.ts;
        try {
          const response = await opencodeBridge.sendPrompt(event.user, event.text);
          await webClient.chat.postMessage({
            channel: event.channel,
            text: response,
            thread_ts: threadTs,
          });
        } catch (error) {
          logger.error({ error, userId: event.user }, 'opencode sendPrompt failed');
          await webClient.chat.postMessage({
            channel: event.channel,
            text: 'An error occurred while communicating with opencode. Your session has been reset.',
            thread_ts: threadTs,
          });
        }
        return;
      }

      if (sessionManager) {
        // Copilot 模式：取得 session 並轉發訊息
        let session;
        try {
          session = await sessionManager.getOrCreate(event.user);
        } catch (error) {
          logger.error({ error, userId: event.user }, 'Failed to get Copilot session');
          await webClient.chat.postMessage({
            channel: event.channel,
            text: 'Failed to connect to Copilot. Please try again.',
            thread_ts: event.thread_ts || event.ts,
          });
          return;
        }

        // 建立 waiting 動畫元件
        const threadTs = event.thread_ts || event.ts;
        const indicator = new TypingIndicator(webClient, event.channel, threadTs, copilotTypingIntervalMs);
        const reactions = new ReactionManager(webClient, event.channel, event.ts);

        // 啟動等待動畫
        await reactions.markProcessing();
        indicator.start();

        // Create Copilot response timeout (controlled by configuration)
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), copilotTimeoutMs),
        );

        try {
          const reply = await Promise.race([
            session.sendAndWait({ prompt: event.text }),
            timeoutPromise,
          ]);

          // 停止動畫，標記成功
          indicator.stop();
          await reactions.markSuccess();

          const content = reply?.data?.content ?? '(no response)';
          await webClient.chat.postMessage({
            channel: event.channel,
            text: content,
            thread_ts: event.thread_ts || event.ts,
          });

          sessionManager.scheduleIdle(event.user);
        } catch (error: any) {
          // 停止動畫，標記失敗
          indicator.stop();
          await reactions.markFailure();

          if (error?.message === 'timeout') {
            logger.warn({ userId: event.user }, 'Copilot sendAndWait timed out');
            await webClient.chat.postMessage({
              channel: event.channel,
              text: 'Copilot did not respond in time. Please try again.',
              thread_ts: event.thread_ts || event.ts,
            });
            await sessionManager.resetSession(event.user);
          } else {
            logger.error({ error, userId: event.user }, 'Error forwarding message to Copilot');
            await webClient.chat.postMessage({
              channel: event.channel,
              text: 'An error occurred while processing your message.',
              thread_ts: event.thread_ts || event.ts,
            });
          }
        }
      } else {
        // Echo fallback（無 sessionManager 時使用）
        await webClient.chat.postMessage({
          channel: event.channel,
          text: `Echo: ${event.text}`,
          thread_ts: event.thread_ts || event.ts,
        });
      }
    } catch (error) {
      logger.error({ error }, 'Error handling message');
    }
  });
};

/**
 * Registers slash command handlers.
 * Note: SocketModeClient 2.x uses 'slash_commands' event.
 */
export const registerCommandHandlers = (
  socketClient: SocketModeClient,
  _webClient: WebClient,
  modelPreferenceStore?: ModelPreferenceStore,
  opencodeBridge?: OpencodeBridge,
): void => {
  socketClient.on('slash_commands', async ({ ack, body }: any) => {
    try {
      if (body.command === '/oc') {
        const prompt = (body.text ?? '').trim();

        // 空白引數
        if (!prompt) {
          await ack({ text: '請輸入要傳送給 opencode 的訊息。用法：`/oc <message>`' });
          return;
        }

        if (!opencodeBridge) {
          await ack({ text: 'opencode 整合未啟用。請設定 OPENCODE_BASE_URL 環境變數。' });
          return;
        }

        try {
          const response = await opencodeBridge.sendPrompt(body.user_id, prompt);
          await ack({ text: response });
        } catch (error) {
          logger.error({ error, userId: body.user_id }, '/oc sendPrompt failed');
          await ack({ text: `無法連線至 opencode 伺服器。請確認伺服器已啟動（\`opencode serve\`）。` });
        }
        return;
      }

      if (body.command === '/model') {
        const rawText: string = (body.text ?? '').trim();

        // 空白引數
        if (!rawText) {
          await ack({
            text: `請指定模型別名。支援的別名：\`${Object.keys(MODEL_ALIASES).join('`, `')}\`\n用法：\`/model <alias>\``,
          });
          return;
        }

        const alias = rawText.split(/\s+/)[0];
        const resolvedModelId = resolveModel(alias);

        if (resolvedModelId === undefined) {
          // 不認識的別名
          await ack({
            text: `未知的模型別名：\`${alias}\`。支援的別名：\`${Object.keys(MODEL_ALIASES).join('`, `')}\``,
          });
          return;
        }

        // 儲存使用者偏好
        modelPreferenceStore?.set(body.user_id, resolvedModelId);

        await ack({
          text: `已設定模型為 \`${resolvedModelId}\`（別名：\`${alias}\`）。下次對話將使用此模型。`,
        });

        logger.info({ userId: body.user_id, alias, resolvedModelId }, 'Model preference updated');
        return;
      }

      // 其他斜線命令預設回應
      await ack({ text: `You said: ${body.text}` });
      logger.info({ command: body.command }, 'Received slash command');
    } catch (error) {
      logger.error({ error }, 'Error handling slash command');
    }
  });
};

/**
 * Registers app_mention event handlers.
 */
export const registerEventHandlers = (socketClient: SocketModeClient, webClient: WebClient): void => {
  socketClient.on('app_mention', async ({ event, ack }: any) => {
    try {
      await ack();

      logger.info({ userId: event.user }, 'Bot mentioned');

      await webClient.chat.postMessage({
        channel: event.channel,
        text: `Hi <@${event.user}>! I'm alive and running in ${process.env.CONNECTION_MODE || 'socket'} mode.`,
        thread_ts: event.thread_ts || event.ts,
      });
    } catch (error) {
      logger.error({ error }, 'Error handling app_mention');
    }
  });
};

/**
 * Registers all bot handlers.
 */
export const registerHandlers = (
  socketClient: SocketModeClient,
  webClient: WebClient,
  sessionManager: SessionManager | null = null,
  copilotTimeoutMs: number = DEFAULT_COPILOT_TIMEOUT_MS,
  copilotTypingIntervalMs: number = 2000,
  modelPreferenceStore?: ModelPreferenceStore,
  opencodeBridge?: OpencodeBridge,
): void => {
  registerMessageHandlers(socketClient, webClient, sessionManager, copilotTimeoutMs, copilotTypingIntervalMs, opencodeBridge);
  registerCommandHandlers(socketClient, webClient, modelPreferenceStore, opencodeBridge);
  registerEventHandlers(socketClient, webClient);

  logger.info('All handlers registered');
};
