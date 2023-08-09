exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('markets', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('address');
      table.string('creator');
      table.string('base');
      table.string('baseAddress');
      table.integer('baseType').defaultTo(0);
      table.integer('baseDecimals').defaultTo(0);
      table.string('quote');
      table.string('quoteAddress');
      table.integer('quoteType').defaultTo(0);
      table.integer('quoteDecimals').defaultTo(0);
      table.boolean('instant').defaultTo(false);
      table.boolean('allowZeroPrice').defaultTo(false);
      table.boolean('offerOnly').defaultTo(false);
      table.string('pair');
      table.string('network');
      table.integer('mediatorPoolId').defaultTo(0);
      table.integer('openDisputes').defaultTo(0);
      table.integer('totalDisputes').defaultTo(0);
      table.integer('totalSwaps').defaultTo(0);
      table.integer('commission').defaultTo(0);
      table.float('completionRate').defaultTo(0);
      table.float('disputeRate').defaultTo(0);
      table.string('amountSwapped').defaultTo(0);
      table.boolean('permPut').defaultTo(false);
      table.boolean('permSwap').defaultTo(false);
      table.integer('disputeDelayTime');
      table.integer('evidenceDur');
      table.integer('predictDur');
      table.string('totalLiquidity').defaultTo(0);
      table.string('lowestPrice').defaultTo(0);
      table.float('avgFinalizeDur').defaultTo(0);
      table.float('avgPaymentDur').defaultTo(0);
      table.float('avgReleaseDur').defaultTo(0);
      table.jsonb('requiredPutBadges').defaultTo([]);
      table.jsonb('requiredSwapBadges').defaultTo([]);
      table.string('manager');
      table.string('txHash');
      table.timestamp('lastSwapAt');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');

      table.index('address');
      table.unique(['network', 'address']);
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('markets')]);
};
