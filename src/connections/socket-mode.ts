import { SocketModeClient } from '@slack/socket-mode';
import { WebClient } from '@slack/web-api';
import type { HttpsProxyAgent } from 'https-proxy-agent';

// Use any to avoid v5/v9 generic type differences
type ProxyAgent = HttpsProxyAgent | undefined;
import { createLogger } from '../logger';
import { BotConfig } from '../config';
import { SlackConnection, ConnectionEvents } from './types';

const logger = createLogger('SocketModeConnection');

/**
 * Socket Mode connection adapter
 * Uses SocketModeClient directly instead of Bolt App, with HttpsProxyAgent support.
 */
export class SocketModeConnection implements SlackConnection {
  private socketClient: SocketModeClient;
  private webClient: WebClient;
  private isRunning: boolean = false;
  private events: ConnectionEvents;

  constructor(
    config: BotConfig,
    events: ConnectionEvents = {},
    agent?: ProxyAgent
  ) {
    this.events = events;

    if (!config.appToken) {
      throw new Error('appToken is required for Socket Mode');
    }

    // SocketModeClient initialization with proxy agent
    this.socketClient = new SocketModeClient({
      appToken: config.appToken,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      clientOptions: { agent: agent as any },
    });

    // WebClient 獨立初始化，與 SocketModeClient 共用相同的 agent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.webClient = new WebClient(config.botToken, { agent: agent as any });

    this.setupErrorHandling();
    this.setupLifecycleLogging();
  }

  /**
   * Registers the error event and invokes onError callback.
   */
  private setupErrorHandling(): void {
    this.socketClient.on('error', async (error) => {
      logger.error({ error }, 'SocketModeClient error');
      if (this.events.onError) {
        await this.events.onError(error as Error);
      }
    });
  }

  /**
   * Registers connection lifecycle event listeners for logging.
   * connection lifecycle event logging
   */
  private setupLifecycleLogging(): void {
    this.socketClient.on('connecting', () => logger.info('Socket Mode connecting...'));
    this.socketClient.on('connected', () => logger.info('Socket Mode connected'));
    this.socketClient.on('disconnecting', () => logger.warn('Socket Mode disconnecting...'));
    this.socketClient.on('disconnected', () => logger.warn('Socket Mode disconnected'));
    this.socketClient.on('reconnecting', () => logger.info('Socket Mode reconnecting...'));
  }

  /**
   * Starts the Socket Mode connection.
   * start() initiates SocketModeClient connection (SlackConnection interface compliance)
   */
  async start(): Promise<void> {
    try {
      logger.info('Starting Socket Mode connection');
      await this.socketClient.start();
      this.isRunning = true;
      logger.info('Socket Mode connection established');

      if (this.events.onStart) {
        await this.events.onStart();
      }
    } catch (error) {
      logger.error({ error }, 'Failed to start Socket Mode connection');
      throw error;
    }
  }

  /**
   * Stops the Socket Mode connection gracefully.
   * stop() disconnects SocketModeClient (SlackConnection interface compliance)
   */
  async stop(): Promise<void> {
    try {
      logger.info('Stopping Socket Mode connection');
      await this.socketClient.disconnect();
      this.isRunning = false;
      logger.info('Socket Mode connection stopped');

      if (this.events.onStop) {
        await this.events.onStop();
      }
    } catch (error) {
      logger.error({ error }, 'Error stopping Socket Mode connection');
      throw error;
    }
  }

  /**
   * Returns the WebClient instance for handlers to call Slack APIs.
   * getApp() returns WebClient (SlackConnection interface compliance)
   */
  getApp(): any {
    return this.webClient;
  }

  /**
   * Returns the underlying SocketModeClient for handlers to attach events.
   */
  getSocketClient(): SocketModeClient {
    return this.socketClient;
  }

  /**
   * Returns whether the connection is active.
   * isActive() reflects connection state (SlackConnection interface compliance)
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Registers a message event handler on the SocketModeClient.
   * message event handler registration (SocketModeClient event-based handler registration)
   */
  onMessage(handler: (payload: any) => Promise<void>): void {
    this.socketClient.on('message', handler);
  }
}
