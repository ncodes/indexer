exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('ticket_slashes', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network');
      table.string('owner');
      table.integer('index');
      table.integer('poolId');
      table.string('ticketId');
      table.integer('orderId');
      table.integer('disputeId');
      table.decimal('amount', null).defaultTo(0);
      table.boolean('voted').defaultTo(false);
      table.boolean('winSide').defaultTo(false);
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('ticket_slashes')]);
};
