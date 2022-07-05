exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('reveals', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network');
      table.string('marketId');
      table.integer('orderId');
      table.integer('disputeId');
      table.string('revealer');
      table.string('vote');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('reveals')]);
};
