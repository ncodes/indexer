import { NestFactory } from '@nestjs/core';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as sourceMapSupport from 'source-map-support';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/interceptors/exception_filter';
import { appLogger } from './common/loggers/logger';

dayjs.extend(utc);

sourceMapSupport.install();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: appLogger,
    bodyParser: false,
  });
  app.enableCors();
  app.useGlobalFilters(new AllExceptionsFilter());
  const port = process.env.PORT || 3000;
  appLogger.log(`Starting server @ :${port}`);
  await app.listen(port);
}

bootstrap();
