// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

// Update with your config settings.
module.exports = {
  development: {
    client: 'postgres',
    connection: {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      connectionString: process.env.DATABASE_URL || undefined,
      socketPath: process.env.DB_SOCKET_PATH || undefined,
      sslMode: process.env.DB_SSL_MODE,
      ssl: process.env.DB_SSL ? { rejectUnauthorized: false } : false,
    },
  },

  test: {
    client: 'postgres',
    connection: process.env.DATABASE_URL_TEST,
  },

  production: {
    client: 'postgres',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
    },
    migrations: {
      tableName: 'knex_migrations',
    },
  },
};
