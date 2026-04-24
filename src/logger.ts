import { pino, type Logger } from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger: Logger = pino(
  {
    level: process.env.LOG_LEVEL || 'debug',
    transport: isDevelopment
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
            singleLine: false,
          },
        }
      : undefined,
  },
  pino.destination()
);

export const createLogger = (name: string): Logger => {
  return logger.child({ module: name });
};
