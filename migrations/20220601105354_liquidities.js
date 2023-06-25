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
      table.string('quote');
      table.string('quoteAddress');
      table.string('price');
      table.string('amount');
      table.string('amountSwapped').defaultTo(0);
      table.string('minSwap');
      table.string('maxSwap');
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
