exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('taps', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('userId');
      table.boolean('virtual').defaultTo(false);
      table.string('bonusName');
      table.boolean('bonus').defaultTo(false);
      table.decimal('bonusValue', null).defaultTo(0);
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('taps')]);
};
