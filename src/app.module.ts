import { Logger, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import Handlebars from 'handlebars';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';
import { JsonBodyMiddleware } from './common/middlewares/body.middleware';
import AppConfig from './config/app.config';
import AuthConfig from './config/auth.config';
import KnexConfig from './config/knex.config';
import { AuthModule } from './controllers/auth/auth.module';
import { LiquidityModule } from './controllers/liquidity/liquidity.module';
import { MarketsModule } from './controllers/markets/markets.module';
import { DBService } from './db/DBService';
import { JobsModule } from './jobs/jobs.module';
import { NetworkModule } from './network/network.module';
import { ProvidersModule } from './controllers/providers/providers.module';
import { MiscModule } from './controllers/misc/misc.module';
import { NotificationsModule } from './controllers/notifications/notifications.module';
import { SwapsModule } from './controllers/swaps/swaps.module';
import { shortenAddr } from './common/utils/helpers';
import { TicketsModule } from './controllers/tickets/tickets.module';

Handlebars.registerHelper('uppercase', (aString) => {
  return aString.toUpperCase();
});

Handlebars.registerHelper('shorten', (aString) => {
  return shortenAddr(aString);
});

Handlebars.registerHelper('gt', function (v1, v2, options) {
  'use strict';
  if (v1 > v2) {
    return options.fn(this);
  }
  return options.inverse(this);
});

/**
 * A list of modules to attach.
 * We use this method instead of directly specifying the module so
 * that we can apply custom logic here to determine which
 * modules to load.
 * @returns
 */
function getModules() {
  return [
    JobsModule,
    AuthModule,
    NetworkModule,
    MarketsModule,
    LiquidityModule,
    ProvidersModule,
    MiscModule,
    NotificationsModule,
    SwapsModule,
    TicketsModule,
  ];
}

/**
 * Returns the configurations to be loaded.
 * We use this method instead of directly specifying the configs so
 * that we can apply custom logic here to determine which
 * configurations to load.
 * @returns
 */
function getConfigs() {
  return [KnexConfig, AppConfig, AuthConfig];
}

/**
 * Returns the providers to be loaded.
 * We use this method instead of directly specifying the providers so
 * that we can apply custom logic here to determine which
 * providers to load.
 * @returns
 */
function getProviders() {
  return [DBService, Logger, { provide: APP_GUARD, useClass: ThrottlerGuard }];
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
      load: getConfigs(),
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfgSrv: ConfigService) => ({
        ttl: parseInt(cfgSrv.get('app.throttle_ttl')),
        limit: parseInt(cfgSrv.get('app.throttle_limit')),
        storage: new ThrottlerStorageRedisService(cfgSrv.get('app.redis.url')),
      }),
    }),
    ...getModules(),
  ],
  providers: getProviders(),
  controllers: [],
})
export class AppModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): MiddlewareConsumer | void {
    consumer
      // .apply(RawBodyMiddleware)
      // .forRoutes({
      //   path: '/v1/..',
      //   method: RequestMethod.POST,
      // })
      .apply(JsonBodyMiddleware)
      .forRoutes(
        { path: '*', method: RequestMethod.POST },
        { path: '*', method: RequestMethod.PUT },
        { path: '*', method: RequestMethod.DELETE },
        { path: '*', method: RequestMethod.GET },
      );
  }
}
