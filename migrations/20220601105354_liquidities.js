/** @typedef {import('knex/types').Knex} knex */
/**
 * @param {knex} knex
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('liquidities', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network');
      table.string('provider');
      table.integer('lid');
      table.string('marketAddress');
      table.string('target');
      table.string('base');
      table.string('baseAddress');
      table.integer('baseType').defaultTo(0);
      table.string('quote');
      table.string('quoteAddress');
      table.integer('quoteType').defaultTo(0);
      table.decimal('price', null).defaultTo(0);
      table.decimal('amount', null).defaultTo(0);
      table.decimal('amountSwapped', null).defaultTo(0);
      table.decimal('minSwap', null);
      table.decimal('maxSwap', null);
      table.string('manager');
      table.jsonb('ids').defaultTo([]);
      table.jsonb('wantOrIds').defaultTo([]);
      table.jsonb('wantAndIds').defaultTo([]);
      table.integer('timeToPay').defaultTo(0);
      table.boolean('paused').defaultTo(false);
      table.boolean('swapDisabled').defaultTo(false);
      table.integer('openOrders').defaultTo(0);
      table.integer('openDisputes').defaultTo(0);
      table.integer('totalDisputes').defaultTo(0);
      table.integer('totalSwaps').defaultTo(0);
      table.float('completionRate').defaultTo(0);
      table.float('disputeRate').defaultTo(0);
      table.float('satisfactoryRate').defaultTo(0);
      table.jsonb('requiredSwapBadges').defaultTo([]);
      table.float('avgFinalizeDur').defaultTo(0);
      table.float('avgPaymentDur').defaultTo(0);
      table.float('avgReleaseDur').defaultTo(0);
      table.timestamp('lastSwapAt');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('liquidities')]);
};
