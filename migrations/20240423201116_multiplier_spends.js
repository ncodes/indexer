exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('multiplier_spends', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('userId');
      table.decimal('amount', null).defaultTo(0);
      table.decimal('taps', null).defaultTo(0);
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('multiplier_spends')]);
};
