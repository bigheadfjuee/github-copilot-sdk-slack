/**
 * Configuration interface for HTTP Proxy support
 */
export interface ProxyConfig {
  url?: string;
  username?: string;
  password?: string;
}

/**
 * Configuration interface for the Slack Bot
 */
export interface BotConfig {
  botToken: string;
  appToken?: string;
  signingSecret?: string;
  mode: 'socket' | 'http';
  httpPort: number;
  httpPath: string;
  proxy?: ProxyConfig;
  logLevel: string;
  nodeEnv: string;
  githubToken?: string;
  sessionIdleMs: number;
  copilotTimeoutMs: number;
  copilotTypingIntervalMs: number;
}

/**
 * Parse and validate environment variables
 */
export const loadConfig = (): BotConfig => {
  const mode = (process.env.CONNECTION_MODE || 'socket') as 'socket' | 'http';

  // Validate required fields
  if (!process.env.SLACK_BOT_TOKEN) {
    throw new Error('SLACK_BOT_TOKEN environment variable is required');
  }

  if (mode === 'socket' && !process.env.SLACK_APP_TOKEN) {
    throw new Error('SLACK_APP_TOKEN is required for socket mode');
  }

  if (mode === 'http' && !process.env.SLACK_SIGNING_SECRET) {
    throw new Error('SLACK_SIGNING_SECRET is required for HTTP mode');
  }

  const proxy: ProxyConfig = {};
  if (process.env.HTTP_PROXY_URL) {
    proxy.url = process.env.HTTP_PROXY_URL;
    proxy.username = process.env.HTTP_PROXY_USERNAME;
    proxy.password = process.env.HTTP_PROXY_PASSWORD;
  }

  return {
    botToken: process.env.SLACK_BOT_TOKEN,
    appToken: process.env.SLACK_APP_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    mode,
    httpPort: parseInt(process.env.HTTP_PORT || '3000', 10),
    httpPath: process.env.HTTP_PATH || '/slack/events',
    proxy: Object.keys(proxy).length > 0 ? proxy : undefined,
    logLevel: process.env.LOG_LEVEL || 'debug',
    nodeEnv: process.env.NODE_ENV || 'development',
    githubToken: process.env.GITHUB_TOKEN,
    sessionIdleMs: parseInt(process.env.COPILOT_SESSION_IDLE_MS || '1800000', 10),
    copilotTimeoutMs: parseInt(process.env.COPILOT_TIMEOUT_MS || '180000', 10),
    copilotTypingIntervalMs: parseInt(process.env.COPILOT_TYPING_INTERVAL_MS || '2000', 10),
  };
};
