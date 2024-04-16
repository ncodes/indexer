exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('lucky_codes', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('code');
      table.string('owner');
      table.boolean('random').defaultTo(false);
      table.decimal('minAmount', null).defaultTo(0);
      table.decimal('maxAmount', null).defaultTo(0);
      table.decimal('amount', null).defaultTo(0);
      table.boolean('claimed').defaultTo(false);
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('lucky_codes')]);
};
