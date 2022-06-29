exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('drafts', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network');
      table.string('owner');
      table.integer('index');
      table.string('marketId');
      table.string('ticketId');
      table.integer('orderId');
      table.integer('disputeId');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('drafts')]);
};
