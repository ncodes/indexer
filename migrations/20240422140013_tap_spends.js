exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('tap_spends', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('userId');
      table.string('type');
      table.decimal('amount', null).defaultTo(0);
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('tap_spends')]);
};
