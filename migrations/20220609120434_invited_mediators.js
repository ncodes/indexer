exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('invited_mediators', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network');
      table.string('marketAddress');
      table.string('address');
      table.boolean('accepted').defaultTo(false);
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');

      table.unique(['network', 'marketAddress', 'address']);
      table.index(['network', 'marketAddress', 'address']);
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('invited_mediators')]);
};
