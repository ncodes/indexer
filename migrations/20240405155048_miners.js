/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('miners', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network').notNullable();
      table.string('address').notNullable();
      table.decimal('bond', null).defaultTo(0);
      table.boolean('cancelling').defaultTo(false);
      table.boolean('drained').defaultTo(false);
      table.boolean('blocked').defaultTo(false);
      table.boolean('slashed').defaultTo(false);
      table.timestamp('cancelledAt');
      table.timestamp('maturedAt');
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
  return Promise.all([knex.schema.dropTable('miners')]);
};
