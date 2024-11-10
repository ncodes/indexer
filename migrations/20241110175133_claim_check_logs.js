exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('claim_check_logs', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('address');
      table.integer('chainId');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('claim_check_logs')]);
};
