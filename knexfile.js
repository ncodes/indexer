// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

// Update with your config settings.
module.exports = {
  development: {
    client: 'postgres',
    connection: process.env.DATABASE_URL || undefined,
  },

  test: {
    client: 'postgres',
    connection: process.env.DATABASE_URL_TEST,
  },

  production: {
    client: 'postgres',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : undefined,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      connectionString: process.env.DATABASE_URL || undefined,
      sslMode: process.env.DB_SSL_MODE,
      ssl: process.env.DB_SSL ? { rejectUnauthorized: false } : false,
    },
    migrations: {
      tableName: 'knex_migrations',
    },
    pool: {
      min: 0,
      max: process.env.DB_POOL_MAX || 50,
      acquireTimeoutMillis: 300000,
      createTimeoutMillis: 300000,
      destroyTimeoutMillis: 300000,
      idleTimeoutMillis: 300000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 2000,
    },
  },
};
