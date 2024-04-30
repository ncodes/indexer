exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('battles', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.decimal('allocation', null).defaultTo(0);
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('battles')]);
};
