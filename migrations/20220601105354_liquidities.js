exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('liquidities', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network');
      table.string('provider');
      table.string('marketId');
      table.string('base');
      table.string('baseAddress');
      table.string('quote');
      table.string('quoteAddress');
      table.string('amount');
      table.string('price');
      table.string('minSwap');
      table.string('maxSwap');
      table.string('manager');
      table.integer('timeToPay');
      table.boolean('paused').defaultTo(false);
      table.integer('openOrders').defaultTo(0);

      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');

      table.unique(['network', 'marketId', 'provider']);
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('liquidities')]);
};
