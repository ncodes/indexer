import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Knex from 'knex';
import * as dbMgr from 'knex-db-manager';
import { Model } from 'objection';
import * as knexJSON from '../../knexfile';
import { isProd } from '../common/common';

@Injectable()
export class DBService {
  private logger = new Logger(DBService.name);
  private knex: Knex.Knex;
  private dbManager: dbMgr.KnexDbManager;

  /**
   * Initialize the service
   * @param cfgService - use the config service
   */
  constructor(private cfgService: ConfigService) {
    if (!cfgService) return;
    this.getForProd();
  }

  /**
   * Get DB services suitable for production environment
   * @returns {DBService}
   */
  getForProd() {
    const config = this.cfgService.get('knex')[process.env.NODE_ENV];
    this.knex = Knex.knex(config);
    Model.knex(this.knex);

    // this.knex.client.on('error', (e) => {
    //   console.log('DB ERROR', e);
    // });

    // this.knex.client.on('connection-error', (e) => {
    //   console.log('DB CONN ERROR', e);
    // });

    if (isProd()) this.knex.migrate.latest();

    // this.knex.on('error', (err) => {
    //   this.logger.error('DB_ERROR', err);
    //   if (err.message.includes('ECONNRESET') || err.message.includes('connection reset')) {
    //     this.logger.log('RECONNECTING TO DB');
    //     this.getForProd();
    //   }
    // });
  }

  /**
   * Get DB services suitable for test environment
   * @returns {DBService}
   */
  static getForTest() {
    const config = knexJSON.test;
    const knex = Knex.knex(config);
    const srv = new DBService(null);
    srv.knex = knex;
    Model.knex(srv.knex);
    srv.dbManager = dbMgr.databaseManagerFactory({
      knex: config,
      dbManager: {},
    });

    return srv;
  }

  /**
   * truncateTables truncates one or more tables
   */
  async truncateTables() {
    return this.dbManager.truncateDb(['knex_migrations']);
  }

  /**
   * Destroy the database
   * @returns
   */
  destroy() {
    return this.knex.destroy().then(async () => {
      await this.dbManager.closeKnex();
    });
  }
}
