import 'dotenv/config';
import { loadConfig } from './config';
import { createLogger } from './logger';
import { createConnection } from './connections/factory';
import { SocketModeConnection } from './connections/socket-mode';
import { registerHandlers } from './handlers';
import { copilotManager } from './copilot/client';
import { createSessionManager } from './copilot/session-manager';
import { ModelPreferenceStore } from './copilot/models';

const appLogger = createLogger('App');

/**
 * Main application entry point
 */
async function main() {
  try {
    // Load configuration
    const config = loadConfig();
    appLogger.info({ mode: config.mode }, 'Configuration loaded');

    // 啟動 CopilotClient（有 GITHUB_TOKEN 時）
    if (config.githubToken) {
      await copilotManager.start(config.githubToken);
    } else {
      appLogger.warn('GITHUB_TOKEN not set — running in echo mode');
    }

    // 建立 ModelPreferenceStore（全域共用）
    const modelPreferenceStore = new ModelPreferenceStore();

    // 建立 SessionManager（僅在 CopilotClient 成功啟動時）
    const copilotClient = copilotManager.getClient();
    const sessionManager = copilotClient
      ? createSessionManager(copilotClient, config.sessionIdleMs, modelPreferenceStore)
      : null;

    // Create connection based on mode
    const connection = createConnection(config, {
      onStart: async () => {
        appLogger.info('Connection established successfully');
      },
      onStop: async () => {
        appLogger.info('Connection closed');
      },
      onError: async (error) => {
        appLogger.error({ error }, 'Connection error occurred');
      },
    });

    // Socket Mode: get SocketModeClient and WebClient and register handlers
    if (connection instanceof SocketModeConnection) {
      const socketClient = connection.getSocketClient();
      const webClient = connection.getApp(); // 回傳 WebClient
      registerHandlers(socketClient, webClient, sessionManager, config.copilotTimeoutMs, config.copilotTypingIntervalMs, modelPreferenceStore);
    }

    // Setup graceful shutdown
    setupShutdownHandlers(connection);

    // Start the connection
    await connection.start();

    appLogger.info(
      { mode: config.mode, port: config.httpPort },
      'Bot is ready and listening for events'
    );
  } catch (error) {
    appLogger.error({ error }, 'Fatal error during startup');
    process.exit(1);
  }
}

/**
 * Setup graceful shutdown handlers
 */
function setupShutdownHandlers(connection: any): void {
  const shutdownHandler = async (signal: string) => {
    appLogger.info({ signal }, 'Shutdown signal received');

    try {
      await copilotManager.stop();
      await connection.stop();
      appLogger.info('Connection closed successfully');
      process.exit(0);
    } catch (error) {
      appLogger.error({ error }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
  process.on('SIGINT', () => shutdownHandler('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    appLogger.error({ error }, 'Uncaught exception');
    process.exit(1);
  });

  // Handle unhandled rejections
  process.on('unhandledRejection', (reason, promise) => {
    appLogger.error({ reason, promise }, 'Unhandled promise rejection');
    process.exit(1);
  });
}

// Run the application
main();
