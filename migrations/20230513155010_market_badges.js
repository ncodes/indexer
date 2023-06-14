exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('market_badges', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network');
      table.string('marketAddress');
      table.string('provider');
      table.integer('lid');
      table.string('badge');
      table.string('path');
      table.string('scope');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');

      table.index(['network', 'marketAddress']);
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('market_badges')]);
};
