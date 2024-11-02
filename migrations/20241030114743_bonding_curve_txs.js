exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('bonding_curve_txs', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.boolean('buy');
      table.string('address');
      table.decimal('input', null).defaultTo(0);
      table.decimal('output', null).defaultTo(0);
      table.decimal('fee', null).defaultTo(0);
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('bonding_curve_txs')]);
};
