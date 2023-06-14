/** @typedef {import('knex/types').Knex} knex */
/**
 * @param {knex} knex
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('offers', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network');
      table.string('marketAddress');
      table.string('provider');
      table.integer('lid');
      table.integer('offerId');
      table.string('creator');
      table.string('amount');
      table.string('price');
      table.jsonb('ids').defaultTo([]);
      table.boolean('accepted').defaultTo(false);
      table.boolean('cancelled').defaultTo(false);
      table.boolean('executed').defaultTo(false);
      table.timestamp('execAt');
      table.timestamp('deadline');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('offers')]);
};
