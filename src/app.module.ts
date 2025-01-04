import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Logger, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from './cacher/cache.module';
import { RequestLoggerMiddleware } from './common/loggers/request_logger';
import { JsonBodyMiddleware } from './common/middlewares/body.middleware';
import AppConfig from './config/app.config';
import AuthConfig from './config/auth.config';
import KnexConfig from './config/knex.config';
import { AdminModule } from './controllers/admin/admin.module';
import { AppealsModule } from './controllers/appeals/appeals.module';
import { AssetsModule } from './controllers/assets/assets.module';
import { AuthModule } from './controllers/auth/auth.module';
import { BadgesModule } from './controllers/badges/badges.module';
import { ConvosModule } from './controllers/convos/convos.module';
import { DisputesModule } from './controllers/disputes/disputes.module';
import { FilesModule } from './controllers/files/files.module';
import { HealthModule } from './controllers/health/health.module';
import { LiquidityModule } from './controllers/liquidity/liquidity.module';
import { MarketsModule } from './controllers/markets/markets.module';
import { MiscModule } from './controllers/misc/misc.module';
import { NotificationsModule } from './controllers/notifications/notifications.module';
import { OffersModule } from './controllers/offers/offers.module';
import { PaymentsModule } from './controllers/payments/payments.module';
import { RoutesModule } from './controllers/routes/routes.module';
import { SwapsModule } from './controllers/swaps/swaps.module';
import { TasksModule } from './controllers/tasks/tasks.module';
import { TicketsModule } from './controllers/tickets/tickets.module';
import { TimelinesModule } from './controllers/timelines/timelines.module';
import { UsersModule } from './controllers/users/users.module';
import { DBService } from './db/db.service';
import { InstructionsModule } from './instructions/instructions.module';
import { JobsModule } from './jobs/jobs.module';
import { NetworkModule } from './network/network.module';
import { RedisModule } from './services/redis/redis.module';

/**
 * Get a list of modules to be loaded.
 * If process.env.OFF is set, we return an empty array.
 * @returns
 */
function getModules() {
  const modules = [
    RedisModule,
    JobsModule,
    AuthModule,
    NetworkModule,
    MarketsModule,
    OffersModule,
    TimelinesModule,
    BadgesModule,
    LiquidityModule,
    MiscModule,
    HealthModule,
    NotificationsModule,
    ConvosModule,
    SwapsModule,
    TicketsModule,
    DisputesModule,
    UsersModule,
    AssetsModule,
    TasksModule,
    InstructionsModule,
    PaymentsModule,
    FilesModule,
    CacheModule,
    AdminModule,
    RoutesModule,
    AppealsModule,
  ];

  return process.env.OFF != 'true' ? modules : [HealthModule];
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
      load: [KnexConfig, AppConfig, AuthConfig],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfgSrv: ConfigService) => [
        {
          ttl: parseInt(cfgSrv.get('app.throttle_ttl')),
          limit: parseInt(cfgSrv.get('app.throttle_limit')),
          storage: new ThrottlerStorageRedisService(cfgSrv.get('app.redis.url')),
        },
      ],
    }),
    ...getModules(),
  ],
  providers: [DBService, Logger, { provide: APP_GUARD, useClass: ThrottlerGuard }],
  controllers: [],
})
export class AppModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): MiddlewareConsumer | void {
    consumer
      .apply(RequestLoggerMiddleware)
      .forRoutes('*')
      .apply(JsonBodyMiddleware)
      .forRoutes(
        { path: '*', method: RequestMethod.POST },
        { path: '*', method: RequestMethod.PUT },
        { path: '*', method: RequestMethod.DELETE },
        { path: '*', method: RequestMethod.GET },
      );
  }
}
