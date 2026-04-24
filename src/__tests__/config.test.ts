import { loadConfig, BotConfig } from '../config.js';

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should load socket mode configuration', () => {
    process.env.CONNECTION_MODE = 'socket';
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
    process.env.SLACK_APP_TOKEN = 'xapp-test-token';

    const config = loadConfig();

    expect(config.mode).toBe('socket');
    expect(config.botToken).toBe('xoxb-test-token');
    expect(config.appToken).toBe('xapp-test-token');
  });

  it('should load http mode configuration', () => {
    process.env.CONNECTION_MODE = 'http';
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
    process.env.SLACK_SIGNING_SECRET = 'test-secret';
    process.env.HTTP_PORT = '3000';

    const config = loadConfig();

    expect(config.mode).toBe('http');
    expect(config.botToken).toBe('xoxb-test-token');
    expect(config.signingSecret).toBe('test-secret');
    expect(config.httpPort).toBe(3000);
  });

  it('should throw error if SLACK_BOT_TOKEN is missing', () => {
    delete process.env.SLACK_BOT_TOKEN;

    expect(() => loadConfig()).toThrow('SLACK_BOT_TOKEN environment variable is required');
  });

  it('should throw error if appToken is missing in socket mode', () => {
    process.env.CONNECTION_MODE = 'socket';
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
    delete process.env.SLACK_APP_TOKEN;

    expect(() => loadConfig()).toThrow('SLACK_APP_TOKEN is required for socket mode');
  });

  it('should load proxy configuration', () => {
    process.env.CONNECTION_MODE = 'http';
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
    process.env.SLACK_SIGNING_SECRET = 'test-secret';
    process.env.HTTP_PROXY_URL = 'http://proxy.example.com:8080';
    process.env.HTTP_PROXY_USERNAME = 'user';
    process.env.HTTP_PROXY_PASSWORD = 'pass';

    const config = loadConfig();

    expect(config.proxy?.url).toBe('http://proxy.example.com:8080');
    expect(config.proxy?.username).toBe('user');
    expect(config.proxy?.password).toBe('pass');
  });
});
