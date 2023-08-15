/** @typedef {import('knex/types').Knex} knex */
/**
 * @param {knex} knex
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('events', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('creator');
      table.enum('action', [
        'liq_add',
        'liq_remove',
        'liq_swap',
        'liq_offer',
        'liq_pause',
        'liq_manager_update',
        'liq_target_update',
        'liq_price_update',
        'liq_swap_limit_update',
        'liq_time_to_pay_update',
        'swap_paid',
        'swap_released',
        'swap_cancelled',
        'swap_disputed',
        'swap_drafted',
        'swap_committed',
        'swap_revealed',
        'swap_executed',
        'swap_undrafted',
        'offer_create',
        'offer_update',
        'offer_accept',
        'offer_unaccept',
        'offer_cancel',
        'offer_execute',
      ]);

      // common fields
      table.string('network');
      table.string('marketAddress');
      table.integer('orderId').defaultTo(0);
      table.decimal('price', null).defaultTo(0);
      table.decimal('amount', null).defaultTo(0);
      table.integer('offerId').defaultTo(0);

      // liquidity event fields
      table.string('provider');
      table.integer('lid');
      table.decimal('minSwap', null);
      table.decimal('maxSwap', null);
      table.string('manager');
      table.string('target');
      table.integer('timeToPay').defaultTo(0);
      table.boolean('paused').defaultTo(false);

      // offer event fields
      table.jsonb('ids').defaultTo([]);

      // swap event fields
      table.string('draftee');
      table.string('vote');
      table.integer('disputeId');

      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('events')]);
};
