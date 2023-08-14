/** @typedef {import('knex/types').Knex} knex */
/**
 * @param {knex} knex
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('liquidity_events', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network');
      table.string('marketAddress');
      table.string('provider');
      table.integer('lid');
      table.string('creator');
      table.enum('action', [
        'add',
        'remove',
        'swap',
        'offer',
        'pause',
        'manager_update',
        'target_update',
        'price_update',
        'swap_limit_update',
        'time_to_pay_update',
      ]);
      table.decimal('price', null).defaultTo(0);
      table.decimal('amount', null).defaultTo(0);
      table.decimal('minSwap', null);
      table.decimal('maxSwap', null);
      table.string('manager');
      table.string('target');
      table.integer('timeToPay').defaultTo(0);
      table.boolean('paused').defaultTo(false);
      table.integer('offerId').defaultTo(0);
      table.integer('orderId').defaultTo(0);
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('liquidity_events')]);
};
