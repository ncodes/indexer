exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('markets', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('mid');
      table.string('creator');
      table.string('base');
      table.string('quote');
      table.integer('blockNumber');
      table.string('blockHash');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('markets')]);
};
