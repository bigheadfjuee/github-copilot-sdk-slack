import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { ProxyConfig } from './config.js';
import { createLogger } from './logger.js';

const logger = createLogger('ProxyManager');

/**
 * Creates a single HttpsProxyAgent for Socket Mode and Web API use.
 * Unified proxy agent using HttpsProxyAgent.
 */
export const createProxyAgent = (proxyConfig?: ProxyConfig): HttpsProxyAgent | undefined => {
  if (!proxyConfig?.url) {
    return undefined;
  }

  try {
    const proxyUrl = new URL(proxyConfig.url);

    if (proxyConfig.username && proxyConfig.password) {
      proxyUrl.username = proxyConfig.username;
      proxyUrl.password = proxyConfig.password;
    }

    const proxyUrlString = proxyUrl.toString();
    logger.info({ proxy: proxyConfig.url }, 'Creating HttpsProxyAgent');
    return new HttpsProxyAgent(proxyUrlString);
  } catch (error) {
    logger.error({ error }, 'Failed to create proxy agent');
    throw new Error(`Invalid proxy configuration: ${error}`);
  }
};

/**
 * Creates HTTP/HTTPS proxy agents for HTTP mode (backward compatible).
 */
export const createProxyAgents = (proxyConfig?: ProxyConfig) => {
  if (!proxyConfig?.url) {
    logger.debug('No proxy configured');
    return {};
  }

  try {
    logger.info({ proxy: proxyConfig.url }, 'Creating proxy agents');

    const proxyUrl = new URL(proxyConfig.url);

    if (proxyConfig.username && proxyConfig.password) {
      proxyUrl.username = proxyConfig.username;
      proxyUrl.password = proxyConfig.password;
    }

    const proxyUrlString = proxyUrl.toString();

    return {
      httpAgent: new HttpProxyAgent(proxyUrlString),
      httpsAgent: new HttpsProxyAgent(proxyUrlString),
    };
  } catch (error) {
    logger.error({ error }, 'Failed to create proxy agents');
    throw new Error(`Invalid proxy configuration: ${error}`);
  }
};
