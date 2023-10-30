exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('online-statuses', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network');
      table.string('address');
      table.integer('orderId');
      table.integer('offerId');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('online-statuses')]);
};
