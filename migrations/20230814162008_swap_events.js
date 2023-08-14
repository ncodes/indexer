/** @typedef {import('knex/types').Knex} knex */
/**
 * @param {knex} knex
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('swap_events', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network');
      table.string('marketAddress');
      table.integer('orderId');
      table.string('creator');
      table.enum('action', [
        'paid',
        'released',
        'cancelled',
        'disputed',
        'drafted',
        'committed',
        'revealed',
        'executed',
        'undrafted',
      ]);
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
  return Promise.all([knex.schema.dropTable('swap_events')]);
};
