import winston from 'winston';
import { config, isProduction } from '../config';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const devFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} [${level}] ${message}${metaStr}`;
});

export const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: isProduction
    ? combine(timestamp(), errors({ stack: true }), json())
    : combine(
        colorize(),
        timestamp({ format: 'HH:mm:ss' }),
        errors({ stack: true }),
        devFormat,
      ),
  transports: [new winston.transports.Console()],
});
