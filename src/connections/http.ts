import { App, ExpressReceiver } from '@slack/bolt';
import express, { Express } from 'express';
import { createLogger } from '../logger.js';
import { BotConfig } from '../config.js';
import { SlackConnection, ConnectionEvents } from './types.js';
import { createProxyAgents } from '../proxy.js';

const logger = createLogger('HttpConnection');

/**
 * HTTP connection adapter with optional proxy support
 * Uses HTTP webhooks for event delivery from Slack
 */
export class HttpConnection implements SlackConnection {
  private app: App;
  private expressApp: Express;
  private receiver: ExpressReceiver;
  private server: any = null;
  private isRunning: boolean = false;
  private config: BotConfig;
  private events: ConnectionEvents;

  constructor(config: BotConfig, events: ConnectionEvents = {}) {
    this.config = config;
    this.events = events;

    if (!config.signingSecret) {
      throw new Error('signingSecret is required for HTTP mode');
    }

    // Create Express app
    this.expressApp = express();

    // Create proxy agents if configured
    const proxyAgents = createProxyAgents(config.proxy);

    // Create Express receiver with optional proxy agents
    this.receiver = new ExpressReceiver({
      signingSecret: config.signingSecret,
      app: this.expressApp,
      // Apply proxy agents to the receiver's HTTP client
      customPropertiesExtractor: undefined,
    });

    // Initialize Slack Bolt app
    this.app = new App({
      token: config.botToken,
      signingSecret: config.signingSecret,
      receiver: this.receiver,
      clientOptions: {
        agent: proxyAgents.httpAgent,
        // Also support HTTPS if needed
      },
    });

    // Setup health check endpoint
    this.expressApp.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        mode: 'http',
        uptime: process.uptime(),
      });
    });

    this.setupErrorHandling();
  }

  /**
   * Setup error handling for the HTTP connection
   */
  private setupErrorHandling(): void {
    this.app.error(async (error) => {
      logger.error({ error }, 'Slack app error');
      if (this.events.onError) {
        await this.events.onError(error as Error);
      }
    });

    // Express error handler
    this.expressApp.use(
      (
        error: any,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
      ) => {
        logger.error({ error }, 'Express middleware error');
        res.status(500).json({ error: 'Internal server error' });
      }
    );
  }

  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    try {
      logger.info({ port: this.config.httpPort }, 'Starting HTTP server');

      // Initialize the app (this will handle event subscriptions)
      await this.app.init?.();

      this.server = this.expressApp.listen(this.config.httpPort, () => {
        this.isRunning = true;
        logger.info(
          { port: this.config.httpPort, path: this.config.httpPath },
          'HTTP server started and listening'
        );

        if (this.events.onStart) {
          this.events.onStart().catch((err) => {
            logger.error({ error: err }, 'Error in onStart handler');
          });
        }
      });
    } catch (error) {
      logger.error({ error }, 'Failed to start HTTP server');
      throw error;
    }
  }

  /**
   * Stop the HTTP server gracefully
   */
  async stop(): Promise<void> {
    try {
      logger.info('Stopping HTTP server');

      if (this.server) {
        await new Promise<void>((resolve, reject) => {
          this.server.close((error?: Error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });

        this.isRunning = false;
        logger.info('HTTP server stopped');
      }

      if (this.events.onStop) {
        await this.events.onStop();
      }
    } catch (error) {
      logger.error({ error }, 'Error stopping HTTP server');
      throw error;
    }
  }

  /**
   * Get the underlying Bolt app instance
   */
  getApp(): App {
    return this.app;
  }

  /**
   * Get the Express app instance
   */
  getExpressApp(): Express {
    return this.expressApp;
  }

  /**
   * Check if connection is active
   */
  isActive(): boolean {
    return this.isRunning;
  }
}
