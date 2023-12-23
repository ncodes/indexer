import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as sourceMapSupport from 'source-map-support';
import * as webpush from 'web-push';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/interceptors/exception_filter';
import { appLogger } from './common/loggers/logger';
import { CommonValidationPipeOpt } from './common/pipes/common.pipe';

dayjs.extend(utc);

sourceMapSupport.install();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: appLogger,
    bodyParser: false,
  });

  app.useGlobalPipes(new ValidationPipe(CommonValidationPipeOpt));
  app.enableCors();
  app.useGlobalFilters(new AllExceptionsFilter());

  webpush.setVapidDetails('mailto:web@joint.cool', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

  const port = process.env.PORT || 3000;
  appLogger.log(`Starting server @ :${port}`);
  await app.listen(port);
}

bootstrap();
