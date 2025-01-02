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
      table.decimal('amount', null).defaultTo(0);
      table.decimal('valueUsd', null).defaultTo(0);
      table.decimal('price', null).defaultTo(0);
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
      table.decimal('protocolFee', null).defaultTo(0);
      table.decimal('marketCreatorFee', null).defaultTo(0);
      table.string('txHash');
      table.string('takerPaymentMethodId');
      table.string('providerPaymentMethodId');
      table.timestamp('disputeFrom');
      table.timestamp('cancelAt');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
      table.timestamp('paidAt');
      table.timestamp('finalizedAt');

      table.index(
        ['network', 'cancelled', 'instant', 'provider', 'taker'],
        'idx_network_cancelled_instant_provider_taker',
      );
      table.index(['network', 'provider', 'cancelled', 'instant'], 'idx_network_provider_cancelled_instant');
      table.index(['network', 'taker', 'cancelled', 'instant'], 'idx_network_taker_cancelled_instant');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('swaps')]);
};
