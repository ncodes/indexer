// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

// Update with your config settings.
module.exports = {
  development: {
    client: 'postgres',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
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
