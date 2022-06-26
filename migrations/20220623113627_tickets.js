exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('tickets', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network');
      table.string('owner');
      table.integer('index');
      table.string('marketId');
      table.string('bond');
      table.string('txHash');
      table.integer('orderId');
      table.boolean('drained').defaultTo(false);
      table.boolean('drafted').defaultTo(false);
      table.boolean('slashed').defaultTo(false);
      table.timestamp('matureAt');
      table.timestamp('joinBy');
      table.timestamp('cancelAt');
      table.timestamp('drainedAt');
      table.timestamp('draftedAt');
      table.timestamp('leaveAt');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('tickets')]);
};
