import { NestFactory } from '@nestjs/core';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as sourceMapSupport from 'source-map-support';
import * as webpush from 'web-push';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/interceptors/exception_filter';
import './common/local_assets';
import { appLogger } from './common/loggers/logger';
import Envs from './config/contants';

dayjs.extend(utc);

sourceMapSupport.install();

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: appLogger,
    bodyParser: false,
  });

  app.enableCors();
  app.useGlobalFilters(new AllExceptionsFilter());

  webpush.setVapidDetails('mailto:web@joint.cool', Envs.vapidPublicKey, Envs.vapidPrivateKey);

  const port = process.env.PORT || 3000;
  appLogger.log(`Starting server @ :${port}`);
  await app.listen(port);
}

bootstrap();
