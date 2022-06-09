exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('market_providers', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network');
      table.string('marketId');
      table.string('address');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');

      table.unique(['network', 'marketId', 'address']);
      table.index(['network', 'marketId', 'address']);
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('market_providers')]);
};
