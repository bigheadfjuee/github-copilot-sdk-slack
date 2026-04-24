import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = pino(
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

export const createLogger = (name: string) => {
  return logger.child({ module: name });
};
