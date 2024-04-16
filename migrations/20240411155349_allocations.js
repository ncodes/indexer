exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('allocations', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('name');
      table.string('owner');
      table.decimal('amount', null).defaultTo(0);
      table.boolean('claimed').defaultTo(false);
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('allocations')]);
};
