exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('swaps', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network');
      table.string('marketAddress');
      table.string('base');
      table.string('baseAddress');
      table.string('quote');
      table.string('quoteAddress');
      table.integer('orderId');
      table.integer('lid');
      table.string('provider');
      table.string('taker');
      table.string('amount');
      table.string('price');
      table.jsonb('providerIds').defaultTo([]);
      table.jsonb('takerIds').defaultTo([]);
      table.integer('offerId');
      table.integer('operator');
      table.boolean('instant').defaultTo(false);
      table.boolean('paid').defaultTo(false);
      table.boolean('cancelled').defaultTo(false);
      table.boolean('released').defaultTo(false);
      table.boolean('byDispute').defaultTo(false);
      table.string('finalizer');
      table.string('payer');
      table.string('protocolFee');
      table.string('marketCreatorFee');
      table.string('txHash');
      table.timestamp('disputeFrom');
      table.timestamp('cancelAt');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
      table.timestamp('paidAt');
      table.timestamp('finalizedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('swaps')]);
};
