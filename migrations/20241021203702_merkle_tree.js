/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('merkle_tree', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('name').unique();
      table.string('id').primary();
      table.string('address');
      table.decimal('amount', null).defaultTo(0);
      table.integer('claimId').defaultTo(0);
      table.timestamp('claimedAt');
      table.timestamp('withdrawAt');
      table.text('proof');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('merkle_tree')]);
};
