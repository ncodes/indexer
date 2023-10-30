exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('users', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('email');
      table.string('address');
      table.string('locale');
      table.string('timezone');
      table.string('deviceTokenEmail');
      table.string('role');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');

      table.index(['address'], 'idx_address');
      table.index(['address'], 'idx_email');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('users')]);
};
