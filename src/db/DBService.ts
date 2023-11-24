import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Knex from 'knex';
import * as dbMgr from 'knex-db-manager';
import { Model } from 'objection';
import * as knexJSON from '../../knexfile';

@Injectable()
export class DBService {
  private knex: Knex.Knex;
  private dbManager: dbMgr.KnexDbManager;

  /**
   * Initialize the service
   * @param cfgService - use the config service
   */
  constructor(cfgService: ConfigService) {
    if (!cfgService) return;
    const config = cfgService.get('knex')[process.env.NODE_ENV];
    this.knex = Knex.knex(config);
    Model.knex(this.knex);
    this.knex.migrate.latest();
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
    srv.knex.migrate.latest();
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
  truncateTables() {
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
