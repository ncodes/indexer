exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('market_prices', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('marketId');
      table.string('provider');
      table.string('network');
      table.string('price');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('market_prices')]);
};
