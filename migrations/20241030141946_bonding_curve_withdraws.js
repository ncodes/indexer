exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('bonding_curve_withdraws', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('address');
      table.decimal('amount', null).defaultTo(0);
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('bonding_curve_withdraws')]);
};
