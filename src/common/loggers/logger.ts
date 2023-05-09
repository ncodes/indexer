import { utilities as nestWinstonModuleUtilities, WinstonModule } from 'nest-winston';
import * as winston from 'winston';

const loggerTransport: winston.transport[] = [
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: winston.format.json(),
  }),
  new winston.transports.File({
    filename: 'logs/combined.log',
    format: winston.format.json(),
  }),
];

const consoleTrans = new winston.transports.Console({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.ms(),
    nestWinstonModuleUtilities.format.nestLike(),
  ),
});

if (['development', ''].includes(process.env.NODE_ENV)) {
  loggerTransport.push(consoleTrans);
}

if (process.env.DEV_MODE) {
  loggerTransport.push(consoleTrans);
}

export const appLogger = WinstonModule.createLogger({
  transports: loggerTransport,
});
