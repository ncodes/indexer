exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('swaps', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network');
      table.string('marketId');
      table.string('base');
      table.string('baseAddress');
      table.string('quote');
      table.string('quoteAddress');
      table.string('orderId');
      table.string('provider');
      table.string('taker');
      table.string('amount');
      table.string('price');
      table.boolean('instant').defaultTo(false);
      table.boolean('paid').defaultTo(false);
      table.boolean('cancelled').defaultTo(false);
      table.boolean('released').defaultTo(false);
      table.boolean('byDispute').defaultTo(false);
      table.string('cost');
      table.string('chargedAmount');
      table.boolean('costCharged').defaultTo(false);
      table.integer('protocolFeeBP');
      table.string('protocolFee');
      table.integer('marketFeeBP');
      table.string('marketFee');
      table.string('totalFee');
      table.string('txHash');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('swaps')]);
};
