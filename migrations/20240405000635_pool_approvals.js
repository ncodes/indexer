/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('pool_approvals', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.integer('poolId');
      table.string('network').notNullable();
      table.string('address').notNullable();
      table.boolean('isMarket').defaultTo(false);
      table.boolean('approved').defaultTo(false);
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
  return Promise.all([knex.schema.dropTable('pool_approvals')]);
};
