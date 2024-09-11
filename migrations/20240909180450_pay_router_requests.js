/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('pay_router_requests', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network');
      table.string('creator');
      table.integer('requestId');
      table.integer('requesterFeeBp').defaultTo(0);
      table.integer('protocolFeeBp').defaultTo(0);
      table.integer('valueLockDuration').defaultTo(0);
      table.decimal('sourceAmt', null).defaultTo(0);
      table.boolean('orgSourcePaid').defaultTo(false);
      table.boolean('closed').defaultTo(false);
      table.boolean('cancelled').defaultTo(false);
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
  return Promise.all([knex.schema.dropTable('pay_router_requests')]);
};
