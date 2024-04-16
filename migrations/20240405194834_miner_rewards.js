/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('miner_rewards', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network').notNullable();
      table.string('address').notNullable();
      table.string('operation').notNullable();
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
  return Promise.all([knex.schema.dropTable('miner_rewards')]);
};
