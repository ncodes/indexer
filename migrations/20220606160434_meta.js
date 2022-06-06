exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('meta', (table) => {
      table.increments('id').primary();
      table.string('key');
      table.text('value');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
      table.index(['key'], 'idx_key');

      table.unique('key');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('meta')]);
};
