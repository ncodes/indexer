exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('tps', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('userId');
      table.integer('tps');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');

      table.index('userId', 'idx_userId');
      table.index(['userId', 'createdAt'], 'idx_userId_createdAt');
      table.index(['userId', 'createdAt', 'tps'], 'idx_userId_createdAt_tps');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('tps')]);
};
