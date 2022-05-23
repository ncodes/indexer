exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('sessions', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('userId');
      table.string('signature');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');

      table.index(['signature'], 'idx_signature');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('sessions')]);
};
