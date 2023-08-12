/** @typedef {import('knex/types').Knex} knex */
/**
 * @param {knex} knex
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('offer_events', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network');
      table.integer('offerId');
      table.string('creator');
      table.enum('action', ['create', 'update', 'accept', 'unaccept', 'cancel', 'execute']);
      table.decimal('amount', null);
      table.decimal('price', null);
      table.jsonb('ids').defaultTo([]);
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('offer_events')]);
};
