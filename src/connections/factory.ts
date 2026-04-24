/**
 * Connection factory to create the appropriate connection adapter
 */

import { BotConfig } from '../config';
import { SlackConnection, ConnectionEvents } from './types';
import { SocketModeConnection } from './socket-mode';
import { HttpConnection } from './http';
import { createProxyAgent } from '../proxy';
import { createLogger } from '../logger';

const logger = createLogger('ConnectionFactory');

/**
 * Create a Slack connection adapter based on configuration
 */
export const createConnection = (
  config: BotConfig,
  events?: ConnectionEvents
): SlackConnection => {
  logger.info({ mode: config.mode }, 'Creating connection');

  if (config.mode === 'socket') {
    // Unified proxy agent (HttpsProxyAgent) injected into SocketModeConnection
    const agent = createProxyAgent(config.proxy);
    if (agent) {
      logger.info({ proxy: config.proxy?.url }, 'Using proxy agent for Socket Mode connection');
    }
    return new SocketModeConnection(config, events, agent);
  } else if (config.mode === 'http') {
    return new HttpConnection(config, events);
  }

  throw new Error(`Unknown connection mode: ${config.mode}`);
};

export { SlackConnection, ConnectionEvents } from './types';
export { SocketModeConnection } from './socket-mode';
export { HttpConnection } from './http';
