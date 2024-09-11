/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('pay_router_source_transfers', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network');
      table.string('requestId');
      table.string('beneficiary');
      table.decimal('amount', null).defaultTo(0);
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('pay_router_source_transfers')]);
};
